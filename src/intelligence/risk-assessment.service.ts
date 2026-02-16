/**
 * Risk Assessment Engine
 * 
 * Comprehensive risk analysis for prediction markets:
 * - Liquidity risk
 * - Settlement/counterparty risk
 * - Volatility risk
 * - Concentration risk
 * - Time risk
 */

import { Injectable, Logger } from '@nestjs/common';
import { UnifiedMarket, RiskAssessment, RiskMetric } from './types';

@Injectable()
export class RiskAssessmentService {
    private readonly logger = new Logger(RiskAssessmentService.name);

    /**
     * Perform comprehensive risk assessment on a market
     */
    assessMarket(market: UnifiedMarket): RiskAssessment {
        const liquidityRisk = this.assessLiquidity(market);
        const settlementRisk = this.assessSettlement(market);
        const volatilityRisk = this.assessVolatility(market);
        const concentrationRisk = this.assessConcentration(market);
        const timeRisk = this.assessTimeRisk(market);

        // Calculate overall risk score (weighted average)
        const weights = {
            liquidity: 0.3,
            settlement: 0.15,
            volatility: 0.25,
            concentration: 0.15,
            time: 0.15,
        };

        const overallRisk = (
            liquidityRisk.score * weights.liquidity +
            settlementRisk.score * weights.settlement +
            volatilityRisk.score * weights.volatility +
            concentrationRisk.score * weights.concentration +
            timeRisk.score * weights.time
        ) / 10; // Normalize to 0-1

        // Compile risk factors
        const riskFactors: string[] = [];
        
        if (liquidityRisk.level === 'HIGH') {
            riskFactors.push('Low liquidity may cause significant slippage');
        }
        if (settlementRisk.level === 'HIGH') {
            riskFactors.push('Settlement uncertainty or platform risk');
        }
        if (volatilityRisk.level === 'HIGH') {
            riskFactors.push('High price volatility expected');
        }
        if (concentrationRisk.level === 'HIGH') {
            riskFactors.push('Concentrated position risk');
        }
        if (timeRisk.level === 'HIGH') {
            riskFactors.push('Time-related risks (too short or too long horizon)');
        }

        return {
            liquidityRisk,
            settlementRisk,
            volatilityRisk,
            concentrationRisk,
            timeRisk,
            overallRisk,
            riskFactors,
        };
    }

    /**
     * Assess liquidity risk
     */
    private assessLiquidity(market: UnifiedMarket): RiskMetric {
        const { volume24h, totalVolume, openInterest, liquidityScore } = market.liquidity;
        const spread = market.pricing.spread;

        let score: number;
        let level: 'LOW' | 'MEDIUM' | 'HIGH';

        // Scoring based on multiple factors
        if (volume24h > 50000 && spread < 0.02 && openInterest > 100000) {
            score = 2;
            level = 'LOW';
        } else if (volume24h > 10000 && spread < 0.05 && openInterest > 10000) {
            score = 4;
            level = 'LOW';
        } else if (volume24h > 1000 && spread < 0.10) {
            score = 6;
            level = 'MEDIUM';
        } else if (volume24h > 100) {
            score = 8;
            level = 'HIGH';
        } else {
            score = 9;
            level = 'HIGH';
        }

        // Calculate max recommended position based on liquidity
        const maxPosition = this.calculateMaxPosition(volume24h, openInterest);
        const expectedSlippage = this.calculateExpectedSlippage(spread, volume24h);

        return {
            score,
            level,
            details: {
                volume24h,
                totalVolume,
                openInterest,
                spread,
                spreadPercent: (spread * 100).toFixed(2) + '%',
                maxRecommendedPosition: maxPosition,
                expectedSlippage,
                liquidityScore,
            },
        };
    }

    /**
     * Assess settlement/counterparty risk
     */
    private assessSettlement(market: UnifiedMarket): RiskMetric {
        const platform = market.platform;
        const status = market.market.status;

        let score: number;
        let level: 'LOW' | 'MEDIUM' | 'HIGH';

        // Platform-based risk assessment
        if (platform === 'kalshi') {
            // Kalshi is CFTC-regulated
            score = 2;
            level = 'LOW';
        } else if (platform === 'polymarket') {
            // Polymarket is crypto-based
            score = 4;
            level = 'MEDIUM';
        } else {
            score = 6;
            level = 'MEDIUM';
        }

        // Adjust for market status
        if (status !== 'open') {
            score += 2;
            level = score >= 6 ? 'HIGH' : level;
        }

        // Check for ambiguous resolution criteria
        const hasAmbiguousResolution = this.checkAmbiguousResolution(market.question);
        if (hasAmbiguousResolution) {
            score += 2;
            level = score >= 6 ? 'HIGH' : level;
        }

        return {
            score: Math.min(10, score),
            level,
            details: {
                platform,
                status,
                regulated: platform === 'kalshi',
                hasAmbiguousResolution,
                settlementNote: platform === 'kalshi' 
                    ? 'CFTC-regulated, funds held by regulated custodian'
                    : 'Crypto-based settlement, smart contract risk exists',
            },
        };
    }

