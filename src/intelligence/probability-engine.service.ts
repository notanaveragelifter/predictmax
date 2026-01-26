/**
 * Probability Engine
 * 
 * Multi-model ensemble for calculating fair value probabilities:
 * - Market consensus model
 * - Statistical models (sport-specific)
 * - External odds model
 * - Historical pattern model
 * 
 * Combines models with confidence-weighted averaging
 */

import { Injectable, Logger } from '@nestjs/common';
import { SportsIntelligenceService } from './sports-intelligence.service';
import {
    UnifiedMarket,
    ProbabilityAnalysis,
    ProbabilityModel,
    ProbabilityBreakdown,
    SportsContext,
    CryptoContext,
    PoliticsContext,
} from './types';

@Injectable()
export class ProbabilityEngine {
    private readonly logger = new Logger(ProbabilityEngine.name);

    constructor(private sportsIntelligence: SportsIntelligenceService) {}

    /**
     * Calculate fair value probability for a market
     */
    async calculateFairValue(market: UnifiedMarket): Promise<ProbabilityAnalysis> {
        const models: ProbabilityModel[] = [];

        // Model 1: Market consensus (current prices)
        const marketConsensus = this.calculateMarketConsensus(market);
        models.push(marketConsensus);

        // Model 2: Domain-specific statistical model
        if (market.category === 'sports' && market.sportsContext) {
            const sportsModel = this.calculateSportsModel(market, market.sportsContext);
            models.push(sportsModel);
        } else if (market.category === 'crypto' && market.cryptoContext) {
            const cryptoModel = this.calculateCryptoModel(market, market.cryptoContext);
            models.push(cryptoModel);
        } else if (market.category === 'politics' && market.politicsContext) {
            const politicsModel = this.calculatePoliticsModel(market, market.politicsContext);
            models.push(politicsModel);
        }

        // Model 3: External odds (if available for sports)
        if (market.sportsContext?.externalOdds) {
            const externalModel = this.calculateExternalOddsModel(market);
            models.push(externalModel);
        }

        // Model 4: Historical patterns
        const historicalModel = await this.calculateHistoricalModel(market);
        if (historicalModel) {
            models.push(historicalModel);
        }

        // Calculate ensemble fair value
        const fairValue = this.weightedEnsemble(models);
        const confidence = this.calculateOverallConfidence(models);
        const edge = fairValue - market.pricing.midpoint;

        // Build breakdown
        const breakdown: ProbabilityBreakdown = {
            marketConsensus: marketConsensus.probability,
            statisticalModel: models.find(m => m.name === 'sports_statistical' || m.name === 'crypto_statistical' || m.name === 'politics_statistical')?.probability || marketConsensus.probability,
            externalOdds: models.find(m => m.name === 'external_odds')?.probability,
            historicalPattern: models.find(m => m.name === 'historical_pattern')?.probability,
        };

        return {
            fairValue,
            models,
            edge,
            confidence,
            breakdown,
        };
    }

    /**
     * Market consensus model - uses current market prices
     */
    private calculateMarketConsensus(market: UnifiedMarket): ProbabilityModel {
        const probability = market.pricing.midpoint;
        
        // Confidence based on liquidity
        let confidence = 0.5;
        if (market.liquidity.liquidityScore === 'HIGH') {
            confidence = 0.85;
        } else if (market.liquidity.liquidityScore === 'MEDIUM') {
            confidence = 0.7;
        }

        // Adjust confidence based on spread
        const spreadAdjustment = Math.max(0, 0.1 - market.pricing.spread) * 2;
        confidence = Math.min(0.95, confidence + spreadAdjustment);

        return {
            name: 'market_consensus',
            probability,
            weight: 0.3,
            confidence,
            breakdown: {
                yesBid: market.pricing.yesBid,
                yesAsk: market.pricing.yesAsk,
                midpoint: market.pricing.midpoint,
                spread: market.pricing.spread,
                liquidityScore: market.liquidity.liquidityScore,
            },
        };
    }

