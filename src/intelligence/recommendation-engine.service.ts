/**
 * Recommendation Engine
 * 
 * Generates actionable trade recommendations by combining:
 * - Probability analysis (fair value calculation)
 * - Risk assessment
 * - Position sizing
 * - Entry/exit strategies
 */

import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '../config/config.service';
import { ProbabilityEngine } from './probability-engine.service';
import { RiskAssessmentService } from './risk-assessment.service';
import {
    UnifiedMarket,
    TradeRecommendation,
    ProbabilityAnalysis,
    RiskAssessment,
    AlternativeMarket,
} from './types';

@Injectable()
export class RecommendationEngine {
    private readonly logger = new Logger(RecommendationEngine.name);
    private anthropic: Anthropic;

    constructor(
        private configService: ConfigService,
        private probabilityEngine: ProbabilityEngine,
        private riskAssessment: RiskAssessmentService,
    ) {
        const apiKey = this.configService?.anthropicApiKey || '';
        if (!apiKey) {
            this.logger.warn('ANTHROPIC_API_KEY is missing. AI recommendations will fail at runtime.');
        }
        this.anthropic = new Anthropic({
            apiKey: apiKey || 'placeholder',
        });
    }

    /**
     * Generate a comprehensive trade recommendation for a market
     */
    async generateRecommendation(
        market: UnifiedMarket,
        bankroll: number = 10000
    ): Promise<TradeRecommendation> {
        // Calculate fair value and risk
        const analysis = await this.probabilityEngine.calculateFairValue(market);
        const risk = this.riskAssessment.assessMarket(market);

        // Determine action based on edge and risk
        const { action, side, confidence } = this.determineAction(analysis, risk, market);

        // Calculate position sizing
        const sizing = this.riskAssessment.calculatePositionSize(
            risk,
            analysis.edge,
            analysis.confidence,
            bankroll
        );

        // Calculate pricing targets
        const pricing = this.calculatePricing(market, action, side, risk);

        // Calculate timing
        const timing = this.calculateTiming(market, analysis, risk, action);

        // Generate AI reasoning
        const reasoning = await this.generateReasoning(market, analysis, risk, action, side);

        // Extract key factors and risks
        const keyFactors = this.extractKeyFactors(market, analysis);
        const risks = risk.riskFactors;

        return {
            action,
            side: side || undefined,
            confidence,
            edge: analysis.edge * 100, // Convert to percentage
            analysis,
            risk,
            sizing: {
                recommended: Math.round(sizing.recommended),
                maximum: Math.round(sizing.maxPosition),
                conservativeUnit: Math.round(sizing.quarterKelly),
                kellyFraction: sizing.kellyFraction,
            },
            pricing,
            timing,
            reasoning,
            keyFactors,
            risks,
        };
    }

    /**
     * Determine trading action based on analysis
     */
    private determineAction(
        analysis: ProbabilityAnalysis,
        risk: RiskAssessment,
        market: UnifiedMarket
    ): { action: 'BUY' | 'SELL' | 'WAIT'; side: 'YES' | 'NO' | null; confidence: number } {
        const edge = analysis.edge;
        const edgePercent = Math.abs(edge) * 100;
        const confidence = analysis.confidence;

        // Minimum thresholds for action
        const MIN_EDGE_PERCENT = 3; // 3% minimum edge
        const MIN_CONFIDENCE = 0.55;
        const HIGH_RISK_THRESHOLD = 0.7;

        // Check if risk is too high
        if (risk.overallRisk > HIGH_RISK_THRESHOLD) {
            return {
                action: 'WAIT',
                side: null,
                confidence: 0,
            };
        }

        // Check if edge is significant
        if (edgePercent < MIN_EDGE_PERCENT || confidence < MIN_CONFIDENCE) {
            return {
                action: 'WAIT',
                side: null,
                confidence: 0,
            };
        }

        // Check liquidity
        if (risk.liquidityRisk.level === 'HIGH' && edgePercent < 8) {
            return {
                action: 'WAIT',
                side: null,
                confidence: 0,
            };
        }

        // Determine side based on edge direction
        let action: 'BUY' | 'SELL' = 'BUY';
        let side: 'YES' | 'NO';

        if (edge > 0) {
            // Fair value > market price → undervalued → BUY YES
            side = 'YES';
        } else {
            // Fair value < market price → overvalued → BUY NO
            side = 'NO';
        }

        // Calculate adjusted confidence
        const adjustedConfidence = confidence * (1 - risk.overallRisk);

        return {
            action,
            side,
            confidence: adjustedConfidence,
        };
    }