    /**
     * Assess price volatility risk
     */
    private assessVolatility(market: UnifiedMarket): RiskMetric {
        const midpoint = market.pricing.midpoint;
        const spread = market.pricing.spread;
        const category = market.category;

        let score: number;
        let level: 'LOW' | 'MEDIUM' | 'HIGH';

        // Probabilities near 50% are more volatile
        const distanceFrom50 = Math.abs(midpoint - 0.5);
        const uncertaintyFactor = 1 - (distanceFrom50 * 2); // 1 at 50%, 0 at 0% or 100%

        // Category-based volatility
        const categoryVolatility: Record<string, number> = {
            'sports': 0.6,  // Outcome determined by event
            'politics': 0.4, // Polls can shift
            'crypto': 0.9,   // Highly volatile
            'economics': 0.5,
            'weather': 0.3,
            'other': 0.5,
        };

        const catVol = categoryVolatility[category] || 0.5;
        const combinedVol = (uncertaintyFactor * 0.6 + catVol * 0.4);

        if (combinedVol < 0.3) {
            score = 2;
            level = 'LOW';
        } else if (combinedVol < 0.5) {
            score = 4;
            level = 'LOW';
        } else if (combinedVol < 0.7) {
            score = 6;
            level = 'MEDIUM';
        } else {
            score = 8;
            level = 'HIGH';
        }

        return {
            score,
            level,
            details: {
                currentProbability: (midpoint * 100).toFixed(1) + '%',
                uncertaintyFactor: (uncertaintyFactor * 100).toFixed(0) + '%',
                categoryVolatility: catVol,
                combinedVolatility: combinedVol,
                note: midpoint > 0.4 && midpoint < 0.6 
                    ? 'High uncertainty - price could move significantly'
                    : 'More certain outcome - lower expected volatility',
            },
        };
    }

    /**
     * Assess concentration risk
     */
    private assessConcentration(market: UnifiedMarket): RiskMetric {
        const { totalVolume, openInterest } = market.liquidity;
        
        // Without position data, assess market-level concentration
        let score: number;
        let level: 'LOW' | 'MEDIUM' | 'HIGH';

        // Large, liquid markets have lower concentration risk
        if (totalVolume > 1000000 && openInterest > 100000) {
            score = 2;
            level = 'LOW';
        } else if (totalVolume > 100000 && openInterest > 10000) {
            score = 4;
            level = 'LOW';
        } else if (totalVolume > 10000) {
            score = 6;
            level = 'MEDIUM';
        } else {
            score = 8;
            level = 'HIGH';
        }

        return {
            score,
            level,
            details: {
                totalVolume,
                openInterest,
                note: totalVolume < 10000 
                    ? 'Small market - individual positions may impact price'
                    : 'Adequate market depth for position sizing',
                recommendedMaxExposure: '10% of portfolio',
            },
        };
    }