    /**
     * Sports statistical model
     */
    private calculateSportsModel(market: UnifiedMarket, context: SportsContext): ProbabilityModel {
        const probability = this.sportsIntelligence.calculateSportsProbability(context);
        
        // Confidence based on data quality
        let confidence = 0.6;
        
        // Higher confidence if we have good data
        if (context.players.player1.ranking && context.players.player2.ranking) {
            confidence += 0.1;
        }
        
        if (context.headToHead.overall !== '0-0 (First meeting)') {
            confidence += 0.1;
        }

        if (context.externalOdds?.bookmakers?.length > 0) {
            confidence += 0.05;
        }

        return {
            name: 'sports_statistical',
            probability,
            weight: 0.35,
            confidence: Math.min(0.9, confidence),
            breakdown: {
                sport: context.sport,
                player1Ranking: context.players.player1.ranking,
                player2Ranking: context.players.player2.ranking,
                h2h: context.headToHead.overall,
                surface: context.context.surface,
            },
        };
    }

    /**
     * Crypto statistical model
     */
    private calculateCryptoModel(market: UnifiedMarket, context: CryptoContext): ProbabilityModel {
        // Calculate probability based on distance to threshold and volatility
        const { currentPrice, threshold, analysis } = context;
        
        if (!threshold) {
            // If no threshold, use market price
            return {
                name: 'crypto_statistical',
                probability: market.pricing.midpoint,
                weight: 0.25,
                confidence: 0.4,
            };
        }

        // Use volatility and distance to estimate probability
        const distancePercent = ((threshold - currentPrice) / currentPrice) * 100;
        const volatility = analysis.historicalVolatility || 0.05;
        const daysToExpiry = analysis.daysToExpiry || 30;
        
        // Simple model: probability based on distance relative to expected move
        const expectedMove = volatility * Math.sqrt(daysToExpiry / 365) * currentPrice;
        const zScore = Math.abs(threshold - currentPrice) / expectedMove;
        
        // Convert z-score to probability using normal CDF approximation
        const probability = threshold > currentPrice 
            ? 1 - this.normalCDF(zScore)
            : this.normalCDF(-zScore);

        return {
            name: 'crypto_statistical',
            probability,
            weight: 0.35,
            confidence: 0.65,
            breakdown: {
                currentPrice,
                threshold,
                distancePercent,
                volatility,
                daysToExpiry,
                zScore,
            },
        };
    }

    /**
     * Politics model based on polls, expert forecasts, and policy analysis
     */
    private calculatePoliticsModel(market: UnifiedMarket, context: PoliticsContext): ProbabilityModel {
        let probability = market.pricing.midpoint;
        let confidence = 0.5;
        let rationale = 'Market consensus';

        // Use polling average if available
        if (context.polls?.average) {
            probability = context.polls.average / 100;
            confidence = 0.7;
            rationale = `Based on polling average: ${context.polls.average}%`;
        }

        // Weight in expert forecasts
        const forecasts = context.expertForecasts;
        if (forecasts.fiveThirtyEight || forecasts.economist) {
            const expertProbs: number[] = [];
            
            if (forecasts.fiveThirtyEight?.probability) {
                expertProbs.push(forecasts.fiveThirtyEight.probability);
            }
            if (forecasts.economist?.probability) {
                expertProbs.push(forecasts.economist.probability);
            }

            if (expertProbs.length > 0) {
                const avgExpert = expertProbs.reduce((a, b) => a + b, 0) / expertProbs.length;
                probability = (probability * 0.4) + (avgExpert * 0.6);
                confidence = 0.8;
                rationale = `Blended polls and ${expertProbs.length} expert forecasts`;
            }
        }

        return {
            name: 'politics_statistical',
            probability,
            weight: 0.4,
            confidence,
            breakdown: {
                pollAverage: context.polls?.average,
                pollTrend: context.polls?.trend,
                forecasts: context.expertForecasts,
                rationale,
            },
        };
    }

