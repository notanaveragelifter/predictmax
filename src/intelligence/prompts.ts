/**
 * Enhanced AI Prompts for PredictMax Intelligence System
 * 
 * Domain-specific prompts for comprehensive market analysis
 */

export const ENHANCED_SYSTEM_PROMPT = `You are PredictMax, an advanced AI prediction market analyst specializing in Kalshi and Polymarket.

## Your Capabilities
1. **Intelligent Market Discovery** - Parse natural language to find specific markets (e.g., "Darderi vs Sinner" → find exact tennis match)
2. **Multi-Model Probability Analysis** - Calculate fair values using multiple statistical models
3. **Domain Expertise** - Deep knowledge in sports, politics, crypto, and economics
4. **Risk Assessment** - Evaluate liquidity, settlement, volatility, and concentration risks
5. **Professional Recommendations** - Provide actionable trade recommendations with position sizing

## Tool Usage Strategy
1. **For market discovery**: Use intelligent_search with natural language queries
2. **For specific market analysis**: Use analyze_market_deep for comprehensive analysis
3. **For comparisons**: Use compare_markets_detailed
4. **For quick checks**: Use the standard market tools

## Output Standards
- Always provide probability as percentages (e.g., 65.3%)
- Show edge as +/- percentage (e.g., +4.2% edge)
- Include confidence level in recommendations
- Cite specific factors driving analysis
- Format reports professionally with tables and clear sections

## Risk Awareness
- Warn when liquidity is insufficient (< $1,000 24h volume)
- Highlight wide spreads (> 5%)
- Note settlement risks for ambiguous markets
- Consider time to expiry in recommendations

## Response Format
For market analysis, use this structure:

**Summary**: 1-2 sentences
**Market Data**: Table with pricing, volume, liquidity
**Probability Analysis**: Fair value calculation with model breakdown
**Recommendation**: Action, sizing, entry/exit strategy
**Risks**: Key risk factors
**Sources**: Data sources and timestamp

Do NOT use emojis unless specifically requested.`;

export const TENNIS_ANALYSIS_PROMPT = `Analyzing tennis prediction market.

MARKET DATA:
{marketDetails}

PLAYER INTELLIGENCE:
{player1Name}:
- Ranking: #{player1Ranking}
- Recent Form: {player1Form} (L10)
- {surface} Record: {player1SurfaceRecord}

{player2Name}:
- Ranking: #{player2Ranking}
- Recent Form: {player2Form} (L10)
- {surface} Record: {player2SurfaceRecord}

Head-to-Head: {h2hRecord}
On {surface}: {h2hSurface}
Tournament: {tournament}

EXTERNAL ODDS:
{externalOddsImplied}% implied probability

TASK:
1. Calculate fair value using:
   - Elo-adjusted ranking model
   - Recent form analysis (last 10 matches)
   - Head-to-head historical performance
   - Surface-specific advantage
   - Tournament context

2. Compare fair value vs market price to identify edge

3. Assess risks:
   - Liquidity (volume, spread)
   - Time to match
   - Injury concerns

4. Provide BUY/SELL/WAIT recommendation with:
   - Confidence level
   - Position sizing
   - Entry price targets

FORMAT: Professional analysis report`;

export const POLITICS_ANALYSIS_PROMPT = `Analyzing political prediction market.

MARKET DATA:
{marketDetails}

POLLING DATA:
Average: {pollAverage}%
Trend: {pollTrend}
Recent Polls:
{recentPolls}

EXPERT FORECASTS:
- FiveThirtyEight: {fiveThirtyEightForecast}
- Economist Model: {economistForecast}
- RCP Average: {rcpAverage}

HISTORICAL CONTEXT:
{historicalData}

KEY FACTORS:
{keyFactors}

TASK:
1. Synthesize polling data and expert forecasts
2. Identify systematic biases in market pricing
3. Calculate edge vs market consensus
4. Assess uncertainty and potential shifts
5. Provide recommendation with time horizon considerations`;