    /**
     * Assess time-related risks
     */
    private assessTimeRisk(market: UnifiedMarket): RiskMetric {
        const expirationTime = market.market.expirationTime;
        const now = new Date();
        
        // Handle invalid or missing expiration times
        let daysToExpiry: number;
        let expirationDateStr: string;
        
        if (!expirationTime || isNaN(expirationTime.getTime())) {
            // Default to 30 days if no valid expiration
            daysToExpiry = 30;
            expirationDateStr = 'Unknown';
        } else {
            daysToExpiry = Math.ceil(
                (expirationTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );
            try {
                expirationDateStr = expirationTime.toISOString();
            } catch {
                expirationDateStr = 'Invalid date';
            }
        }

        let score: number;
        let level: 'LOW' | 'MEDIUM' | 'HIGH';

        if (daysToExpiry < 1) {
            score = 9;
            level = 'HIGH';
        } else if (daysToExpiry < 3) {
            score = 7;
            level = 'HIGH';
        } else if (daysToExpiry < 7) {
            score = 5;
            level = 'MEDIUM';
        } else if (daysToExpiry < 30) {
            score = 3;
            level = 'LOW';
        } else if (daysToExpiry < 90) {
            score = 4;
            level = 'LOW';
        } else {
            score = 6;
            level = 'MEDIUM'; // Very long-dated markets have their own risks
        }

        return {
            score,
            level,
            details: {
                daysToExpiry,
                expirationDate: expirationDateStr,
                note: this.getTimeRiskNote(daysToExpiry),
                recommendedAction: this.getTimeRecommendation(daysToExpiry),
            },
        };
    }

    /**
     * Calculate maximum recommended position based on liquidity
     */
    private calculateMaxPosition(volume24h: number, openInterest: number): number {
        // Don't take more than 1% of 24h volume or 0.5% of open interest
        const volumeBased = volume24h * 0.01;
        const oiBased = openInterest * 0.005;
        
        // Take the smaller of the two
        const maxPosition = Math.min(volumeBased, oiBased);
        
        // Cap at reasonable amounts
        return Math.min(maxPosition, 10000);
    }

    /**
     * Calculate expected slippage based on spread and volume
     */
    private calculateExpectedSlippage(spread: number, volume24h: number): number {
        // Base slippage is half the spread
        let slippage = spread / 2;
        
        // Increase slippage for low volume markets
        if (volume24h < 1000) {
            slippage *= 2;
        } else if (volume24h < 10000) {
            slippage *= 1.5;
        }

        return Math.min(0.05, slippage); // Cap at 5%
    }

    /**
     * Check for ambiguous resolution criteria
     */
    private checkAmbiguousResolution(question: string): boolean {
        const ambiguousPatterns = [
            'approximately',
            'around',
            'about',
            'roughly',
            'estimated',
            'close to',
            'near',
        ];

        const lower = question.toLowerCase();
        return ambiguousPatterns.some(pattern => lower.includes(pattern));
    }

    /**
     * Get time risk note based on days to expiry
     */
    private getTimeRiskNote(daysToExpiry: number): string {
        if (daysToExpiry < 1) {
            return 'Market expires very soon - limited time for price discovery';
        } else if (daysToExpiry < 3) {
            return 'Short time horizon - ensure you can monitor position';
        } else if (daysToExpiry < 7) {
            return 'Week-long horizon - moderate event risk';
        } else if (daysToExpiry < 30) {
            return 'Good time horizon for position management';
        } else if (daysToExpiry < 90) {
            return 'Medium-term position - watch for fundamental changes';
        } else {
            return 'Long-dated market - high uncertainty, may have liquidity issues';
        }
    }

    /**
     * Get time-based recommendation
     */
    private getTimeRecommendation(daysToExpiry: number): string {
        if (daysToExpiry < 1) {
            return 'Use limit orders only, monitor closely';
        } else if (daysToExpiry < 3) {
            return 'Set alerts, be prepared to exit if needed';
        } else if (daysToExpiry < 7) {
            return 'Monitor daily, adjust position as needed';
        } else if (daysToExpiry < 30) {
            return 'Weekly review recommended';
        } else {
            return 'Monthly review, watch for major developments';
        }
    }

    /**
     * Calculate position sizing based on risk
     */
    calculatePositionSize(
        risk: RiskAssessment,
        edge: number,
        confidence: number,
        bankroll: number = 10000
    ): {
        kellyFraction: number;
        fullKelly: number;
        halfKelly: number;
        quarterKelly: number;
        recommended: number;
        maxPosition: number;
    } {
        // Kelly Criterion: f = (bp - q) / b
        // Where b = odds, p = probability of winning, q = 1 - p
        const probability = 0.5 + (edge / 2); // Convert edge to probability
        const odds = 1 / probability - 1; // Decimal odds - 1
        
        const kellyFraction = Math.max(0, (odds * probability - (1 - probability)) / odds);
        
        // Scale down Kelly based on confidence and risk
        const confidenceMultiplier = Math.pow(confidence, 2); // Square to be conservative
        const riskMultiplier = 1 - (risk.overallRisk * 0.5); // Higher risk = lower multiplier
        
        const adjustedKelly = kellyFraction * confidenceMultiplier * riskMultiplier;

        const fullKelly = bankroll * adjustedKelly;
        const halfKelly = fullKelly / 2;
        const quarterKelly = fullKelly / 4;

        // Get liquidity-based max
        const liquidityMax = risk.liquidityRisk.details.maxRecommendedPosition || 1000;
        const maxPosition = Math.min(fullKelly, liquidityMax);

        // Recommended is half Kelly, capped by liquidity
        const recommended = Math.min(halfKelly, liquidityMax);

        return {
            kellyFraction: adjustedKelly,
            fullKelly,
            halfKelly,
            quarterKelly,
            recommended,
            maxPosition,
        };
    }

    /**
     * Generate risk summary for reporting
     */
    generateRiskSummary(risk: RiskAssessment): string {
        const levels = {
            liquidity: risk.liquidityRisk.level,
            settlement: risk.settlementRisk.level,
            volatility: risk.volatilityRisk.level,
            concentration: risk.concentrationRisk.level,
            time: risk.timeRisk.level,
        };

        const highRisks = Object.entries(levels)
            .filter(([_, level]) => level === 'HIGH')
            .map(([name]) => name);

        if (highRisks.length === 0) {
            return 'Overall risk profile is acceptable. Standard position sizing recommended.';
        } else if (highRisks.length <= 2) {
            return `Elevated risk in: ${highRisks.join(', ')}. Consider reduced position size.`;
        } else {
            return `High risk market. Significant concerns in: ${highRisks.join(', ')}. Proceed with caution.`;
        }
    }
}
