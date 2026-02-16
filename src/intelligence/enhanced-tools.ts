/**
 * Enhanced Tools for PredictMax Intelligence System
 * 
 * New AI tools that leverage the intelligence services for
 * smarter market discovery and analysis.
 */

import { Tool } from '@anthropic-ai/sdk/resources/messages';

export const ENHANCED_TOOLS: Tool[] = [
    // ==================== INTELLIGENT SEARCH ====================
    {
        name: 'intelligent_search',
        description: `Intelligent market search using natural language. Automatically:
- Parses player/team names (e.g., "Sinner" → "Jannik Sinner")
- Detects sport type and match type (ATP, NBA, etc.)
- Finds exact matches for head-to-head queries
- Searches across both Kalshi and Polymarket

Use for queries like:
- "Darderi vs Sinner on Kalshi"
- "Bitcoin above 100k before March"
- "Trump vs Biden election odds"
- "Lakers vs Celtics"`,
        input_schema: {
            type: 'object' as const,
            properties: {
                query: {
                    type: 'string',
                    description: 'Natural language search query',
                },
                platform: {
                    type: 'string',
                    enum: ['kalshi', 'polymarket', 'both'],
                    description: 'Platform to search (default: both)',
                },
                limit: {
                    type: 'number',
                    description: 'Max results to return (default: 10)',
                },
            },
            required: ['query'],
        },
    },

    // ==================== DEEP ANALYSIS ====================
    {
        name: 'analyze_market_deep',
        description: `Comprehensive market analysis with:
- Multi-model probability calculation (market consensus, statistical, external odds)
- Domain-specific intelligence (sports stats, polls, crypto technicals)
- Complete risk assessment (liquidity, settlement, volatility)
- Professional trade recommendation with sizing

Returns a full professional report with actionable recommendations.`,
        input_schema: {
            type: 'object' as const,
            properties: {
                platform: {
                    type: 'string',
                    enum: ['kalshi', 'polymarket'],
                    description: 'The platform',
                },
                market_id: {
                    type: 'string',
                    description: 'Market identifier',
                },
                bankroll: {
                    type: 'number',
                    description: 'User bankroll for position sizing (default: 10000)',
                },
            },
            required: ['platform', 'market_id'],
        },
    },

    // ==================== MARKET COMPARISON ====================
    {
        name: 'compare_markets_detailed',
        description: `Compare multiple markets side by side with:
- Fair value calculations for each
- Edge and confidence comparison
- Risk-adjusted ranking
- Best opportunity identification
- Arbitrage detection between platforms`,
        input_schema: {
            type: 'object' as const,
            properties: {
                markets: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            platform: { type: 'string' },
                            market_id: { type: 'string' },
                        },
                    },
                    description: 'Array of {platform, market_id} to compare',
                },
            },
            required: ['markets'],
        },
    },

    // ==================== SPORTS INTELLIGENCE ====================
    {
        name: 'get_sports_intelligence',
        description: `Get enriched sports data for a market:
- Player/team rankings and stats
- Head-to-head records
- Recent form analysis
- Surface/venue advantages
- External bookmaker odds comparison

Essential for sports market analysis.`,
        input_schema: {
            type: 'object' as const,
            properties: {
                platform: {
                    type: 'string',
                    enum: ['kalshi', 'polymarket'],
                    description: 'The platform',
                },
                market_id: {
                    type: 'string',
                    description: 'Market identifier',
                },
            },
            required: ['platform', 'market_id'],
        },
    },

    // ==================== PROBABILITY CALCULATION ====================
    {
        name: 'calculate_fair_value',
        description: `Calculate fair value probability using multi-model ensemble:
- Market consensus model
- Domain-specific statistical model
- External odds integration
- Historical pattern analysis

Returns probability, edge, and confidence with model breakdown.`,
        input_schema: {
            type: 'object' as const,
            properties: {
                platform: {
                    type: 'string',
                    enum: ['kalshi', 'polymarket'],
                    description: 'The platform',
                },
                market_id: {
                    type: 'string',
                    description: 'Market identifier',
                },
            },
            required: ['platform', 'market_id'],
        },
    },

    // ==================== RISK ASSESSMENT ====================
    {
        name: 'assess_market_risk',
        description: `Comprehensive risk assessment:
- Liquidity risk (volume, spread, slippage)
- Settlement risk (platform, resolution criteria)
- Volatility risk (uncertainty, category)
- Concentration risk (market depth)
- Time risk (days to expiry)

Returns risk scores and position sizing recommendations.`,
        input_schema: {
            type: 'object' as const,
            properties: {
                platform: {
                    type: 'string',
                    enum: ['kalshi', 'polymarket'],
                    description: 'The platform',
                },
                market_id: {
                    type: 'string',
                    description: 'Market identifier',
                },
            },
            required: ['platform', 'market_id'],
        },
    },

    // ==================== BEST OPPORTUNITY ====================
    {
        name: 'find_best_opportunity',
        description: `Scan markets to find the best trading opportunity:
- Analyzes multiple markets
- Calculates edge and risk for each
- Ranks by risk-adjusted expected value
- Returns the best opportunity with full analysis

Use when user asks "where should I bet?" or "best opportunity".`,
        input_schema: {
            type: 'object' as const,
            properties: {
                category: {
                    type: 'string',
                    description: 'Category to focus on (sports, politics, crypto, etc.)',
                },
                platform: {
                    type: 'string',
                    enum: ['kalshi', 'polymarket', 'both'],
                    description: 'Platform preference (default: both)',
                },
                limit: {
                    type: 'number',
                    description: 'Number of markets to analyze (default: 20)',
                },
                bankroll: {
                    type: 'number',
                    description: 'User bankroll for sizing (default: 10000)',
                },
            },
            required: [],
        },
    },

    // ==================== ARBITRAGE DETECTION ====================
    {
        name: 'find_arbitrage',
        description: `Find arbitrage opportunities across platforms:
- Matches similar markets on Kalshi and Polymarket
- Calculates price differences
- Identifies profitable cross-platform trades
- Accounts for fees and slippage

Returns list of opportunities sorted by profit potential.`,
        input_schema: {
            type: 'object' as const,
            properties: {
                min_spread: {
                    type: 'number',
                    description: 'Minimum spread % to report (default: 3)',
                },
            },
            required: [],
        },
    },

    // ==================== QUICK RECOMMENDATION ====================
    {
        name: 'quick_recommendation',
        description: `Get a quick BUY/SELL/WAIT recommendation for a market.
Faster than full analysis, good for screening multiple markets.`,
        input_schema: {
            type: 'object' as const,
            properties: {
                platform: {
                    type: 'string',
                    enum: ['kalshi', 'polymarket'],
                    description: 'The platform',
                },
                market_id: {
                    type: 'string',
                    description: 'Market identifier',
                },
            },
            required: ['platform', 'market_id'],
        },
    },

    // ==================== CATEGORY SCAN ====================
    {
        name: 'scan_category',
        description: `Scan all markets in a category for opportunities:
- Fetches all active markets in category
- Calculates quick edge estimates
- Identifies markets with potential
- Returns ranked list with key metrics

Good for exploring "show me all tennis markets" or "scan crypto markets".`,
        input_schema: {
            type: 'object' as const,
            properties: {
                category: {
                    type: 'string',
                    enum: ['sports', 'politics', 'crypto', 'economics', 'weather', 'entertainment'],
                    description: 'Category to scan',
                },
                platform: {
                    type: 'string',
                    enum: ['kalshi', 'polymarket', 'both'],
                    description: 'Platform preference (default: both)',
                },
                sort_by: {
                    type: 'string',
                    enum: ['volume', 'edge', 'expiry', 'liquidity'],
                    description: 'Sort criterion (default: volume)',
                },
                limit: {
                    type: 'number',
                    description: 'Max results (default: 20)',
                },
            },
            required: ['category'],
        },
    },

    // ==================== GENERATE REPORT ====================
    {
        name: 'generate_report',
        description: `Generate a professional analysis report for a market.
Options for format:
- "full": Complete professional report
- "markdown": Markdown formatted for chat
- "quick": Brief summary`,
        input_schema: {
            type: 'object' as const,
            properties: {
                platform: {
                    type: 'string',
                    enum: ['kalshi', 'polymarket'],
                    description: 'The platform',
                },
                market_id: {
                    type: 'string',
                    description: 'Market identifier',
                },
                format: {
                    type: 'string',
                    enum: ['full', 'markdown', 'quick'],
                    description: 'Report format (default: markdown)',
                },
                bankroll: {
                    type: 'number',
                    description: 'User bankroll for sizing (default: 10000)',
                },
            },
            required: ['platform', 'market_id'],
        },
    },

    // ==================== LIVE SPORTS STREAM ====================
    {
        name: 'get_live_stream',
        description: `Check if a sports market has a live game happening and find YouTube streams.
Returns:
- Live event details (score, period, teams)
- YouTube live stream URL if available
- Watch button data for UI

Use this when analyzing sports markets to enhance the experience with live viewing.`,
        input_schema: {
            type: 'object' as const,
            properties: {
                platform: {
                    type: 'string',
                    enum: ['kalshi', 'polymarket'],
                    description: 'The platform',
                },
                market_id: {
                    type: 'string',
                    description: 'Market identifier for a sports market',
                },
            },
            required: ['platform', 'market_id'],
        },
    },

    // ==================== GET LIVE GAMES ====================
    {
        name: 'get_live_games',
        description: `Get all currently live games for a specific sport.
Returns active games with scores, periods, and stream availability.
Useful for: "What NFL games are on right now?" or "Show me live NBA games"`,
        input_schema: {
            type: 'object' as const,
            properties: {
                sport: {
                    type: 'string',
                    enum: ['nfl', 'nba', 'mlb', 'nhl', 'tennis', 'ufc', 'soccer'],
                    description: 'Sport to check for live games',
                },
            },
            required: ['sport'],
        },
    },
];

// Tool input type definitions
export interface EnhancedToolInput {
    // Intelligent search
    query?: string;
    
    // Market identifiers
    platform?: 'kalshi' | 'polymarket' | 'both';
    market_id?: string;
    markets?: Array<{ platform: string; market_id: string }>;
    
    // Analysis options
    bankroll?: number;
    category?: string;
    
    // Search/scan options
    limit?: number;
    sort_by?: 'volume' | 'edge' | 'expiry' | 'liquidity';
    
    // Report options
    format?: 'full' | 'markdown' | 'quick';
    
    // Arbitrage options
    min_spread?: number;

    // Live sports
    sport?: 'nfl' | 'nba' | 'mlb' | 'nhl' | 'tennis' | 'ufc' | 'soccer';
}
