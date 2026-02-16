/**
 * Professional Report Generator
 * 
 * Generates detailed, well-formatted reports for prediction market analysis:
 * - Market overview
 * - Probability analysis
 * - Risk assessment
 * - Trade recommendations
 * - Comparison reports
 */

import { Injectable, Logger } from '@nestjs/common';
import {
    UnifiedMarket,
    TradeRecommendation,
    ProbabilityAnalysis,
    RiskAssessment,
    SportsContext,
} from './types';

@Injectable()
export class ReportGenerator {
    private readonly logger = new Logger(ReportGenerator.name);

    /**
     * Generate a comprehensive market analysis report
     */
    generateMarketReport(market: UnifiedMarket, recommendation: TradeRecommendation): string {
        const sections = [
            this.generateHeader(),
            this.generateMarketOverview(market),
            this.generatePricingSection(market),
            this.generateLiquiditySection(market),
            this.generateProbabilitySection(recommendation.analysis),
            this.generateContextSection(market),
            this.generateRecommendationSection(recommendation),
            this.generateRiskSection(recommendation.risk),
            this.generateFooter(),
        ];

        return sections.join('\n\n');
    }

    /**
     * Generate a comparison report for multiple markets
     */
    generateComparisonReport(
        markets: Array<{ market: UnifiedMarket; recommendation: TradeRecommendation }>
    ): string {
        const sections = [
            this.generateHeader(),
            this.generateComparisonHeader(),
            this.generateComparisonTable(markets),
            this.generateBestOpportunity(markets),
            this.generateComparisonSummary(markets),
            this.generateFooter(),
        ];

        return sections.join('\n\n');
    }

    /**
     * Generate a quick analysis summary
     */
    generateQuickSummary(market: UnifiedMarket, recommendation: TradeRecommendation): string {
        const actionEmoji = recommendation.action === 'BUY' ? '⚡' : 
                          recommendation.action === 'WAIT' ? '⏸️' : '📉';

        return `**${market.question}**
Platform: ${market.platform.toUpperCase()}
Price: ${(market.pricing.midpoint * 100).toFixed(1)}% | Fair Value: ${(recommendation.analysis.fairValue * 100).toFixed(1)}%
Edge: ${recommendation.edge > 0 ? '+' : ''}${recommendation.edge.toFixed(1)}% | Confidence: ${(recommendation.confidence * 100).toFixed(0)}%
${actionEmoji} **${recommendation.action}${recommendation.side ? ` ${recommendation.side}` : ''}**
${recommendation.reasoning}`;
    }

    private generateHeader(): string {
        return `┌─────────────────────────────────────────────────────────────────┐
│ PREDICTMAX MARKET ANALYSIS REPORT                               │
└─────────────────────────────────────────────────────────────────┘`;
    }

