import { Injectable, Logger } from '@nestjs/common';
import { KalshiService } from '../integrations/kalshi.service';
import { PolymarketService } from '../integrations/polymarket.service';
import { DatabaseService } from '../database/database.service';

export interface NormalizedMarket {
    platform: string;
    marketId: string;
    ticker?: string;
    question: string;
    description?: string;
    yesPrice: number;
    noPrice: number;
    volume: number;
    liquidity?: number;
    endDate: string;
    category?: string;
    status?: string;
    isActive?: boolean;
}

export interface MarketDiscoveryFilters {
    platform?: 'kalshi' | 'polymarket' | 'all';
    category?: string;
    minVolume?: number;
    minLiquidity?: number;
    maxEndDate?: Date;
    minEndDate?: Date;
    searchQuery?: string;
    limit?: number;
}

export interface MarketOpportunity extends NormalizedMarket {
    opportunityScore: number;
    impliedProbability: number;
    spreadPercent: number;
    volumeRank: number;
    reasons: string[];
}

@Injectable()
export class MarketService {
    private readonly logger = new Logger(MarketService.name);
    private marketsCache: Map<string, NormalizedMarket[]> = new Map();
    private cacheTimestamp: number = 0;
    private readonly CACHE_TTL_MS = 60000; // 1 minute

    constructor(
        private kalshiService: KalshiService,
        private polymarketService: PolymarketService,
        private databaseService: DatabaseService,
    ) { }

    async discoverMarkets(
        filters: MarketDiscoveryFilters = {},
    ): Promise<NormalizedMarket[]> {
        const { platform = 'all', limit = 50 } = filters;

        let markets: NormalizedMarket[] = [];

        try {
            // Fetch from platforms based on filter
            if (platform === 'all' || platform === 'kalshi') {
                const kalshiMarkets = await this.getKalshiMarkets(filters);
                markets = markets.concat(kalshiMarkets);
            }

            if (platform === 'all' || platform === 'polymarket') {
                const polyMarkets = await this.getPolymarketMarkets(filters);
                markets = markets.concat(polyMarkets);
            }

            // Apply filters
            markets = this.applyFilters(markets, filters);

            // Sort by volume and limit
            markets = markets
                .sort((a, b) => b.volume - a.volume)
                .slice(0, limit);

            // Cache results
            await this.cacheMarkets(markets);

            return markets;
        } catch (error) {
            this.logger.error('Error discovering markets:', error);
            return [];
        }
    }

    private async getKalshiMarkets(
        filters: MarketDiscoveryFilters,
    ): Promise<NormalizedMarket[]> {
        const kalshiMarkets = await this.kalshiService.getMarkets({
            limit: filters.limit || 100,
            status: 'open',
        });

        return kalshiMarkets.map((m) => this.kalshiService.normalizeMarket(m));
    }

    private async getPolymarketMarkets(
        filters: MarketDiscoveryFilters,
    ): Promise<NormalizedMarket[]> {
        let polyMarkets;

        if (filters.searchQuery) {
            polyMarkets = await this.polymarketService.searchMarkets(
                filters.searchQuery,
                filters.limit || 50,
            );
        } else if (filters.category) {
            polyMarkets = await this.polymarketService.getMarketsByCategory(
                filters.category,
                filters.limit || 50,
            );
        } else {
            polyMarkets = await this.polymarketService.getMarkets(
                filters.limit || 100,
                0,
                true,
            );
        }

        return polyMarkets.map((m) => this.polymarketService.normalizeMarket(m));
    }

    private applyFilters(
        markets: NormalizedMarket[],
        filters: MarketDiscoveryFilters,
    ): NormalizedMarket[] {
        return markets.filter((market) => {
            // Category filter
            if (
                filters.category &&
                market.category?.toLowerCase() !== filters.category.toLowerCase()
            ) {
                return false;
            }

            // Volume filter
            if (filters.minVolume && market.volume < filters.minVolume) {
                return false;
            }

            // Liquidity filter
            if (
                filters.minLiquidity &&
                market.liquidity &&
                market.liquidity < filters.minLiquidity
            ) {
                return false;
            }

            // Date filters
            if (market.endDate) {
                const endDate = new Date(market.endDate);
                if (filters.minEndDate && endDate < filters.minEndDate) {
                    return false;
                }
                if (filters.maxEndDate && endDate > filters.maxEndDate) {
                    return false;
                }
            }

            // Search query (check in question)
            if (filters.searchQuery) {
                const query = filters.searchQuery.toLowerCase();
                if (!market.question.toLowerCase().includes(query)) {
                    return false;
                }
            }

            return true;
        });
    }