    /**
     * General politics baseline model (when no external data available)
     * Analyzes market question to estimate baseline probability
     */
    calculatePoliticsBaseline(market: UnifiedMarket): ProbabilityModel {
        const question = market.question.toLowerCase();
        let probability = 0.5;
        let rationale = 'Neutral baseline - insufficient context';
        let confidence = 0.4;

        // Analyze question for probability hints
        // Higher confidence for more specific questions
        
        // Policy implementation questions
        if (question.includes('will') && (question.includes('pass') || question.includes('sign'))) {
            // Bills/policies passing
            if (question.includes('congress') || question.includes('senate') || question.includes('house')) {
                probability = 0.35; // Most bills fail
                rationale = 'Historical: ~4% of bills become law';
                confidence = 0.6;
            }
        }
        
        // Executive action questions
        if (question.includes('executive order') || question.includes('executive action')) {
            probability = 0.7; // Presidents usually follow through
            rationale = 'Executive actions have high implementation rate';
            confidence = 0.65;
        }
        
        // Court ruling questions
        if (question.includes('supreme court') || question.includes('court ruling')) {
            probability = 0.5; // Truly uncertain
            rationale = 'Court rulings highly case-dependent';
            confidence = 0.45;
        }

        return {
            name: 'politics_baseline',
            probability,
            weight: 0.25,
            confidence,
            breakdown: { rationale },
        };
    }

    /**
     * External odds model for sports
     */
    private calculateExternalOddsModel(market: UnifiedMarket): ProbabilityModel {
        const externalOdds = market.sportsContext?.externalOdds;
        
        if (!externalOdds?.bookmakers?.length) {
            return {
                name: 'external_odds',
                probability: market.pricing.midpoint,
                weight: 0.15,
                confidence: 0.3,
            };
        }

        // Average implied probability from bookmakers
        const impliedProbs = externalOdds.bookmakers.map(b => b.implied1);
        const avgImplied = impliedProbs.reduce((a, b) => a + b, 0) / impliedProbs.length;

        // Higher confidence with more bookmakers
        const confidence = Math.min(0.85, 0.6 + (externalOdds.bookmakers.length * 0.05));

        return {
            name: 'external_odds',
            probability: avgImplied,
            weight: 0.25,
            confidence,
            breakdown: {
                numBookmakers: externalOdds.bookmakers.length,
                impliedProbability: avgImplied,
                bookmakers: externalOdds.bookmakers.map(b => b.bookmaker),
            },
        };
    }

    /**
     * Historical pattern model - uses domain-specific historical baselines
     */
    private async calculateHistoricalModel(market: UnifiedMarket): Promise<ProbabilityModel | null> {
        const question = market.question.toLowerCase();
        
        // Politics: Deportation/Immigration markets
        if (market.category === 'politics' && 
            (question.includes('deport') || question.includes('immigration') || question.includes('ice'))) {
            return this.calculateDeportationHistoricalModel(market);
        }
        
        // Politics: Election markets
        if (market.category === 'politics' && 
            (question.includes('election') || question.includes('win') || question.includes('president'))) {
            return this.calculateElectionHistoricalModel(market);
        }
        
        // Crypto: Price threshold markets
        if (market.category === 'crypto' && 
            (question.includes('bitcoin') || question.includes('btc') || question.includes('eth'))) {
            return this.calculateCryptoHistoricalModel(market);
        }
        
        return null;
    }