    private generateMarketOverview(market: UnifiedMarket): string {
        const daysToExpiry = Math.ceil(
            (market.market.expirationTime.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        return `MARKET OVERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Question:     ${market.question}
Platform:     ${market.platform.toUpperCase()}
Category:     ${market.category}${market.subcategory ? ` › ${market.subcategory}` : ''}
Status:       ${market.market.status.toUpperCase()}
Expires:      ${market.market.expirationTime.toLocaleDateString()} (${daysToExpiry} days)
Tags:         ${market.tags.join(', ') || 'None'}`;
    }

    private generatePricingSection(market: UnifiedMarket): string {
        const p = market.pricing;
        return `CURRENT MARKET PRICING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    BID        ASK      SPREAD
YES             ${(p.yesBid * 100).toFixed(1).padStart(5)}%      ${(p.yesAsk * 100).toFixed(1).padStart(5)}%     ${(p.spread * 100).toFixed(1)}%
NO              ${(p.noBid * 100).toFixed(1).padStart(5)}%      ${(p.noAsk * 100).toFixed(1).padStart(5)}%     

Midpoint:       ${(p.midpoint * 100).toFixed(1)}%
Last Trade:     ${(p.lastPrice * 100).toFixed(1)}%`;
    }

    private generateLiquiditySection(market: UnifiedMarket): string {
        const l = market.liquidity;
        return `LIQUIDITY METRICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
24h Volume:     $${l.volume24h.toLocaleString()}
Total Volume:   $${l.totalVolume.toLocaleString()}
Open Interest:  $${l.openInterest.toLocaleString()}
Liquidity:      ${l.liquidityScore}`;
    }

    private generateProbabilitySection(analysis: ProbabilityAnalysis): string {
        const models = analysis.models.map(m => 
            `  • ${m.name.replace(/_/g, ' ').padEnd(22)} ${(m.probability * 100).toFixed(1).padStart(5)}%  (${(m.confidence * 100).toFixed(0)}% confidence)`
        ).join('\n');

        return `PROBABILITY ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Fair Value:     ${(analysis.fairValue * 100).toFixed(1)}%
Edge:           ${analysis.edge > 0 ? '+' : ''}${(analysis.edge * 100).toFixed(1)}%
Confidence:     ${(analysis.confidence * 100).toFixed(0)}%

Model Breakdown:
${models}`;
    }

    private generateContextSection(market: UnifiedMarket): string {
        if (market.sportsContext) {
            return this.generateSportsContext(market.sportsContext);
        }
        return '';
    }

    private generateSportsContext(ctx: SportsContext): string {
        const p1 = ctx.players.player1;
        const p2 = ctx.players.player2;

        return `SPORTS CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sport:          ${ctx.sport.toUpperCase()}
Match Type:     ${ctx.matchType || 'N/A'}

Players:
  ${p1.name} (#${p1.ranking || 'N/A'})
    Recent Form: ${p1.recentForm.wins}-${p1.recentForm.losses} (L10)
    ${ctx.context.surface ? `Surface:     ${ctx.context.surface} - ${p1.surfaceRecord?.winRate ? (p1.surfaceRecord.winRate * 100).toFixed(0) + '%' : 'N/A'}` : ''}
    
  ${p2.name} (#${p2.ranking || 'N/A'})
    Recent Form: ${p2.recentForm.wins}-${p2.recentForm.losses} (L10)
    ${ctx.context.surface ? `Surface:     ${ctx.context.surface} - ${p2.surfaceRecord?.winRate ? (p2.surfaceRecord.winRate * 100).toFixed(0) + '%' : 'N/A'}` : ''}

Head-to-Head:   ${ctx.headToHead.overall}
${ctx.headToHead.onSurface ? `On ${ctx.context.surface}: ${ctx.headToHead.onSurface}` : ''}

${ctx.context.tournament ? `Tournament:     ${ctx.context.tournament}` : ''}
${ctx.externalOdds ? `External Odds:  ${(ctx.externalOdds.implied * 100).toFixed(1)}% implied probability` : ''}`;
    }

    private generateRecommendationSection(rec: TradeRecommendation): string {
        const sizingInfo = rec.action !== 'WAIT' ? `
Position Sizing:
  Recommended:   $${rec.sizing.recommended.toLocaleString()}
  Maximum:       $${rec.sizing.maximum.toLocaleString()}
  Unit Size:     $${rec.sizing.conservativeUnit.toLocaleString()}

Execution Strategy:
  Entry:         ${(rec.pricing.targetEntry * 100).toFixed(1)}% (${rec.timing.urgency} urgency)
  Limit:         ${(rec.pricing.limitPrice * 100).toFixed(1)}%
  Est. Slippage: ${(rec.pricing.expectedSlippage * 100).toFixed(2)}%
  Stop Loss:     ${rec.pricing.stopLoss ? (rec.pricing.stopLoss * 100).toFixed(1) + '%' : 'N/A'}
  Take Profit:   ${rec.pricing.takeProfit ? (rec.pricing.takeProfit * 100).toFixed(1) + '%' : 'N/A'}

Exit Strategy:
  ${rec.timing.exitStrategy}

Timing:
  ${rec.timing.optimalEntry}` : '';

        const keyFactorsSection = rec.keyFactors.length > 0 
            ? `\n\nKey Factors:\n${rec.keyFactors.map(f => `  • ${f}`).join('\n')}`
            : '';

        return `TRADE RECOMMENDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ ACTION:      ${rec.action}${rec.side ? ` ${rec.side}` : ''}
📊 CONFIDENCE:  ${(rec.confidence * 100).toFixed(0)}%
💰 EDGE:        ${rec.edge > 0 ? '+' : ''}${rec.edge.toFixed(1)}%
${sizingInfo}

REASONING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${rec.reasoning}${keyFactorsSection}`;
    }

    private generateRiskSection(risk: RiskAssessment): string {
        const formatRisk = (name: string, metric: { level: string; score: number; details: any }) => {
            const bar = '█'.repeat(metric.score) + '░'.repeat(10 - metric.score);
            return `  ${name.padEnd(15)} [${bar}] ${metric.level.padEnd(6)} (${metric.score}/10)`;
        };

        const riskFactorsSection = risk.riskFactors.length > 0
            ? `\nRisk Factors:\n${risk.riskFactors.map(f => `  ⚠️ ${f}`).join('\n')}`
            : '';

        return `RISK ASSESSMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${formatRisk('Liquidity', risk.liquidityRisk)}
${formatRisk('Settlement', risk.settlementRisk)}
${formatRisk('Volatility', risk.volatilityRisk)}
${formatRisk('Concentration', risk.concentrationRisk)}
${formatRisk('Time', risk.timeRisk)}

Overall Risk:   ${(risk.overallRisk * 100).toFixed(0)}%${riskFactorsSection}`;
    }

    private generateFooter(): string {
        const timestamp = new Date().toLocaleString();
        return `───────────────────────────────────────────────────────────────────
Generated: ${timestamp}
PredictMax AI v2.0 | Powered by Claude

DISCLAIMER: This analysis is for informational purposes only and does not 
constitute financial advice. Past performance does not guarantee future results.
Trading prediction markets involves risk of loss.`;
    }

    private generateComparisonHeader(): string {
        return `MARKET COMPARISON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    }

    private generateComparisonTable(
        markets: Array<{ market: UnifiedMarket; recommendation: TradeRecommendation }>
    ): string {
        const header = '| # | Platform   | Question                                | Price  | Fair   | Edge   | Action    |';
        const divider = '|---|------------|----------------------------------------|--------|--------|--------|-----------|';
        
        const rows = markets.slice(0, 10).map((m, i) => {
            const question = m.market.question.length > 38 
                ? m.market.question.substring(0, 35) + '...' 
                : m.market.question.padEnd(38);
            
            return `| ${(i + 1).toString().padStart(1)} | ${m.market.platform.toUpperCase().padEnd(10)} | ${question} | ${(m.market.pricing.midpoint * 100).toFixed(0).padStart(4)}%  | ${(m.recommendation.analysis.fairValue * 100).toFixed(0).padStart(4)}%  | ${m.recommendation.edge > 0 ? '+' : ''}${m.recommendation.edge.toFixed(0).padStart(4)}%  | ${(m.recommendation.action + (m.recommendation.side ? ' ' + m.recommendation.side : '')).padEnd(9)} |`;
        });

        return [header, divider, ...rows].join('\n');
    }

    private generateBestOpportunity(
        markets: Array<{ market: UnifiedMarket; recommendation: TradeRecommendation }>
    ): string {
        const actionable = markets.filter(m => m.recommendation.action !== 'WAIT');
        
        if (actionable.length === 0) {
            return `BEST OPPORTUNITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
No actionable opportunities found in the current market set.
All markets either have insufficient edge or high risk factors.`;
        }

        // Sort by expected value (edge * confidence)
        actionable.sort((a, b) => {
            const evA = Math.abs(a.recommendation.edge) * a.recommendation.confidence;
            const evB = Math.abs(b.recommendation.edge) * b.recommendation.confidence;
            return evB - evA;
        });

        const best = actionable[0];
        
        return `BEST OPPORTUNITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Market:      ${best.market.question}
Platform:    ${best.market.platform.toUpperCase()}
Action:      ${best.recommendation.action} ${best.recommendation.side || ''}
Edge:        ${best.recommendation.edge > 0 ? '+' : ''}${best.recommendation.edge.toFixed(1)}%
Confidence:  ${(best.recommendation.confidence * 100).toFixed(0)}%

Reasoning:   ${best.recommendation.reasoning}`;
    }

    private generateComparisonSummary(
        markets: Array<{ market: UnifiedMarket; recommendation: TradeRecommendation }>
    ): string {
        const actionable = markets.filter(m => m.recommendation.action !== 'WAIT');
        const avgEdge = markets.length > 0 
            ? markets.reduce((sum, m) => sum + m.recommendation.edge, 0) / markets.length 
            : 0;
        const avgConfidence = markets.length > 0
            ? markets.reduce((sum, m) => sum + m.recommendation.confidence, 0) / markets.length
            : 0;

        const platformCounts = {
            kalshi: markets.filter(m => m.market.platform === 'kalshi').length,
            polymarket: markets.filter(m => m.market.platform === 'polymarket').length,
        };

        return `SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Markets Analyzed:     ${markets.length}
Actionable:           ${actionable.length}
Average Edge:         ${avgEdge > 0 ? '+' : ''}${avgEdge.toFixed(1)}%
Average Confidence:   ${(avgConfidence * 100).toFixed(0)}%

By Platform:
  Kalshi:             ${platformCounts.kalshi}
  Polymarket:         ${platformCounts.polymarket}`;
    }

    /**
     * Generate a markdown-formatted report (for chat responses)
     */
    generateMarkdownReport(market: UnifiedMarket, recommendation: TradeRecommendation): string {
        const edgeSign = recommendation.edge > 0 ? '+' : '';
        const actionEmoji = recommendation.action === 'BUY' ? '🟢' : 
                          recommendation.action === 'WAIT' ? '🟡' : '🔴';

        let report = `## Market Analysis: ${market.question}

**Platform:** ${market.platform.toUpperCase()} | **Category:** ${market.category}

### Pricing
| Metric | Value |
|--------|-------|
| Current Price | ${(market.pricing.midpoint * 100).toFixed(1)}% |
| Fair Value | ${(recommendation.analysis.fairValue * 100).toFixed(1)}% |
| Edge | ${edgeSign}${recommendation.edge.toFixed(1)}% |
| Spread | ${(market.pricing.spread * 100).toFixed(1)}% |

### Liquidity
- 24h Volume: $${market.liquidity.volume24h.toLocaleString()}
- Open Interest: $${market.liquidity.openInterest.toLocaleString()}
- Rating: **${market.liquidity.liquidityScore}**

### Probability Models
`;

        for (const model of recommendation.analysis.models) {
            report += `- **${model.name.replace(/_/g, ' ')}:** ${(model.probability * 100).toFixed(1)}% (${(model.confidence * 100).toFixed(0)}% confidence)\n`;
        }

        report += `
### ${actionEmoji} Recommendation: **${recommendation.action}${recommendation.side ? ` ${recommendation.side}` : ''}**

**Confidence:** ${(recommendation.confidence * 100).toFixed(0)}%

${recommendation.reasoning}
`;

        if (recommendation.action !== 'WAIT') {
            report += `
### Position Sizing
- Recommended: **$${recommendation.sizing.recommended.toLocaleString()}**
- Maximum: $${recommendation.sizing.maximum.toLocaleString()}

### Execution
- Entry: ${(recommendation.pricing.targetEntry * 100).toFixed(1)}%
- Limit: ${(recommendation.pricing.limitPrice * 100).toFixed(1)}%
- Time Horizon: ${recommendation.timing.timeHorizon}
`;
        }

        if (recommendation.keyFactors.length > 0) {
            report += `
### Key Factors
${recommendation.keyFactors.map(f => `- ${f}`).join('\n')}
`;
        }

        if (recommendation.risks.length > 0) {
            report += `
### Risks
${recommendation.risks.map(r => `- ⚠️ ${r}`).join('\n')}
`;
        }

        report += `
---
*Generated by PredictMax AI | ${new Date().toLocaleString()}*
*Disclaimer: Not financial advice. Trading involves risk.*`;

        return report;
    }
}