export const CRYPTO_ANALYSIS_PROMPT = `Analyzing crypto prediction market.

MARKET DATA:
{marketDetails}

PRICE CONTEXT:
Current {asset} Price: {currentPrice}
Target Threshold: {threshold}
Distance: {distancePercent}% ({direction})
Days to Expiry: {daysToExpiry}

TECHNICAL ANALYSIS:
- RSI (14): {rsi}
- MACD: {macdSignal}
- Key Support: {supportLevel}
- Key Resistance: {resistanceLevel}
- 30-day Volatility: {volatility}%

ON-CHAIN DATA:
- Exchange Net Flow: {exchangeFlow}
- Large Transactions: {largeTransactions}
- Whale Activity: {whaleActivity}

TASK:
1. Calculate probability of reaching threshold using:
   - Historical volatility model
   - Technical indicator analysis
   - On-chain flow patterns

2. Compare vs market implied probability
3. Assess crypto-specific risks
4. Provide recommendation with crypto market context`;

export const ECONOMICS_ANALYSIS_PROMPT = `Analyzing economic indicator prediction market.

MARKET DATA:
{marketDetails}

INDICATOR CONTEXT:
Indicator: {indicator}
Current Value: {currentValue}
Threshold: {threshold}
Historical Trend: {historicalTrend}

FORECASTS:
- Bloomberg Consensus: {bloombergConsensus}
- Median Forecast: {medianForecast}
- Range: {forecastRange}

RELATED INDICATORS:
{relatedIndicators}

MARKET EXPECTATIONS:
Fed Funds Implied: {fedFundsImplied}
Treasury Yields: {treasuryYields}

TASK:
1. Analyze economic data and forecasts
2. Consider leading indicators and correlations
3. Calculate probability vs market
4. Provide recommendation with economic context`;

export const COMPARISON_PROMPT = `Compare these prediction markets.

MARKETS:
{marketsList}

For each market, analyze:
1. Fair value probability
2. Edge vs market price
3. Liquidity quality
4. Risk factors

TASK:
1. Rank markets by risk-adjusted expected value
2. Identify best opportunity
3. Note any arbitrage between platforms
4. Provide portfolio allocation recommendation

FORMAT: Comparison table with summary`;

export const DISCOVERY_PROMPT = `Find markets matching user criteria.

USER QUERY: {query}

PARSED INTENT:
- Domain: {domain}
- Category: {category}
- Specific Request: {specificRequest}
- Time Frame: {timeFrame}
- Platform Preference: {platform}

AVAILABLE MARKETS:
{marketsList}

TASK:
1. Filter to most relevant markets
2. Rank by relevance to query
3. Provide brief analysis of top matches
4. Suggest next actions

If no exact match found:
- Suggest similar markets
- Offer to set up alerts
- Explain what markets are available`;

export const QUICK_ANALYSIS_TEMPLATE = `**{question}**

| Metric | Value |
|--------|-------|
| Platform | {platform} |
| Price | {price}% |
| Fair Value | {fairValue}% |
| Edge | {edge}% |
| Volume 24h | {volume} |
| Spread | {spread}% |
| Liquidity | {liquidityScore} |

**Recommendation**: {action} {side}
**Confidence**: {confidence}%
**Reasoning**: {reasoning}`;

export const PROFESSIONAL_REPORT_TEMPLATE = `
PREDICTMAX MARKET ANALYSIS
==========================

MARKET OVERVIEW
---------------
Question: {question}
Platform: {platform}
Category: {category}
Expires: {expiryDate}

CURRENT PRICING
--------------
           BID    ASK   SPREAD
YES      {yesBid}%  {yesAsk}%   {spread}%
NO       {noBid}%  {noAsk}%

Midpoint: {midpoint}%
Last: {lastPrice}%

LIQUIDITY
---------
24h Volume: {volume24h}
Total Volume: {totalVolume}
Open Interest: {openInterest}
Rating: {liquidityScore}

PROBABILITY ANALYSIS
-------------------
Fair Value: {fairValue}%
Market Price: {marketPrice}%
Edge: {edge}%
Confidence: {confidence}%

Model Breakdown:
{modelBreakdown}

RECOMMENDATION
--------------
Action: {action} {side}
Position Size: {positionSize}
Entry: {entryPrice}%
Stop Loss: {stopLoss}%
Take Profit: {takeProfit}%
Time Horizon: {timeHorizon}

REASONING
---------
{reasoning}

KEY FACTORS
-----------
{keyFactors}

RISKS
-----
{risks}

---
Generated: {timestamp}
PredictMax AI v2.0

Disclaimer: This is not financial advice.
`;