    async getMarketDetails(
        platform: string,
        marketId: string,
    ): Promise<NormalizedMarket | null> {
        try {
            if (platform === 'kalshi') {
                const market = await this.kalshiService.getMarket(marketId);
                if (market) {
                    return this.kalshiService.normalizeMarket(market);
                }
            } else if (platform === 'polymarket') {
                const market = await this.polymarketService.getMarket(marketId);
                if (market) {
                    return this.polymarketService.normalizeMarket(market);
                }
            }
            return null;
        } catch (error) {
            this.logger.error(`Error getting market details for ${platform}/${marketId}:`, error);
            return null;
        }
    }

    async analyzeOpportunity(market: NormalizedMarket): Promise<MarketOpportunity> {
        const impliedProbability = market.yesPrice * 100;
        const spreadPercent = Math.abs(market.yesPrice - (1 - market.noPrice)) * 100;

        const reasons: string[] = [];
        let opportunityScore = 50; // Base score

        // Volume analysis
        if (market.volume > 100000) {
            opportunityScore += 10;
            reasons.push('High trading volume indicates strong market interest');
        } else if (market.volume < 1000) {
            opportunityScore -= 10;
            reasons.push('Low volume may indicate limited liquidity');
        }

        // Spread analysis
        if (spreadPercent < 2) {
            opportunityScore += 10;
            reasons.push('Tight spread suggests efficient pricing');
        } else if (spreadPercent > 10) {
            opportunityScore -= 10;
            reasons.push('Wide spread may indicate pricing inefficiency');
        }

        // Price analysis (50/50 markets are more uncertain)
        if (impliedProbability > 10 && impliedProbability < 90) {
            opportunityScore += 5;
            reasons.push('Uncertain outcome provides opportunity for edge');
        }

        // Time to expiry
        if (market.endDate) {
            const daysToExpiry = Math.ceil(
                (new Date(market.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
            );
            if (daysToExpiry > 1 && daysToExpiry < 30) {
                opportunityScore += 5;
                reasons.push('Reasonable time horizon for position management');
            }
        }

        // Cap score
        opportunityScore = Math.max(0, Math.min(100, opportunityScore));

        return {
            ...market,
            opportunityScore,
            impliedProbability,
            spreadPercent,
            volumeRank: 0, // Would need full market list to calculate
            reasons,
        };
    }

    async getTrendingMarkets(limit = 20): Promise<NormalizedMarket[]> {
        const [kalshiTrending, polyTrending] = await Promise.all([
            this.kalshiService.getTrendingMarkets(limit),
            this.polymarketService.getTrendingMarkets(limit),
        ]);

        const markets = [
            ...kalshiTrending.map((m) => this.kalshiService.normalizeMarket(m)),
            ...polyTrending.map((m) => this.polymarketService.normalizeMarket(m)),
        ];

        return markets.sort((a, b) => b.volume - a.volume).slice(0, limit);
    }

    async findArbitrageOpportunities(): Promise<
        Array<{
            market1: NormalizedMarket;
            market2: NormalizedMarket;
            spreadPercent: number;
            potentialProfit: number;
        }>
    > {
        // This would require matching similar markets across platforms
        // For now, return empty array as placeholder
        this.logger.log('Arbitrage detection not yet implemented');
        return [];
    }

    private async cacheMarkets(markets: NormalizedMarket[]): Promise<void> {
        for (const market of markets) {
            await this.databaseService.upsertMarket({
                platform: market.platform,
                market_id: market.marketId,
                ticker: market.ticker,
                question: market.question,
                category: market.category,
                end_date: market.endDate,
                yes_price: market.yesPrice,
                no_price: market.noPrice,
                volume: market.volume,
                liquidity: market.liquidity,
                raw_data: market as unknown as Record<string, unknown>,
            });
        }
    }

    async getCachedMarkets(
        platform?: string,
        category?: string,
    ): Promise<NormalizedMarket[]> {
        const cached = await this.databaseService.getMarkets(platform, category);
        return cached.map((m) => ({
            platform: m.platform,
            marketId: m.market_id,
            ticker: m.ticker || undefined,
            question: m.question || '',
            yesPrice: m.yes_price || 0,
            noPrice: m.no_price || 0,
            volume: m.volume || 0,
            liquidity: m.liquidity || undefined,
            endDate: m.end_date || '',
            category: m.category || undefined,
        }));
    }

    // Get all markets for AI context
    async getMarketsForAIContext(limit = 30): Promise<NormalizedMarket[]> {
        const now = Date.now();

        // Check cache
        if (
            this.marketsCache.has('trending') &&
            now - this.cacheTimestamp < this.CACHE_TTL_MS
        ) {
            return this.marketsCache.get('trending')!.slice(0, limit);
        }

        // Fetch fresh data
        const markets = await this.getTrendingMarkets(limit);
        this.marketsCache.set('trending', markets);
        this.cacheTimestamp = now;

        return markets;
    }
}