    /**
     * Calculate pricing targets
     */
    private calculatePricing(
        market: UnifiedMarket,
        action: 'BUY' | 'SELL' | 'WAIT',
        side: 'YES' | 'NO' | null,
        risk: RiskAssessment
    ): TradeRecommendation['pricing'] {
        if (action === 'WAIT' || !side) {
            return {
                targetEntry: 0,
                limitPrice: 0,
                expectedSlippage: 0,
            };
        }

        const expectedSlippage = risk.liquidityRisk.details.expectedSlippage || 0.01;

        let targetEntry: number;
        let limitPrice: number;

        if (side === 'YES') {
            targetEntry = market.pricing.yesBid;
            limitPrice = market.pricing.yesAsk + expectedSlippage;
        } else {
            targetEntry = market.pricing.noBid;
            limitPrice = market.pricing.noAsk + expectedSlippage;
        }

        // Calculate stop loss and take profit
        const stopLoss = side === 'YES'
            ? Math.max(0.01, targetEntry - 0.15) // 15 cent stop
            : Math.max(0.01, targetEntry - 0.15);

        const takeProfit = side === 'YES'
            ? Math.min(0.99, targetEntry + 0.20) // 20 cent target
            : Math.min(0.99, targetEntry + 0.20);

        return {
            targetEntry,
            limitPrice,
            expectedSlippage,
            stopLoss,
            takeProfit,
        };
    }

    /**
     * Calculate timing recommendations
     */
    private calculateTiming(
        market: UnifiedMarket,
        analysis: ProbabilityAnalysis,
        risk: RiskAssessment,
        action: 'BUY' | 'SELL' | 'WAIT'
    ): TradeRecommendation['timing'] {
        const edgePercent = Math.abs(analysis.edge) * 100;
        const daysToExpiry = risk.timeRisk.details.daysToExpiry || 30;

        // Determine urgency
        let urgency: 'LOW' | 'MEDIUM' | 'HIGH';
        if (edgePercent > 10 && daysToExpiry < 7) {
            urgency = 'HIGH';
        } else if (edgePercent > 5 || daysToExpiry < 14) {
            urgency = 'MEDIUM';
        } else {
            urgency = 'LOW';
        }

        // Time horizon
        let timeHorizon: string;
        if (daysToExpiry < 1) {
            timeHorizon = 'Intraday';
        } else if (daysToExpiry < 7) {
            timeHorizon = `${daysToExpiry} days`;
        } else if (daysToExpiry < 30) {
            timeHorizon = `${Math.ceil(daysToExpiry / 7)} weeks`;
        } else {
            timeHorizon = `${Math.ceil(daysToExpiry / 30)} months`;
        }

        // Exit strategy
        let exitStrategy: string;
        if (daysToExpiry < 3) {
            exitStrategy = 'Hold to settlement unless stop loss hit';
        } else if (daysToExpiry < 14) {
            exitStrategy = 'Scale out at +10-15%, full exit at +20% or stop loss';
        } else {
            exitStrategy = 'Trail stop at 50% of gains, re-evaluate weekly';
        }

        // Optimal entry
        let optimalEntry: string;
        if (urgency === 'HIGH') {
            optimalEntry = 'Enter now with limit order at ask price';
        } else if (risk.liquidityRisk.level === 'HIGH') {
            optimalEntry = 'Use limit orders over multiple days to build position';
        } else {
            optimalEntry = 'Enter with limit order at mid-price, adjust if not filled within 1 hour';
        }

        return {
            urgency,
            timeHorizon,
            exitStrategy,
            optimalEntry,
        };
    }

