/**
 * Intelligence Tool Handler
 * 
 * Handles execution of enhanced tools, bridging the AI service
 * with the intelligence services.
 */

import { Injectable, Logger } from '@nestjs/common';
import { QueryIntelligenceService } from './query-intelligence.service';
import { UnifiedMarketSearchService } from './unified-market-search.service';
import { SportsIntelligenceService } from './sports-intelligence.service';
import { ProbabilityEngine } from './probability-engine.service';
import { RiskAssessmentService } from './risk-assessment.service';
import { RecommendationEngine } from './recommendation-engine.service';
import { ReportGenerator } from './report-generator.service';
import { EnhancedToolInput } from './enhanced-tools';
import { UnifiedMarket } from './types';

@Injectable()
export class IntelligenceToolHandler {
    private readonly logger = new Logger(IntelligenceToolHandler.name);

    constructor(
        private queryIntelligence: QueryIntelligenceService,
        private marketSearch: UnifiedMarketSearchService,
        private sportsIntelligence: SportsIntelligenceService,
        private probabilityEngine: ProbabilityEngine,
        private riskAssessment: RiskAssessmentService,
        private recommendationEngine: RecommendationEngine,
        private reportGenerator: ReportGenerator,
    ) {}

    /**
     * Execute an enhanced tool
     */
    async executeTool(toolName: string, input: EnhancedToolInput): Promise<any> {
        this.logger.debug(`Executing tool: ${toolName}`);

        try {
            switch (toolName) {
                case 'intelligent_search':
                    return this.handleIntelligentSearch(input);

                case 'analyze_market_deep':
                    return this.handleDeepAnalysis(input);

                case 'compare_markets_detailed':
                    return this.handleComparison(input);

                case 'get_sports_intelligence':
                    return this.handleSportsIntelligence(input);

                case 'calculate_fair_value':
                    return this.handleFairValue(input);

                case 'assess_market_risk':
                    return this.handleRiskAssessment(input);

                case 'find_best_opportunity':
                    return this.handleBestOpportunity(input);

                case 'find_arbitrage':
                    return this.handleArbitrage(input);

                case 'quick_recommendation':
                    return this.handleQuickRecommendation(input);

                case 'scan_category':
                    return this.handleCategoryScan(input);

                case 'generate_report':
                    return this.handleGenerateReport(input);

                default:
                    throw new Error(`Unknown tool: ${toolName}`);
            }
        } catch (error) {
            this.logger.error(`Tool execution failed: ${toolName}`, error);
            return { error: error.message || 'Tool execution failed' };
        }
    }

    /**
     * Intelligent search with natural language
     */
    private async handleIntelligentSearch(input: EnhancedToolInput): Promise<any> {
        const { query, platform = 'both', limit = 10 } = input;

        if (!query) {
            return { error: 'Query is required' };
        }

        this.logger.log(`Intelligent search: query="${query}", platform=${platform}, limit=${limit}`);

        // Parse the query
        const parsed = await this.queryIntelligence.parseQuery(query);
        this.logger.debug(`Parsed query: ${JSON.stringify(parsed)}`);
        
        // Build search filters
        const filters = this.queryIntelligence.buildSearchFilters(parsed);
        filters.platform = platform === 'both' ? undefined : platform as any;
        filters.limit = limit;

        // Execute search
        const markets = await this.marketSearch.search(parsed, filters);
        this.logger.debug(`Search returned ${markets.length} markets`);

        // If no results, provide helpful suggestions
        if (markets.length === 0) {
            return {
                query: query,
                parsed: {
                    intent: parsed.intent,
                    domain: parsed.domain,
                    sport: parsed.sport,
                    players: parsed.players,
                    teams: parsed.teams,
                    confidence: parsed.confidence,
                },
                results: [],
                totalFound: 0,
                message: `No active markets found matching "${query}" on ${platform === 'both' ? 'Kalshi or Polymarket' : platform}.`,
                suggestions: [
                    'Try searching with broader terms',
                    'Check if the event/market is currently active',
                    `Use get_kalshi_markets or get_polymarket_markets to browse all available markets`,
                    parsed.sport ? `The ${parsed.sport} category may not have active markets right now` : null,
                    parsed.players?.length ? `Try searching for: ${parsed.players.join(', ')}` : null,
                ].filter(Boolean),
            };
        }

        return {
            query: query,
            parsed: {
                intent: parsed.intent,
                domain: parsed.domain,
                sport: parsed.sport,
                players: parsed.players,
                teams: parsed.teams,
                confidence: parsed.confidence,
            },
            results: markets.slice(0, limit).map(m => this.summarizeMarket(m)),
            totalFound: markets.length,
        };
    }