    /**
     * Historical model for deportation markets
     * Based on DHS/ICE historical data
     */
    private calculateDeportationHistoricalModel(market: UnifiedMarket): ProbabilityModel {
        const question = market.question.toLowerCase();
        
        // Historical deportation data (annual averages)
        // Obama (2009-2016): ~375K/year, range 350K-410K
        // Trump (2017-2020): ~234K/year, range 226K-267K (COVID impacted 2020)
        // Biden (2021-2024): ~375K/year, range 72K-468K (high variance)
        
        // Parse threshold from question
        let probability = 0.5; // default
        let rationale = 'Historical baseline';
        
        // Common deportation market ranges
        if (question.includes('250,000') || question.includes('250k') || question.includes('250000')) {
            if (question.includes('500,000') || question.includes('500k') || question.includes('500000')) {
                // 250K-500K range
                probability = 0.45; // Most common historical range
                rationale = 'Historical avg falls in this range (375K/yr). 65% of years hit this range.';
            } else if (question.includes('less than') || question.includes('under') || question.includes('fewer')) {
                // Under 250K
                probability = 0.15;
                rationale = 'Only Trump COVID years (2020) fell below 250K.';
            }
        } else if (question.includes('500,000') || question.includes('500k')) {
            if (question.includes('750,000') || question.includes('750k')) {
                // 500K-750K range
                probability = 0.25;
                rationale = 'Above historical avg. Would require policy escalation.';
            } else if (question.includes('1,000,000') || question.includes('1m') || question.includes('million')) {
                // 500K-1M range
                probability = 0.10;
                rationale = 'Significantly above all historical precedent.';
            }
        } else if (question.includes('over') || question.includes('more than') || question.includes('exceed')) {
            if (question.includes('1,000,000') || question.includes('1m') || question.includes('million')) {
                probability = 0.05;
                rationale = 'No administration has achieved >1M annual deportations.';
            }
        }
        
        return {
            name: 'historical_baseline',
            probability,
            weight: 0.35,
            confidence: 0.75,
            breakdown: {
                rationale,
                historicalData: {
                    obamaAvg: '375K/year',
                    trumpAvg: '234K/year',
                    bidenAvg: '375K/year',
                },
                dataSource: 'DHS/ICE Statistics',
            },
        };
    }

    /**
     * Historical model for election markets
     */
    private calculateElectionHistoricalModel(market: UnifiedMarket): ProbabilityModel {
        const question = market.question.toLowerCase();
        
        // Default incumbent advantage
        let probability = 0.55;
        let rationale = 'Incumbent advantage historical baseline';
        
        // Adjust based on market specifics
        if (question.includes('incumbent') || question.includes('reelection')) {
            probability = 0.65;
            rationale = 'Incumbents win ~65% of presidential elections historically';
        }
        
        return {
            name: 'historical_baseline',
            probability,
            weight: 0.2,
            confidence: 0.6,
            breakdown: {
                rationale,
                incumbentWinRate: '65%',
                dataSource: 'Historical US Elections',
            },
        };
    }

    /**
     * Historical model for crypto threshold markets
     */
    private calculateCryptoHistoricalModel(market: UnifiedMarket): ProbabilityModel {
        const question = market.question.toLowerCase();
        
        // Extract threshold from question
        const priceMatch = question.match(/\$?([\d,]+)(?:k|K)?/);
        let threshold = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : null;
        if (priceMatch && (priceMatch[0].includes('k') || priceMatch[0].includes('K'))) {
            threshold = threshold ? threshold * 1000 : null;
        }
        
        // BTC historical context
        if (question.includes('bitcoin') || question.includes('btc')) {
            // BTC has ~80% annual volatility
            // ATH awareness - markets near ATH have different dynamics
            const isHighTarget = threshold && threshold > 100000;
            
            return {
                name: 'historical_baseline',
                probability: isHighTarget ? 0.3 : 0.5,
                weight: 0.2,
                confidence: 0.5,
                breakdown: {
                    rationale: isHighTarget 
                        ? 'Target above ATH - historically challenging'
                        : 'Within historical range',
                    volatility: '~80% annual',
                    dataSource: 'Historical BTC data',
                },
            };
        }
        
        return {
            name: 'historical_baseline',
            probability: 0.5,
            weight: 0.15,
            confidence: 0.4,
        };
    }

    /**
     * Weighted ensemble of probability models
     */
    private weightedEnsemble(models: ProbabilityModel[]): number {
        if (models.length === 0) return 0.5;

        // Normalize weights based on confidence
        const adjustedModels = models.map(m => ({
            ...m,
            adjustedWeight: m.weight * m.confidence,
        }));

        const totalWeight = adjustedModels.reduce((sum, m) => sum + m.adjustedWeight, 0);
        
        if (totalWeight === 0) {
            // Fallback to simple average
            return models.reduce((sum, m) => sum + m.probability, 0) / models.length;
        }

        // Weighted average
        const fairValue = adjustedModels.reduce(
            (sum, m) => sum + (m.probability * m.adjustedWeight),
            0
        ) / totalWeight;

        // Clamp to valid probability range
        return Math.max(0.01, Math.min(0.99, fairValue));
    }

