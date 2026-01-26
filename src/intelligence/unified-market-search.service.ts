/**
 * Unified Market Search Service
 * 
 * Intelligent market discovery across Kalshi and Polymarket with:
 * - Smart query matching
 * - Cross-platform normalization
 * - Relevance scoring
 * - Fuzzy matching for player/team names
 */

import { Injectable, Logger } from '@nestjs/common';
import { KalshiService, KalshiMarket } from '../integrations/kalshi.service';
import { PolymarketService, PolymarketMarket } from '../integrations/polymarket.service';
import { DatabaseService } from '../database/database.service';
import { CacheService } from '../common/cache.service';
import { QueryIntelligenceService, SearchFilters } from './query-intelligence.service';
import { UnifiedMarket, ParsedQuery, MarketCategory } from './types';

@Injectable()
export class UnifiedMarketSearchService {
    private readonly logger = new Logger(UnifiedMarketSearchService.name);

    constructor(
        private kalshiService: KalshiService,
        private polymarketService: PolymarketService,
        private databaseService: DatabaseService,
        private cacheService: CacheService,
        private queryIntelligence: QueryIntelligenceService,
    ) {}

    /**
     * Search markets using natural language query
     */
    async searchByQuery(query: string): Promise<UnifiedMarket[]> {
        // Parse the query
        const parsed = await this.queryIntelligence.parseQuery(query);
        this.logger.debug(`Parsed query: ${JSON.stringify(parsed)}`);

        // Build filters from parsed query
        const filters = this.queryIntelligence.buildSearchFilters(parsed);

        // Execute search
        return this.search(parsed, filters);
    }