    /**
     * Deep market analysis - comprehensive with all probability models
     */
    private async handleDeepAnalysis(input: EnhancedToolInput): Promise<any> {
        const { platform, market_id, bankroll = 10000 } = input;

        if (!platform || !market_id) {
            return { error: 'Platform and market_id are required' };
        }

        this.logger.log(`Deep analysis: platform=${platform}, market_id=${market_id}`);

        // Get market
        let market = await this.marketSearch.getMarket(platform as 'kalshi' | 'polymarket', market_id);
        if (!market) {
            return { error: `Market ${market_id} not found on ${platform}` };
        }

        // Enrich with domain-specific intelligence
        if (market.category === 'sports') {
            market = await this.sportsIntelligence.enrichSportsMarket(market);
        }

        // Generate full recommendation with all models
        const recommendation = await this.recommendationEngine.generateRecommendation(market, bankroll);

        // Calculate days to expiry safely
        let daysToExpiry = 0;
        try {
            const expTime = market.market.expirationTime;
            if (expTime && !isNaN(expTime.getTime())) {
                daysToExpiry = Math.ceil((expTime.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            }
        } catch (e) {
            daysToExpiry = 30; // default
        }

        // Build comprehensive response with all data the AI needs
        return {
            // Market overview
            market: {
                id: market.id,
                platform: market.platform,
                question: market.question,
                category: market.category,
                subcategory: market.subcategory,
                status: market.market.status,
                expirationDate: market.market.expirationTime?.toISOString?.() || 'Unknown',
                daysToExpiry,
            },

            // Current pricing
            pricing: {
                yesBid: (market.pricing.yesBid * 100).toFixed(1) + '%',
                yesAsk: (market.pricing.yesAsk * 100).toFixed(1) + '%',
                noBid: (market.pricing.noBid * 100).toFixed(1) + '%',
                noAsk: (market.pricing.noAsk * 100).toFixed(1) + '%',
                midpoint: (market.pricing.midpoint * 100).toFixed(1) + '%',
                spread: (market.pricing.spread * 100).toFixed(2) + '%',
                impliedProbability: (market.pricing.midpoint * 100).toFixed(1) + '%',
            },

            // Liquidity metrics
            liquidity: {
                volume24h: '$' + market.liquidity.volume24h.toLocaleString(),
                totalVolume: '$' + market.liquidity.totalVolume.toLocaleString(),
                openInterest: '$' + market.liquidity.openInterest.toLocaleString(),
                score: market.liquidity.liquidityScore,
                maxRecommendedPosition: '$' + Math.round(market.liquidity.volume24h * 0.05).toLocaleString(),
                slippageEstimate: (market.pricing.spread / 2 * 100).toFixed(2) + '%',
            },

            // Probability analysis with all models
            analysis: {
                fairValue: (recommendation.analysis.fairValue * 100).toFixed(1) + '%',
                fairValueDecimal: recommendation.analysis.fairValue,
                marketPrice: (market.pricing.midpoint * 100).toFixed(1) + '%',
                edge: (recommendation.edge > 0 ? '+' : '') + recommendation.edge.toFixed(2) + '%',
                edgeDecimal: recommendation.edge / 100,
                confidence: (recommendation.confidence * 100).toFixed(0) + '%',
                
                // Detailed model breakdown
                models: recommendation.analysis.models.map(m => ({
                    name: m.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                    probability: (m.probability * 100).toFixed(1) + '%',
                    weight: (m.weight * 100).toFixed(0) + '%',
                    confidence: (m.confidence * 100).toFixed(0) + '%',
                    breakdown: m.breakdown,
                })),
            },

            // Trade recommendation
            recommendation: {
                action: recommendation.action,
                side: recommendation.side,
                confidence: (recommendation.confidence * 100).toFixed(0) + '%',
                edge: (recommendation.edge > 0 ? '+' : '') + recommendation.edge.toFixed(2) + '%',
                
                // Position sizing
                positionSizing: {
                    recommended: '$' + recommendation.sizing.recommended.toLocaleString(),
                    maximum: '$' + recommendation.sizing.maximum.toLocaleString(),
                    conservativeUnit: '$' + recommendation.sizing.conservativeUnit.toLocaleString(),
                },
                
                // Execution
                execution: {
                    entryPrice: (recommendation.pricing.targetEntry * 100).toFixed(1) + '%',
                    limitPrice: (recommendation.pricing.limitPrice * 100).toFixed(1) + '%',
                    stopLoss: recommendation.pricing.stopLoss ? (recommendation.pricing.stopLoss * 100).toFixed(1) + '%' : 'Not recommended',
                    takeProfit: recommendation.pricing.takeProfit ? (recommendation.pricing.takeProfit * 100).toFixed(1) + '%' : 'Hold to resolution',
                },
                
                // Timing
                timing: {
                    urgency: recommendation.timing.urgency,
                    timeHorizon: recommendation.timing.timeHorizon,
                    exitStrategy: recommendation.timing.exitStrategy,
                },
                
                reasoning: recommendation.reasoning,
                keyFactors: recommendation.keyFactors,
            },

            // Risk assessment
            risk: {
                overallRisk: (recommendation.risk.overallRisk * 100).toFixed(0) + '%',
                
                liquidity: {
                    level: recommendation.risk.liquidityRisk.level,
                    score: recommendation.risk.liquidityRisk.score + '/10',
                },
                settlement: {
                    level: recommendation.risk.settlementRisk.level,
                    score: recommendation.risk.settlementRisk.score + '/10',
                },
                volatility: {
                    level: recommendation.risk.volatilityRisk.level,
                    score: recommendation.risk.volatilityRisk.score + '/10',
                },
                time: {
                    level: recommendation.risk.timeRisk.level,
                    score: recommendation.risk.timeRisk.score + '/10',
                    daysToExpiry,
                },
                
                riskFactors: recommendation.risk.riskFactors,
            },

            // Pre-formatted report (optional use)
            formattedReport: this.reportGenerator.generateMarkdownReport(market, recommendation),
        };
    }

    /**
     * Market comparison
     */
    private async handleComparison(input: EnhancedToolInput): Promise<any> {
        const { markets: marketInputs } = input;

        if (!marketInputs || marketInputs.length === 0) {
            return { error: 'Markets array is required' };
        }

        // Fetch all markets
        const markets: UnifiedMarket[] = [];
        for (const m of marketInputs) {
            const market = await this.marketSearch.getMarket(
                m.platform as 'kalshi' | 'polymarket',
                m.market_id
            );
            if (market) {
                markets.push(market);
            }
        }

        if (markets.length === 0) {
            return { error: 'No markets found' };
        }

        // Analyze all markets
        const analyzed = await Promise.all(
            markets.map(async market => {
                const enriched = market.category === 'sports' 
                    ? await this.sportsIntelligence.enrichSportsMarket(market)
                    : market;
                const recommendation = await this.recommendationEngine.generateRecommendation(enriched);
                return { market: enriched, recommendation };
            })
        );

        // Generate comparison report
        const report = this.reportGenerator.generateComparisonReport(analyzed);

        // Find best opportunity
        const actionable = analyzed.filter(a => a.recommendation.action !== 'WAIT');
        actionable.sort((a, b) => 
            Math.abs(b.recommendation.edge) * b.recommendation.confidence -
            Math.abs(a.recommendation.edge) * a.recommendation.confidence
        );

        return {
            comparison: analyzed.map(a => ({
                question: a.market.question,
                platform: a.market.platform,
                price: (a.market.pricing.midpoint * 100).toFixed(1) + '%',
                fairValue: (a.recommendation.analysis.fairValue * 100).toFixed(1) + '%',
                edge: (a.recommendation.edge > 0 ? '+' : '') + a.recommendation.edge.toFixed(1) + '%',
                action: a.recommendation.action + (a.recommendation.side ? ' ' + a.recommendation.side : ''),
                confidence: (a.recommendation.confidence * 100).toFixed(0) + '%',
            })),
            bestOpportunity: actionable.length > 0 ? {
                question: actionable[0].market.question,
                edge: (actionable[0].recommendation.edge > 0 ? '+' : '') + actionable[0].recommendation.edge.toFixed(1) + '%',
                reasoning: actionable[0].recommendation.reasoning,
            } : null,
            report,
        };
    }

    /**
     * Get sports intelligence
     */
    private async handleSportsIntelligence(input: EnhancedToolInput): Promise<any> {
        const { platform, market_id } = input;

        if (!platform || !market_id) {
            return { error: 'Platform and market_id are required' };
        }

        const market = await this.marketSearch.getMarket(platform as 'kalshi' | 'polymarket', market_id);
        if (!market) {
            return { error: 'Market not found' };
        }

        const enriched = await this.sportsIntelligence.enrichSportsMarket(market);

        if (!enriched.sportsContext) {
            return { error: 'Could not extract sports context from this market' };
        }

        const ctx = enriched.sportsContext;
        return {
            sport: ctx.sport,
            matchType: ctx.matchType,
            players: {
                player1: {
                    name: ctx.players.player1.name,
                    ranking: ctx.players.player1.ranking,
                    recentForm: `${ctx.players.player1.recentForm.wins}-${ctx.players.player1.recentForm.losses} (L10)`,
                    surfaceRecord: ctx.players.player1.surfaceRecord,
                },
                player2: {
                    name: ctx.players.player2.name,
                    ranking: ctx.players.player2.ranking,
                    recentForm: `${ctx.players.player2.recentForm.wins}-${ctx.players.player2.recentForm.losses} (L10)`,
                    surfaceRecord: ctx.players.player2.surfaceRecord,
                },
            },
            headToHead: ctx.headToHead,
            context: ctx.context,
            externalOdds: ctx.externalOdds ? {
                implied: (ctx.externalOdds.implied * 100).toFixed(1) + '%',
                bookmakers: ctx.externalOdds.bookmakers.length,
            } : null,
        };
    }

    /**
     * Calculate fair value
     */
    private async handleFairValue(input: EnhancedToolInput): Promise<any> {
        const { platform, market_id } = input;

        if (!platform || !market_id) {
            return { error: 'Platform and market_id are required' };
        }

        let market = await this.marketSearch.getMarket(platform as 'kalshi' | 'polymarket', market_id);
        if (!market) {
            return { error: 'Market not found' };
        }

        // Enrich if sports
        if (market.category === 'sports') {
            market = await this.sportsIntelligence.enrichSportsMarket(market);
        }

        const analysis = await this.probabilityEngine.calculateFairValue(market);
        const edgeQuality = this.probabilityEngine.calculateEdgeQuality(analysis, market);

        return {
            market: {
                question: market.question,
                currentPrice: (market.pricing.midpoint * 100).toFixed(1) + '%',
            },
            analysis: {
                fairValue: (analysis.fairValue * 100).toFixed(1) + '%',
                edge: (analysis.edge > 0 ? '+' : '') + (analysis.edge * 100).toFixed(1) + '%',
                confidence: (analysis.confidence * 100).toFixed(0) + '%',
            },
            edgeQuality: {
                quality: edgeQuality.quality,
                isSignificant: edgeQuality.isSignificant,
                reasoning: edgeQuality.reasoning,
            },
            models: analysis.models.map(m => ({
                name: m.name,
                probability: (m.probability * 100).toFixed(1) + '%',
                weight: m.weight,
                confidence: (m.confidence * 100).toFixed(0) + '%',
            })),
        };
    }

    /**
     * Assess market risk
     */
    private async handleRiskAssessment(input: EnhancedToolInput): Promise<any> {
        const { platform, market_id } = input;

        if (!platform || !market_id) {
            return { error: 'Platform and market_id are required' };
        }

        const market = await this.marketSearch.getMarket(platform as 'kalshi' | 'polymarket', market_id);
        if (!market) {
            return { error: 'Market not found' };
        }

        const risk = this.riskAssessment.assessMarket(market);
        const summary = this.riskAssessment.generateRiskSummary(risk);

        return {
            market: {
                question: market.question,
                platform: market.platform,
            },
            riskAssessment: {
                overall: (risk.overallRisk * 100).toFixed(0) + '%',
                liquidity: {
                    level: risk.liquidityRisk.level,
                    score: risk.liquidityRisk.score + '/10',
                    details: {
                        volume24h: '$' + (risk.liquidityRisk.details.volume24h || 0).toLocaleString(),
                        spread: risk.liquidityRisk.details.spreadPercent,
                        maxPosition: '$' + (risk.liquidityRisk.details.maxRecommendedPosition || 0).toLocaleString(),
                    },
                },
                settlement: {
                    level: risk.settlementRisk.level,
                    score: risk.settlementRisk.score + '/10',
                    note: risk.settlementRisk.details.settlementNote,
                },
                volatility: {
                    level: risk.volatilityRisk.level,
                    score: risk.volatilityRisk.score + '/10',
                },
                time: {
                    level: risk.timeRisk.level,
                    score: risk.timeRisk.score + '/10',
                    daysToExpiry: risk.timeRisk.details.daysToExpiry,
                },
            },
            riskFactors: risk.riskFactors,
            summary,
        };
    }

    /**
     * Find best opportunity
     */
    private async handleBestOpportunity(input: EnhancedToolInput): Promise<any> {
        const { category, platform = 'both', limit = 30, bankroll = 10000 } = input;

        this.logger.log(`Finding best opportunity: category=${category}, platform=${platform}`);

        // Determine the actual platform to query
        const platformFilter = platform === 'both' ? undefined : platform as 'kalshi' | 'polymarket';

        // Get trending/active markets
        let markets: UnifiedMarket[];
        
        if (category) {
            const parsed = await this.queryIntelligence.parseQuery(`${category} markets`);
            const filters = this.queryIntelligence.buildSearchFilters(parsed);
            filters.platform = platformFilter;
            filters.limit = limit;
            markets = await this.marketSearch.search(parsed, filters);
        } else {
            // Use the platform filter for trending markets too
            markets = await this.marketSearch.getTrendingMarkets(limit, platformFilter);
        }

        this.logger.debug(`Got ${markets.length} markets to analyze`);

        if (markets.length === 0) {
            return { 
                success: false,
                message: 'No active markets found',
                suggestion: category ? `Try searching without the ${category} filter` : 'Try different search criteria'
            };
        }

        // Find best opportunity
        const result = await this.recommendationEngine.findBestOpportunity(markets, bankroll);

        if (!result) {
            return { 
                success: false,
                message: 'No actionable opportunities found',
                marketsAnalyzed: markets.length
            };
        }

        const best = result.bestMarket;
        const rec = result.recommendation;

        return {
            success: true,
            bestOpportunity: {
                question: best.question,
                platform: best.platform.toUpperCase(),
                ticker: best.id,
                currentPrice: (best.pricing.midpoint * 100).toFixed(1) + '%',
                recommendation: `${rec.action}${rec.side ? ' ' + rec.side : ''}`,
                edge: (rec.edge > 0 ? '+' : '') + rec.edge.toFixed(1) + '%',
                confidence: (rec.confidence * 100).toFixed(0) + '%',
                positionSize: '$' + rec.sizing.recommended.toLocaleString(),
                reasoning: rec.reasoning.substring(0, 200), // Limit reasoning length
                volume24h: '$' + best.liquidity.volume24h.toLocaleString(),
                liquidity: best.liquidity.liquidityScore,
            },
            alternatives: result.alternatives.length > 0 ? result.alternatives.map(a => ({
                question: a.market.question,
                platform: a.market.platform.toUpperCase(),
                edge: (a.recommendation.edge > 0 ? '+' : '') + a.recommendation.edge.toFixed(1) + '%',
                action: a.recommendation.action,
            })) : null,
            summary: `Found ${rec.action} opportunity with ${rec.edge.toFixed(1)}% edge and ${(rec.confidence * 100).toFixed(0)}% confidence`,
            marketsAnalyzed: markets.length,
        };
    }

    /**
     * Find arbitrage opportunities
     */
    private async handleArbitrage(input: EnhancedToolInput): Promise<any> {
        const { min_spread = 3 } = input;

        const opportunities = await this.marketSearch.findArbitrage();
        const filtered = opportunities.filter(o => o.spreadPercent >= min_spread);

        if (filtered.length === 0) {
            return { message: `No arbitrage opportunities found with spread >= ${min_spread}%` };
        }

        return {
            opportunities: filtered.slice(0, 10).map(o => ({
                question: o.question,
                kalshiPrice: (o.kalshiMarket.pricing.midpoint * 100).toFixed(1) + '%',
                polymarketPrice: (o.polymarket.pricing.midpoint * 100).toFixed(1) + '%',
                spreadPercent: o.spreadPercent.toFixed(1) + '%',
                opportunity: o.opportunity,
            })),
            totalFound: filtered.length,
        };
    }

    /**
     * Quick recommendation
     */
    private async handleQuickRecommendation(input: EnhancedToolInput): Promise<any> {
        const { platform, market_id } = input;

        if (!platform || !market_id) {
            return { error: 'Platform and market_id are required' };
        }

        const market = await this.marketSearch.getMarket(platform as 'kalshi' | 'polymarket', market_id);
        if (!market) {
            return { error: 'Market not found' };
        }

        const quick = this.recommendationEngine.quickRecommendation(market);

        return {
            question: market.question,
            price: (market.pricing.midpoint * 100).toFixed(1) + '%',
            volume24h: '$' + market.liquidity.volume24h.toLocaleString(),
            action: quick.action,
            side: quick.side,
            reason: quick.reason,
        };
    }

    /**
     * Scan category for opportunities
     */
    private async handleCategoryScan(input: EnhancedToolInput): Promise<any> {
        const { category, platform = 'both', sort_by = 'volume', limit = 15 } = input;

        if (!category) {
            return { error: 'Category is required' };
        }

        this.logger.debug(`Scanning ${category} markets on ${platform}`);

        // Search by category
        const parsed = await this.queryIntelligence.parseQuery(`${category} markets`);
        const filters = this.queryIntelligence.buildSearchFilters(parsed);
        filters.platform = platform === 'both' ? undefined : platform as any;
        filters.limit = Math.min(limit * 2, 50); // Fetch more to filter down

        const markets = await this.marketSearch.search(parsed, filters);

        this.logger.debug(`Found ${markets.length} ${category} markets`);

        if (markets.length === 0) {
            return { 
                success: false,
                message: `No active ${category} markets found`,
                suggestion: platform !== 'both' ? `Try searching on both platforms` : null
            };
        }

        // Quick analysis for each
        const analyzed = markets.map(market => {
            const quick = this.recommendationEngine.quickRecommendation(market);
            
            // Safely calculate days to expiry
            let daysToExpiry = 30; // Default
            const expirationTime = market.market.expirationTime;
            if (expirationTime && !isNaN(expirationTime.getTime())) {
                daysToExpiry = Math.ceil(
                    (expirationTime.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );
            }
            
            return {
                question: market.question.substring(0, 100), // Truncate long questions
                platform: market.platform.toUpperCase(),
                ticker: market.id,
                price: (market.pricing.midpoint * 100).toFixed(1) + '%',
                volume24h: market.liquidity.volume24h || 0,
                liquidity: market.liquidity.liquidityScore,
                daysToExpiry,
                quickAction: quick.action,
                quickReason: quick.reason,
            };
        });

        // Sort
        if (sort_by === 'volume') {
            analyzed.sort((a, b) => b.volume24h - a.volume24h);
        } else if (sort_by === 'expiry') {
            analyzed.sort((a, b) => a.daysToExpiry - b.daysToExpiry);
        }

        // Filter out very low volume
        const filtered = analyzed.filter(m => m.volume24h > 10);
        const topMarkets = filtered.slice(0, limit);

        return {
            success: true,
            category,
            platform,
            totalMarkets: markets.length,
            marketsShown: topMarkets.length,
            markets: topMarkets.map(m => ({
                ...m,
                volume24h: '$' + m.volume24h.toLocaleString(),
            })),
            summary: `Found ${topMarkets.length} ${category} markets sorted by ${sort_by}`,
        };
    }

    /**
     * Generate report
     */
    private async handleGenerateReport(input: EnhancedToolInput): Promise<any> {
        const { platform, market_id, format = 'markdown', bankroll = 10000 } = input;

        if (!platform || !market_id) {
            return { error: 'Platform and market_id are required' };
        }

        let market = await this.marketSearch.getMarket(platform as 'kalshi' | 'polymarket', market_id);
        if (!market) {
            return { error: 'Market not found' };
        }

        // Enrich if sports
        if (market.category === 'sports') {
            market = await this.sportsIntelligence.enrichSportsMarket(market);
        }

        const recommendation = await this.recommendationEngine.generateRecommendation(market, bankroll);

        let report: string;
        if (format === 'full') {
            report = this.reportGenerator.generateMarketReport(market, recommendation);
        } else if (format === 'quick') {
            report = this.reportGenerator.generateQuickSummary(market, recommendation);
        } else {
            report = this.reportGenerator.generateMarkdownReport(market, recommendation);
        }

        return { report };
    }

    /**
     * Helper to summarize market
     */
    private summarizeMarket(market: UnifiedMarket): any {
        // Safely calculate days to expiry
        let expiresIn = 'Unknown';
        const expirationTime = market.market.expirationTime;
        if (expirationTime && !isNaN(expirationTime.getTime())) {
            const days = Math.ceil(
                (expirationTime.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            expiresIn = days > 0 ? `${days} days` : 'Expired';
        }

        return {
            id: market.id,
            platform: market.platform,
            question: market.question,
            category: market.category,
            price: (market.pricing.midpoint * 100).toFixed(1) + '%',
            spread: (market.pricing.spread * 100).toFixed(1) + '%',
            volume24h: '$' + (market.liquidity.volume24h || 0).toLocaleString(),
            liquidity: market.liquidity.liquidityScore,
            expiresIn,
        };
    }

    /**
     * Check if a tool is an enhanced tool
     */
    isEnhancedTool(toolName: string): boolean {
        const enhancedTools = [
            'intelligent_search',
            'analyze_market_deep',
            'compare_markets_detailed',
            'get_sports_intelligence',
            'calculate_fair_value',
            'assess_market_risk',
            'find_best_opportunity',
            'find_arbitrage',
            'quick_recommendation',
            'scan_category',
            'generate_report',
        ];
        return enhancedTools.includes(toolName);
    }
}