    /**
     * Generate AI reasoning for the recommendation
     */
    private async generateReasoning(
        market: UnifiedMarket,
        analysis: ProbabilityAnalysis,
        risk: RiskAssessment,
        action: 'BUY' | 'SELL' | 'WAIT',
        side: 'YES' | 'NO' | null
    ): Promise<string> {
        try {
            const prompt = `Generate a 2-3 sentence professional explanation for this prediction market recommendation.

MARKET: ${market.question}
Platform: ${market.platform}
Current Price: ${(market.pricing.midpoint * 100).toFixed(1)}%

ANALYSIS:
Fair Value: ${(analysis.fairValue * 100).toFixed(1)}%
Edge: ${analysis.edge > 0 ? '+' : ''}${(analysis.edge * 100).toFixed(1)}%
Confidence: ${(analysis.confidence * 100).toFixed(0)}%

Models Used:
${analysis.models.map(m => `- ${m.name}: ${(m.probability * 100).toFixed(1)}% (confidence: ${(m.confidence * 100).toFixed(0)}%)`).join('\n')}

RISK:
Liquidity: ${risk.liquidityRisk.level}
Overall Risk: ${(risk.overallRisk * 100).toFixed(0)}%
${risk.riskFactors.length > 0 ? `Key Risks: ${risk.riskFactors.join('; ')}` : ''}

RECOMMENDATION: ${action}${side ? ` ${side}` : ''}

Provide a clear, professional explanation citing specific factors. Do not use phrases like "I recommend" - be direct and factual.`;

            const response = await this.anthropic.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 300,
                messages: [{ role: 'user', content: prompt }],
            });