    /**
     * Search markets with structured filters
     */
    async search(parsed: ParsedQuery, filters: SearchFilters): Promise<UnifiedMarket[]> {
        const { platform } = filters;

        // Log which platforms we're actually querying
        const platformsToQuery: string[] = [];
        if (!platform || platform === 'kalshi') platformsToQuery.push('kalshi');
        if (!platform || platform === 'polymarket') platformsToQuery.push('polymarket');
        this.logger.log(`Searching platforms: [${platformsToQuery.join(', ')}] (filter platform: ${platform || 'not set'})`);

        try {
            // Fetch from platforms in parallel
            const promises: Promise<UnifiedMarket[]>[] = [];

            if (!platform || platform === 'kalshi') {
                promises.push(this.searchKalshi(parsed, filters));
            }

            if (!platform || platform === 'polymarket') {
                promises.push(this.searchPolymarket(parsed, filters));
            }

            const results = await Promise.all(promises);
            let markets = results.flat();
            this.logger.debug(`Combined ${markets.length} markets from all platforms`);

            // Log category distribution
            const categoryCount = markets.reduce((acc, m) => {
                acc[m.category] = (acc[m.category] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            this.logger.debug(`Category distribution: ${JSON.stringify(categoryCount)}`);

            // Score and rank results based on query relevance
            markets = this.scoreAndRank(markets, parsed);
            this.logger.debug(`After scoring/ranking: ${markets.length} markets`);

            // Apply additional filters
            markets = this.applyFilters(markets, filters);
            this.logger.debug(`After filters: ${markets.length} markets`);

            // Limit results
            const limit = filters.limit || 30;
            markets = markets.slice(0, limit);

            // Cache results
            this.cacheResults(markets);

            return markets;
        } catch (error) {
            this.logger.error(`Search failed: ${error}`);
            return [];
        }
    }

    /**
     * Search Kalshi markets
     */
    private async searchKalshi(parsed: ParsedQuery, filters: SearchFilters): Promise<UnifiedMarket[]> {
        try {
            // Build Kalshi-specific filters
            const kalshiFilters: any = {
                limit: 200,
                status: 'open',
            };

            // If searching for sports, try to use series_ticker
            if (parsed.sport) {
                const seriesMap: Record<string, string> = {
                    'tennis': 'TENNIS',
                    'basketball': 'NBA',
                    'football': 'NFL',
                    'baseball': 'MLB',
                    'hockey': 'NHL',
                };
                if (seriesMap[parsed.sport]) {
                    kalshiFilters.series_ticker = seriesMap[parsed.sport];
                }
            }

            // Time filters
            if (filters.minEndDate) {
                kalshiFilters.min_close_ts = Math.floor(filters.minEndDate.getTime() / 1000);
            }
            if (filters.maxEndDate) {
                kalshiFilters.max_close_ts = Math.floor(filters.maxEndDate.getTime() / 1000);
            }

            this.logger.debug(`Searching Kalshi with filters: ${JSON.stringify(kalshiFilters)}`);

            const markets = await this.kalshiService.getMarkets(kalshiFilters);
            this.logger.debug(`Kalshi returned ${markets.length} raw markets`);

            // Convert to unified format
            const unified = markets.map(m => this.normalizeKalshiMarket(m));

            // Filter by search terms if provided
            if (filters.searchQuery && (parsed.players?.length || parsed.teams?.length)) {
                // Only use fuzzy filter if we have specific players/teams to match
                const filtered = this.fuzzyFilterMarkets(unified, filters.searchQuery, parsed);
                this.logger.debug(`After fuzzy filter for "${filters.searchQuery}": ${filtered.length} markets`);
                return filtered;
            }

            this.logger.debug(`Returning ${unified.length} Kalshi markets (no fuzzy filter applied)`);
            return unified;
        } catch (error) {
            this.logger.error(`Kalshi search failed: ${error}`);
            return [];
        }
    }

    /**
     * Search Polymarket markets
     */
    private async searchPolymarket(parsed: ParsedQuery, filters: SearchFilters): Promise<UnifiedMarket[]> {
        try {
            let markets: PolymarketMarket[] = [];

            // Use search API if we have a search query
            if (filters.searchQuery) {
                markets = await this.polymarketService.searchMarkets(
                    filters.searchQuery,
                    filters.limit || 100
                );
            } 
            // Use category filter if available
            else if (filters.category) {
                markets = await this.polymarketService.getMarketsByCategory(
                    filters.category,
                    filters.limit || 100
                );
            }
            // Otherwise get all markets
            else {
                markets = await this.polymarketService.getMarkets(
                    filters.limit || 100,
                    0,
                    true
                );
            }

            // Convert to unified format
            const unified = markets.map(m => this.normalizePolymarketMarket(m));

            // Additional fuzzy filtering for complex queries
            if (parsed.players?.length || parsed.teams?.length) {
                return this.fuzzyFilterMarkets(unified, filters.searchQuery || '', parsed);
            }

            return unified;
        } catch (error) {
            this.logger.error(`Polymarket search failed: ${error}`);
            return [];
        }
    }

    /**
     * Normalize Kalshi market to unified format
     */
    private normalizeKalshiMarket(market: KalshiMarket): UnifiedMarket {
        const spread = Math.abs((market.yes_ask || 0) - (market.yes_bid || 0));
        const midpoint = ((market.yes_bid || 0) + (market.yes_ask || 0)) / 2;

        // Calculate liquidity score
        let liquidityScore: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
        if (market.volume_24h > 10000 && spread < 5) {
            liquidityScore = 'HIGH';
        } else if (market.volume_24h > 1000 && spread < 10) {
            liquidityScore = 'MEDIUM';
        }

        // Safely parse date - default to 30 days from now if invalid
        const parseDate = (dateStr: string | undefined): Date => {
            if (!dateStr) {
                return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            }
            const parsed = new Date(dateStr);
            if (isNaN(parsed.getTime())) {
                return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            }
            return parsed;
        };

        const closeTime = parseDate(market.close_time);
        const expirationTime = parseDate(market.expiration_time);

        return {
            id: market.ticker,
            platform: 'kalshi',
            question: market.title,
            description: market.subtitle,
            category: this.categorizeMarket(market.title, market.category),
            tags: this.extractTags(market.title),
            event: {
                ticker: market.event_ticker,
                title: market.title,
                subtitle: market.subtitle,
            },
            market: {
                ticker: market.ticker,
                type: 'binary',
                outcomes: ['Yes', 'No'],
                status: market.status as any,
                closeTime,
                expirationTime,
            },
            pricing: {
                yesBid: (market.yes_bid || 0) / 100,
                yesAsk: (market.yes_ask || 0) / 100,
                noBid: (market.no_bid || 0) / 100,
                noAsk: (market.no_ask || 0) / 100,
                lastPrice: (market.last_price || 0) / 100,
                spread: spread / 100,
                midpoint: midpoint / 100,
            },
            liquidity: {
                volume24h: market.volume_24h || 0,
                totalVolume: market.volume || 0,
                openInterest: market.open_interest || 0,
                notionalValue: (market.volume || 0) * (midpoint / 100),
                liquidityScore,
            },
            platformData: market,
        };
    }

    /**
     * Normalize Polymarket market to unified format
     */
    private normalizePolymarketMarket(market: PolymarketMarket): UnifiedMarket {
        const yesPrice = market.tokens?.find(t => t.outcome === 'Yes')?.price || 
                        parseFloat(market.outcome_prices?.[0] || '0');
        const noPrice = market.tokens?.find(t => t.outcome === 'No')?.price ||
                       parseFloat(market.outcome_prices?.[1] || '0');
        
        const spread = Math.abs(yesPrice - (1 - noPrice));
        const midpoint = (yesPrice + (1 - noPrice)) / 2;

        // Calculate liquidity score
        let liquidityScore: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
        if (market.volume_num > 100000 && market.liquidity_num > 10000) {
            liquidityScore = 'HIGH';
        } else if (market.volume_num > 10000 && market.liquidity_num > 1000) {
            liquidityScore = 'MEDIUM';
        }

        const marketId = market.condition_id || (market as any).id || market.question_id;

        // Safely parse date - default to 30 days from now if invalid
        const parseDate = (dateStr: string | undefined): Date => {
            if (!dateStr) {
                return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            }
            const parsed = new Date(dateStr);
            if (isNaN(parsed.getTime())) {
                return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            }
            return parsed;
        };

        const endDate = parseDate(market.end_date_iso);

        return {
            id: marketId,
            platform: 'polymarket',
            question: market.question,
            description: market.description,
            category: this.categorizeMarket(market.question, market.category),
            tags: this.extractTags(market.question),
            event: {
                ticker: marketId,
                title: market.question,
            },
            market: {
                ticker: marketId,
                type: 'binary',
                outcomes: market.outcomes || ['Yes', 'No'],
                status: market.closed ? 'closed' : (market.active ? 'open' : 'settled'),
                closeTime: endDate,
                expirationTime: endDate,
            },
            pricing: {
                yesBid: yesPrice,
                yesAsk: yesPrice,
                noBid: noPrice,
                noAsk: noPrice,
                lastPrice: yesPrice,
                spread,
                midpoint,
            },
            liquidity: {
                volume24h: market.volume_num * 0.1, // Estimate 24h as 10% of total
                totalVolume: market.volume_num || 0,
                openInterest: market.liquidity_num || 0,
                notionalValue: market.volume_num || 0,
                liquidityScore,
            },
            platformData: market,
        };
    }

    /**
     * Fuzzy filter markets based on search terms and parsed query
     */
    private fuzzyFilterMarkets(
        markets: UnifiedMarket[],
        searchQuery: string,
        parsed: ParsedQuery
    ): UnifiedMarket[] {
        const searchTerms = searchQuery.toLowerCase().split(/\s+/);
        const players = parsed.players?.map(p => p.toLowerCase()) || [];
        const teams = parsed.teams?.map(t => t.toLowerCase()) || [];

        return markets.filter(market => {
            const question = market.question.toLowerCase();
            const description = (market.description || '').toLowerCase();
            const combinedText = `${question} ${description}`;

            // For player matches (like tennis), require BOTH players to be in the title
            if (players.length >= 2) {
                const matchesAllPlayers = players.every(player => {
                    // Check if any part of the player name is in the question
                    const nameParts = player.split(' ');
                    return nameParts.some(part => combinedText.includes(part));
                });
                if (matchesAllPlayers) return true;
            }

            // For team matches
            if (teams.length > 0) {
                const matchesTeam = teams.some(team => 
                    combinedText.includes(team)
                );
                if (matchesTeam) return true;
            }

            // General search term matching
            if (searchTerms.length > 0) {
                const matchCount = searchTerms.filter(term => 
                    combinedText.includes(term)
                ).length;
                
                // Require at least 50% of terms to match
                if (matchCount >= searchTerms.length * 0.5) return true;
            }

            return false;
        });
    }

    /**
     * Score and rank markets based on query relevance
     */
    private scoreAndRank(markets: UnifiedMarket[], parsed: ParsedQuery): UnifiedMarket[] {
        const scored = markets.map(market => {
            let score = 10; // Base score - all markets start with some score
            const question = market.question.toLowerCase();

            // Exact player/team name matches
            if (parsed.players?.length) {
                for (const player of parsed.players) {
                    const nameParts = player.toLowerCase().split(' ');
                    for (const part of nameParts) {
                        if (question.includes(part)) {
                            score += 20;
                        }
                    }
                }
                
                // Bonus for matching ALL players (head-to-head)
                const allMatch = parsed.players.every(player => {
                    const parts = player.toLowerCase().split(' ');
                    return parts.some(part => question.includes(part));
                });
                if (allMatch && parsed.players.length >= 2) {
                    score += 50;
                }
            }

            // Category match - higher bonus when domain is specified
            if (parsed.domain && market.category === parsed.domain) {
                score += 30; // Increased from 15
            }

            // High liquidity bonus
            if (market.liquidity.liquidityScore === 'HIGH') {
                score += 15; // Increased from 10
            } else if (market.liquidity.liquidityScore === 'MEDIUM') {
                score += 8; // Increased from 5
            }

            // Recent activity bonus
            if (market.liquidity.volume24h > 10000) {
                score += 15; // Increased from 10
            } else if (market.liquidity.volume24h > 1000) {
                score += 8; // Increased from 5
            }

            // Time to expiry bonus (prefer markets expiring soon but not too soon)
            const daysToExpiry = Math.ceil(
                (market.market.expirationTime.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            if (daysToExpiry > 1 && daysToExpiry < 30) {
                score += 5;
            }

            return { market, score };
        });

        // Sort by score descending
        scored.sort((a, b) => b.score - a.score);

        return scored.map(s => s.market);
    }

    /**
     * Apply additional filters to markets
     */
    private applyFilters(markets: UnifiedMarket[], filters: SearchFilters): UnifiedMarket[] {
        return markets.filter(market => {
            // Volume filter
            if (filters.minVolume && market.liquidity.totalVolume < filters.minVolume) {
                return false;
            }

            // Liquidity filter
            if (filters.minLiquidity && market.liquidity.openInterest < filters.minLiquidity) {
                return false;
            }

            // Date filters
            if (filters.minEndDate && market.market.expirationTime < filters.minEndDate) {
                return false;
            }
            if (filters.maxEndDate && market.market.expirationTime > filters.maxEndDate) {
                return false;
            }

            // Only active markets
            if (filters.active && market.market.status !== 'open') {
                return false;
            }

            return true;
        });
    }

    /**
     * Categorize market based on title and existing category
     */
    private categorizeMarket(title: string, existingCategory?: string): MarketCategory {
        // FIRST: Trust the platform's category if it's clearly one of ours
        if (existingCategory) {
            const cat = existingCategory.toLowerCase();
            if (cat.includes('sport') || cat.includes('nba') || cat.includes('nfl') || 
                cat.includes('mlb') || cat.includes('tennis') || cat.includes('soccer')) {
                return 'sports';
            }
            if (cat.includes('politic') || cat.includes('election')) return 'politics';
            if (cat.includes('crypto') || cat.includes('financ')) return 'crypto';
            if (cat.includes('econom') || cat.includes('gdp') || cat.includes('unemploy')) return 'economics';
        }

        const lower = title.toLowerCase();

        // Sports detection - EXPANDED KEYWORDS
        const sportKeywords = ['win', 'beat', 'vs', 'v.', 'game', 'match', 'championship', 'playoff', 
                              'super bowl', 'world series', 'score', 'points', 'team', 'player'];
        const tennisKeywords = ['atp', 'wta', 'tennis', 'wimbledon', 'us open', 'australian open', 
                               'french open', 'roland garros', 'grand slam'];
        const basketballKeywords = ['nba', 'basketball', 'lakers', 'celtics', 'warriors', 'nets', 'bucks'];
        const footballKeywords = ['nfl', 'football', 'touchdown', 'quarterback', 'chiefs', 'cowboys', 
                                 '49ers', 'patriots', 'ravens'];
        const hockeyKeywords = ['nhl', 'hockey', 'puck', 'ice'];
        const baseballKeywords = ['mlb', 'baseball', 'yankees', 'dodgers', 'red sox'];

        if (tennisKeywords.some(k => lower.includes(k))) return 'sports';
        if (basketballKeywords.some(k => lower.includes(k))) return 'sports';
        if (footballKeywords.some(k => lower.includes(k))) return 'sports';
        if (hockeyKeywords.some(k => lower.includes(k))) return 'sports';
        if (baseballKeywords.some(k => lower.includes(k))) return 'sports';
        if (sportKeywords.some(k => lower.includes(k))) return 'sports';

        // Politics detection
        const politicsKeywords = ['election', 'president', 'senate', 'congress', 'governor', 'vote', 
                                 'poll', 'trump', 'biden', 'democrat', 'republican'];
        if (politicsKeywords.some(k => lower.includes(k))) return 'politics';

        // Crypto detection
        const cryptoKeywords = ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'solana', 'sol', 
                               'doge', 'blockchain'];
        if (cryptoKeywords.some(k => lower.includes(k))) return 'crypto';

        // Economics detection
        const economicsKeywords = ['fed', 'interest rate', 'inflation', 'gdp', 'unemployment', 'jobs report'];
        if (economicsKeywords.some(k => lower.includes(k))) return 'economics';

        // Weather detection
        const weatherKeywords = ['temperature', 'weather', 'hurricane', 'rainfall'];
        if (weatherKeywords.some(k => lower.includes(k))) return 'weather';

        // Use existing category if available
        if (existingCategory) {
            const categoryMap: Record<string, MarketCategory> = {
                'Sports': 'sports',
                'Politics': 'politics',
                'Crypto': 'crypto',
                'Economics': 'economics',
                'Weather': 'weather',
                'Entertainment': 'entertainment',
                'Science': 'science',
            };
            return categoryMap[existingCategory] || 'other';
        }

        return 'other';
    }

    /**
     * Extract tags from title
     */
    private extractTags(title: string): string[] {
        const tags: string[] = [];
        const lower = title.toLowerCase();

        // Add sport-specific tags
        if (lower.includes('tennis') || lower.includes('atp') || lower.includes('wta')) {
            tags.push('tennis');
        }
        if (lower.includes('nba') || lower.includes('basketball')) {
            tags.push('basketball');
        }
        if (lower.includes('nfl') || lower.includes('football')) {
            tags.push('football');
        }
        if (lower.includes('mlb') || lower.includes('baseball')) {
            tags.push('baseball');
        }

        // Add other tags
        if (lower.includes('bitcoin') || lower.includes('btc')) {
            tags.push('bitcoin');
        }
        if (lower.includes('election') || lower.includes('president')) {
            tags.push('election');
        }

        return tags;
    }

    /**
     * Cache search results
     */
    private async cacheResults(markets: UnifiedMarket[]): Promise<void> {
        for (const market of markets) {
            try {
                await this.databaseService.upsertMarket({
                    platform: market.platform,
                    market_id: market.id,
                    ticker: market.market.ticker,
                    question: market.question,
                    category: market.category,
                    end_date: market.market.expirationTime.toISOString(),
                    yes_price: market.pricing.midpoint,
                    no_price: 1 - market.pricing.midpoint,
                    volume: market.liquidity.totalVolume,
                    liquidity: market.liquidity.openInterest,
                    raw_data: market as any,
                });
            } catch (error) {
                // Ignore cache errors
            }
        }
    }

    /**
     * Get trending markets from specified platform(s)
     */
    async getTrendingMarkets(limit = 20, platform?: 'kalshi' | 'polymarket'): Promise<UnifiedMarket[]> {
        const cacheKey = `trending_${limit}_${platform || 'both'}`;
        this.logger.log(`Getting trending markets: limit=${limit}, platform=${platform || 'both'}`);
        
        return this.cacheService.wrap(
            cacheKey,
            60, // 1 minute cache (in seconds)
            async () => {
                const promises: Promise<UnifiedMarket[]>[] = [];

                if (!platform || platform === 'kalshi') {
                    this.logger.debug(`Fetching Kalshi trending markets`);
                    promises.push(
                        this.kalshiService.getTrendingMarkets(limit)
                            .then(markets => markets.map(m => this.normalizeKalshiMarket(m)))
                    );
                }

                if (!platform || platform === 'polymarket') {
                    this.logger.debug(`Fetching Polymarket trending markets`);
                    promises.push(
                        this.polymarketService.getTrendingMarkets(limit)
                            .then(markets => markets.map(m => this.normalizePolymarketMarket(m)))
                    );
                }

                const results = await Promise.all(promises);
                const markets = results.flat();

                // Sort by volume and return top N
                return markets
                    .sort((a, b) => b.liquidity.volume24h - a.liquidity.volume24h)
                    .slice(0, limit);
            }
        );
    }

    /**
     * Get a single market by platform and ID
     */
    async getMarket(platform: 'kalshi' | 'polymarket', marketId: string): Promise<UnifiedMarket | null> {
        try {
            if (platform === 'kalshi') {
                const market = await this.kalshiService.getMarket(marketId);
                if (market) {
                    return this.normalizeKalshiMarket(market);
                }
            } else {
                const market = await this.polymarketService.getMarket(marketId);
                if (market) {
                    return this.normalizePolymarketMarket(market);
                }
            }
            return null;
        } catch (error) {
            this.logger.error(`Failed to get market ${platform}/${marketId}:`, error);
            return null;
        }
    }

    /**
     * Find potential arbitrage opportunities across platforms
     */
    async findArbitrage(): Promise<Array<{
        question: string;
        kalshiMarket: UnifiedMarket;
        polymarket: UnifiedMarket;
        spreadPercent: number;
        opportunity: string;
    }>> {
        // Get markets from both platforms
        const [kalshiMarkets, polyMarkets] = await Promise.all([
            this.kalshiService.getMarkets({ limit: 200, status: 'open' }),
            this.polymarketService.getMarkets(200, 0, true),
        ]);

        const kalshiUnified = kalshiMarkets.map(m => this.normalizeKalshiMarket(m));
        const polyUnified = polyMarkets.map(m => this.normalizePolymarketMarket(m));

        const opportunities: any[] = [];

        // Simple matching based on similar questions
        for (const kalshi of kalshiUnified) {
            for (const poly of polyUnified) {
                const similarity = this.calculateSimilarity(kalshi.question, poly.question);
                
                if (similarity > 0.7) {
                    const spreadPercent = Math.abs(kalshi.pricing.midpoint - poly.pricing.midpoint) * 100;
                    
                    if (spreadPercent > 3) { // Only show spreads > 3%
                        let opportunity: string;
                        if (kalshi.pricing.midpoint > poly.pricing.midpoint) {
                            opportunity = `Buy YES on Polymarket (${(poly.pricing.midpoint * 100).toFixed(1)}%), Sell YES on Kalshi (${(kalshi.pricing.midpoint * 100).toFixed(1)}%)`;
                        } else {
                            opportunity = `Buy YES on Kalshi (${(kalshi.pricing.midpoint * 100).toFixed(1)}%), Sell YES on Polymarket (${(poly.pricing.midpoint * 100).toFixed(1)}%)`;
                        }

                        opportunities.push({
                            question: kalshi.question,
                            kalshiMarket: kalshi,
                            polymarket: poly,
                            spreadPercent,
                            opportunity,
                        });
                    }
                }
            }
        }

        // Sort by spread descending
        return opportunities.sort((a, b) => b.spreadPercent - a.spreadPercent);
    }

    /**
     * Calculate text similarity (simple word overlap)
     */
    private calculateSimilarity(text1: string, text2: string): number {
        const words1 = new Set(text1.toLowerCase().split(/\s+/));
        const words2 = new Set(text2.toLowerCase().split(/\s+/));
        
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        
        return intersection.size / union.size;
    }
}