    /**
     * Calculate overall confidence from model ensemble
     */
    private calculateOverallConfidence(models: ProbabilityModel[]): number {
        if (models.length === 0) return 0;

        // Weighted average of confidence
        const totalWeight = models.reduce((sum, m) => sum + m.weight, 0);
        const weightedConfidence = models.reduce(
            (sum, m) => sum + (m.confidence * m.weight),
            0
        ) / totalWeight;

        // Adjust for model agreement
        const probabilities = models.map(m => m.probability);
        const avgProb = probabilities.reduce((a, b) => a + b, 0) / probabilities.length;
        const variance = probabilities.reduce(
            (sum, p) => sum + Math.pow(p - avgProb, 2),
            0
        ) / probabilities.length;

        // Lower confidence if models disagree
        const agreementFactor = Math.max(0.5, 1 - (variance * 10));

        return Math.min(0.95, weightedConfidence * agreementFactor);
    }

    /**
     * Normal CDF approximation (for crypto model)
     */
    private normalCDF(x: number): number {
        // Approximation of standard normal CDF
        const a1 =  0.254829592;
        const a2 = -0.284496736;
        const a3 =  1.421413741;
        const a4 = -1.453152027;
        const a5 =  1.061405429;
        const p  =  0.3275911;

        const sign = x < 0 ? -1 : 1;
        x = Math.abs(x) / Math.sqrt(2);

        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

        return 0.5 * (1.0 + sign * y);
    }

    /**
     * Calculate edge quality metrics
     */
    calculateEdgeQuality(analysis: ProbabilityAnalysis, market: UnifiedMarket): {
        edgePercent: number;
        isSignificant: boolean;
        quality: 'LOW' | 'MEDIUM' | 'HIGH';
        reasoning: string;
    } {
        const edgePercent = (analysis.edge / market.pricing.midpoint) * 100;
        const absEdge = Math.abs(analysis.edge) * 100;

        // Determine if edge is significant
        const isSignificant = absEdge > 3 && analysis.confidence > 0.6;

        // Quality assessment
        let quality: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
        let reasoning = '';

        if (absEdge < 2) {
            quality = 'LOW';
            reasoning = 'Edge is too small to be actionable after transaction costs';
        } else if (absEdge < 5) {
            if (analysis.confidence > 0.75) {
                quality = 'MEDIUM';
                reasoning = 'Moderate edge with good confidence';
            } else {
                quality = 'LOW';
                reasoning = 'Small edge with insufficient confidence';
            }
        } else if (absEdge < 10) {
            if (analysis.confidence > 0.7) {
                quality = 'HIGH';
                reasoning = 'Good edge with solid model agreement';
            } else {
                quality = 'MEDIUM';
                reasoning = 'Good edge but models show some disagreement';
            }
        } else {
            if (analysis.confidence > 0.65) {
                quality = 'HIGH';
                reasoning = 'Large edge detected - verify market conditions';
            } else {
                quality = 'MEDIUM';
                reasoning = 'Large edge but low confidence - investigate further';
            }
        }

        return {
            edgePercent,
            isSignificant,
            quality,
            reasoning,
        };
    }

    /**
     * Compare fair values across markets
     */
    async compareMarkets(markets: UnifiedMarket[]): Promise<Array<{
        market: UnifiedMarket;
        analysis: ProbabilityAnalysis;
        edgeQuality: any;
    }>> {
        const results = await Promise.all(
            markets.map(async market => {
                const analysis = await this.calculateFairValue(market);
                const edgeQuality = this.calculateEdgeQuality(analysis, market);
                return { market, analysis, edgeQuality };
            })
        );

        // Sort by edge quality
        return results.sort((a, b) => {
            const qualityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
            if (qualityOrder[a.edgeQuality.quality] !== qualityOrder[b.edgeQuality.quality]) {
                return qualityOrder[b.edgeQuality.quality] - qualityOrder[a.edgeQuality.quality];
            }
            return Math.abs(b.analysis.edge) - Math.abs(a.analysis.edge);
        });
    }
}