            const content = response.content[0];
            if (content.type === 'text') {
                return content.text;
            }
        } catch (error) {
            this.logger.error('Failed to generate AI reasoning:', error);
        }

        // Fallback reasoning
        if (action === 'WAIT') {
            return `Current market conditions do not present a clear opportunity. Edge of ${(analysis.edge * 100).toFixed(1)}% is below threshold or risk factors are too high.`;
        }

        return `${action} ${side} based on ${(Math.abs(analysis.edge) * 100).toFixed(1)}% edge. Fair value of ${(analysis.fairValue * 100).toFixed(1)}% vs market price of ${(market.pricing.midpoint * 100).toFixed(1)}% suggests market is ${analysis.edge > 0 ? 'undervalued' : 'overvalued'}.`;
    }

    /**
     * Extract key factors from analysis
     */
    private extractKeyFactors(market: UnifiedMarket, analysis: ProbabilityAnalysis): string[] {
        const factors: string[] = [];

        // Model-specific factors
        for (const model of analysis.models) {
            if (model.name === 'sports_statistical' && model.breakdown) {
                if (model.breakdown.h2h) {
                    factors.push(`Head-to-head: ${model.breakdown.h2h}`);
                }
                if (model.breakdown.player1Ranking && model.breakdown.player2Ranking) {
                    factors.push(`Rankings: #${model.breakdown.player1Ranking} vs #${model.breakdown.player2Ranking}`);
                }
                if (model.breakdown.surface) {
                    factors.push(`Surface: ${model.breakdown.surface}`);
                }
            }

            if (model.name === 'external_odds' && model.breakdown) {
                factors.push(`External odds imply: ${(model.breakdown.impliedProbability * 100).toFixed(1)}%`);
            }

            if (model.name === 'market_consensus' && model.breakdown) {
                factors.push(`Spread: ${model.breakdown.spreadPercent}`);
                factors.push(`Liquidity: ${model.breakdown.liquidityScore}`);
            }
        }

        // Market-specific factors
        if (market.sportsContext) {
            const ctx = market.sportsContext;
            if (ctx.players.player1.recentForm) {
                factors.push(`${ctx.players.player1.name} form: ${ctx.players.player1.recentForm.wins}-${ctx.players.player1.recentForm.losses} (L10)`);
            }
        }

        return factors.slice(0, 6); // Limit to 6 key factors
    }

    /**
     * Generate recommendations for multiple markets and find best opportunity
     */
    async findBestOpportunity(
        markets: UnifiedMarket[],
        bankroll: number = 10000
    ): Promise<{
        bestMarket: UnifiedMarket;
        recommendation: TradeRecommendation;
        alternatives: Array<{ market: UnifiedMarket; recommendation: TradeRecommendation }>;
    } | null> {
        if (markets.length === 0) return null;

        this.logger.debug(`Finding best opportunity from ${markets.length} markets`);

        // Step 1: Use quick recommendations to filter down to promising markets
        const quickFiltered = markets
            .map(market => ({
                market,
                quick: this.quickRecommendation(market),
            }))
            .filter(m => m.quick.action !== 'WAIT')
            .sort((a, b) => b.market.liquidity.volume24h - a.market.liquidity.volume24h)
            .slice(0, 10); // Only analyze top 10 most liquid actionable markets

        this.logger.debug(`Quick filter: ${quickFiltered.length} actionable markets from ${markets.length}`);

        if (quickFiltered.length === 0) {
            // If no actionable markets, return the highest volume market with a WAIT
            const best = markets.sort((a, b) => b.liquidity.volume24h - a.liquidity.volume24h)[0];
            return {
                bestMarket: best,
                recommendation: await this.generateRecommendation(best, bankroll),
                alternatives: [],
            };
        }

        // Step 2: Deep analysis on filtered markets
        const recommendations = await Promise.all(
            quickFiltered.map(async ({ market }) => ({
                market,
                recommendation: await this.generateRecommendation(market, bankroll),
            }))
        );

        this.logger.debug(`Generated ${recommendations.length} deep recommendations`);

        // Filter to actionable recommendations from deep analysis
        const actionable = recommendations.filter(r => r.recommendation.action !== 'WAIT');

        if (actionable.length === 0) {
            // Return the best WAIT recommendation if no actionable
            const sorted = recommendations.sort(
                (a, b) => Math.abs(b.recommendation.edge) - Math.abs(a.recommendation.edge)
            );
            return {
                bestMarket: sorted[0].market,
                recommendation: sorted[0].recommendation,
                alternatives: sorted.slice(1, 3),
            };
        }

        // Sort by edge * confidence (expected value)
        actionable.sort((a, b) => {
            const evA = Math.abs(a.recommendation.edge) * a.recommendation.confidence;
            const evB = Math.abs(b.recommendation.edge) * b.recommendation.confidence;
            return evB - evA;
        });

        this.logger.debug(`Best opportunity: ${actionable[0].market.question} (edge: ${actionable[0].recommendation.edge.toFixed(2)}%)`);

        return {
            bestMarket: actionable[0].market,
            recommendation: actionable[0].recommendation,
            alternatives: actionable.slice(1, 3),
        };
    }

    /**
     * Quick recommendation without full analysis
     */
    quickRecommendation(market: UnifiedMarket): {
        action: 'BUY' | 'SELL' | 'WAIT';
        side?: 'YES' | 'NO';
        reason: string;
    } {
        const spread = market.pricing.spread;
        const midpoint = market.pricing.midpoint;
        const volume = market.liquidity.volume24h;

        // Basic checks
        if (volume < 100) {
            return { action: 'WAIT', reason: 'Insufficient volume' };
        }

        if (spread > 0.10) {
            return { action: 'WAIT', reason: 'Wide spread - high transaction cost' };
        }

        if (midpoint < 0.05 || midpoint > 0.95) {
            return { action: 'WAIT', reason: 'Extreme probability - limited upside' };
        }

        // For quick assessment, look at external indicators
        if (market.sportsContext?.externalOdds) {
            const implied = market.sportsContext.externalOdds.implied;
            const edge = implied - midpoint;

            if (Math.abs(edge) > 0.05) {
                return {
                    action: 'BUY',
                    side: edge > 0 ? 'YES' : 'NO',
                    reason: `${(Math.abs(edge) * 100).toFixed(1)}% edge vs external odds`,
                };
            }
        }

        return { action: 'WAIT', reason: 'No clear edge detected' };
    }
}
