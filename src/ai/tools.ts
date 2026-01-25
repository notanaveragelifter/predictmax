/**
 * Claude Tool Definitions for PredictMax AI Agent
 * 
 * Comprehensive tools for accessing Kalshi and Polymarket APIs.
 * Based on full API documentation for both platforms.
 */

import { Tool } from '@anthropic-ai/sdk/resources/messages';

export const PREDICTMAX_TOOLS: Tool[] = [
    // ==================== KALSHI MARKET TOOLS ====================
    {
        name: 'get_kalshi_markets',
        description: 'Fetch markets from Kalshi with comprehensive filtering. Returns prediction markets with prices (in cents 0-100), volumes, and status. Essential for market discovery.',
        input_schema: {
            type: 'object' as const,
            properties: {
                limit: {
                    type: 'number',
                    description: 'Maximum markets to return (1-1000, default 100)',
                },
                cursor: {
                    type: 'string',
                    description: 'Pagination cursor from previous response',
                },
                status: {
                    type: 'string',
                    enum: ['initialized', 'open', 'closed', 'settled', 'determined'],
                    description: 'Filter by market status',
                },
                event_ticker: {
                    type: 'string',
                    description: 'Filter by event ticker (comma-separated for multiple)',
                },
                series_ticker: {
                    type: 'string',
                    description: 'Filter by series ticker',
                },
                tickers: {
                    type: 'string',
                    description: 'Filter by specific market tickers (comma-separated)',
                },
                min_close_ts: {
                    type: 'number',
                    description: 'Markets closing AFTER this Unix timestamp',
                },
                max_close_ts: {
                    type: 'number',
                    description: 'Markets closing BEFORE this Unix timestamp',
                },
                with_nested_markets: {
                    type: 'boolean',
                    description: 'Include nested markets in events',
                },
            },
            required: [],
        },
    },
    {
        name: 'get_kalshi_market',
        description: 'Get detailed information for a specific Kalshi market by ticker. Returns yes_bid, yes_ask, no_bid, no_ask (cents), volume, volume_24h, open_interest, liquidity, status, and more.',
        input_schema: {
            type: 'object' as const,
            properties: {
                ticker: {
                    type: 'string',
                    description: 'The market ticker (e.g., "INXD-24JAN01-T7999")',
                },
            },
            required: ['ticker'],
        },
    },
    {
        name: 'get_kalshi_orderbook',
        description: 'Get real-time order book for a Kalshi market. Returns YES and NO bids at various price levels. Note: Only bids are returned (yes_bid + no_ask ≈ 100 due to complementary nature).',
        input_schema: {
            type: 'object' as const,
            properties: {
                ticker: {
                    type: 'string',
                    description: 'The market ticker',
                },
                depth: {
                    type: 'number',
                    description: 'Number of price levels to return (default 10)',
                },
            },
            required: ['ticker'],
        },
    },
    {
        name: 'get_kalshi_trades',
        description: 'Get recent trades for a Kalshi market. Returns trade_id, ticker, price, count, yes_price, no_price, taker_side, and created_time.',
        input_schema: {
            type: 'object' as const,
            properties: {
                ticker: {
                    type: 'string',
                    description: 'Filter by market ticker (optional, omit for all trades)',
                },
                limit: {
                    type: 'number',
                    description: 'Maximum trades to return (default 100)',
                },
                min_ts: {
                    type: 'number',
                    description: 'Trades after this Unix timestamp',
                },
                max_ts: {
                    type: 'number',
                    description: 'Trades before this Unix timestamp',
                },
            },
            required: [],
        },
    },
    {
        name: 'get_kalshi_market_history',
        description: 'Get historical candlestick/OHLCV data for a Kalshi market. Use for price trend analysis and volatility assessment.',
        input_schema: {
            type: 'object' as const,
            properties: {
                ticker: {
                    type: 'string',
                    description: 'The market ticker',
                },
                limit: {
                    type: 'number',
                    description: 'Maximum candlesticks to return',
                },
                min_ts: {
                    type: 'number',
                    description: 'Data after this Unix timestamp',
                },
                max_ts: {
                    type: 'number',
                    description: 'Data before this Unix timestamp',
                },
            },
            required: ['ticker'],
        },
    },

    // ==================== KALSHI EVENT & SERIES TOOLS ====================
    {
        name: 'get_kalshi_events',
        description: 'List events from Kalshi. Events are collections of related markets. Returns event_ticker, title, category, series_ticker, strike_date, and optionally nested markets.',
        input_schema: {
            type: 'object' as const,
            properties: {
                limit: {
                    type: 'number',
                    description: 'Maximum events to return (default 100)',
                },
                status: {
                    type: 'string',
                    enum: ['open', 'closed', 'settled'],
                    description: 'Filter by event status',
                },
                series_ticker: {
                    type: 'string',
                    description: 'Filter by series ticker',
                },
                with_nested_markets: {
                    type: 'boolean',
                    description: 'Include all markets within each event (recommended for comprehensive data)',
                },
            },
            required: [],
        },
    },
    {
        name: 'get_kalshi_event',
        description: 'Get a specific Kalshi event with all its markets. Use when you know the event ticker.',
        input_schema: {
            type: 'object' as const,
            properties: {
                event_ticker: {
                    type: 'string',
                    description: 'The event ticker',
                },
            },
            required: ['event_ticker'],
        },
    },
    {
        name: 'get_kalshi_series',
        description: 'List series from Kalshi. Series are recurring event templates (e.g., "Daily Temperature", "Monthly Jobs Report"). Returns ticker, title, category, frequency, contracts_traded, open_interest, volume.',
        input_schema: {
            type: 'object' as const,
            properties: {
                limit: {
                    type: 'number',
                    description: 'Maximum series to return (default 100)',
                },
                category: {
                    type: 'string',
                    description: 'Filter by category',
                },
            },
            required: [],
        },
    },

    // ==================== POLYMARKET MARKET TOOLS ====================
    {
        name: 'get_polymarket_markets',
        description: 'Fetch markets from Polymarket Gamma API with comprehensive filtering. Returns id, slug, question, outcomes, outcomePrices (decimals 0-1), clobTokenIds, volume, liquidity, and more.',
        input_schema: {
            type: 'object' as const,
            properties: {
                limit: {
                    type: 'number',
                    description: 'Maximum markets to return (default 100)',
                },
                offset: {
                    type: 'number',
                    description: 'Pagination offset',
                },
                active: {
                    type: 'boolean',
                    description: 'Filter for active markets (default true)',
                },
                closed: {
                    type: 'boolean',
                    description: 'Filter for closed markets',
                },
                order: {
                    type: 'string',
                    enum: ['volume', 'liquidity', 'startDate', 'endDate'],
                    description: 'Sort field',
                },
                ascending: {
                    type: 'boolean',
                    description: 'Sort direction (false = descending)',
                },
                volume_num_min: {
                    type: 'number',
                    description: 'Minimum volume filter',
                },
                liquidity_num_min: {
                    type: 'number',
                    description: 'Minimum liquidity filter',
                },
                tag_id: {
                    type: 'number',
                    description: 'Filter by tag/category ID',
                },
                end_date_min: {
                    type: 'string',
                    description: 'Markets ending after this date (ISO format)',
                },
                end_date_max: {
                    type: 'string',
                    description: 'Markets ending before this date (ISO format)',
                },
            },
            required: [],
        },
    },
    {
        name: 'get_polymarket_market',
        description: 'Get detailed Polymarket market by ID or slug. Returns complete market data including outcomes, prices, clobTokenIds for trading.',
        input_schema: {
            type: 'object' as const,
            properties: {
                id: {
                    type: 'string',
                    description: 'Market ID (numeric) or slug',
                },
            },
            required: ['id'],
        },
    },
    {
        name: 'get_polymarket_events',
        description: 'List events from Polymarket. Events contain multiple related markets. More efficient than querying markets individually. Returns id, slug, title, markets array, tags, volume, liquidity.',
        input_schema: {
            type: 'object' as const,
            properties: {
                limit: {
                    type: 'number',
                    description: 'Maximum events to return (default 50)',
                },
                offset: {
                    type: 'number',
                    description: 'Pagination offset',
                },
                active: {
                    type: 'boolean',
                    description: 'Filter for active events',
                },
                closed: {
                    type: 'boolean',
                    description: 'Filter for closed events',
                },
                tag_id: {
                    type: 'number',
                    description: 'Filter by tag/category ID',
                },
                series_id: {
                    type: 'number',
                    description: 'Filter by series ID (for sports leagues)',
                },
                order: {
                    type: 'string',
                    enum: ['volume', 'liquidity', 'startDate', 'endDate'],
                    description: 'Sort field',
                },
                volume_num_min: {
                    type: 'number',
                    description: 'Minimum volume filter',
                },
            },
            required: [],
        },
    },
    {
        name: 'get_polymarket_event',
        description: 'Get a specific Polymarket event with all its markets. Use when you know the event ID or slug.',
        input_schema: {
            type: 'object' as const,
            properties: {
                id: {
                    type: 'string',
                    description: 'Event ID (numeric) or slug',
                },
            },
            required: ['id'],
        },
    },

    // ==================== POLYMARKET CLOB (TRADING) TOOLS ====================
    {
        name: 'get_polymarket_price',
        description: 'Get current price for a Polymarket token from CLOB. Returns decimal price (0-1) representing implied probability.',
        input_schema: {
            type: 'object' as const,
            properties: {
                token_id: {
                    type: 'string',
                    description: 'The token ID (from clobTokenIds array)',
                },
                side: {
                    type: 'string',
                    enum: ['BUY', 'SELL'],
                    description: 'Price side (optional)',
                },
            },
            required: ['token_id'],
        },
    },
    {
        name: 'get_polymarket_orderbook',
        description: 'Get order book for a Polymarket token. Returns bids and asks arrays with price and size.',
        input_schema: {
            type: 'object' as const,
            properties: {
                token_id: {
                    type: 'string',
                    description: 'The token ID (from clobTokenIds array)',
                },
            },
            required: ['token_id'],
        },
    },
    {
        name: 'get_polymarket_spread',
        description: 'Get bid-ask spread for a Polymarket token. Useful for assessing trading costs.',
        input_schema: {
            type: 'object' as const,
            properties: {
                token_id: {
                    type: 'string',
                    description: 'The token ID',
                },
            },
            required: ['token_id'],
        },
    },
    {
        name: 'get_polymarket_midpoint',
        description: 'Get midpoint price for a Polymarket token. The average of best bid and best ask.',
        input_schema: {
            type: 'object' as const,
            properties: {
                token_id: {
                    type: 'string',
                    description: 'The token ID',
                },
            },
            required: ['token_id'],
        },
    },
    {
        name: 'get_polymarket_price_history',
        description: 'Get historical price data (candlesticks) for a Polymarket market. Use for trend analysis.',
        input_schema: {
            type: 'object' as const,
            properties: {
                market: {
                    type: 'string',
                    description: 'Market identifier',
                },
                interval: {
                    type: 'string',
                    enum: ['1m', '5m', '15m', '1h', '4h', '1d'],
                    description: 'Candlestick interval',
                },
                startTs: {
                    type: 'number',
                    description: 'Start Unix timestamp',
                },
                endTs: {
                    type: 'number',
                    description: 'End Unix timestamp',
                },
            },
            required: ['market'],
        },
    },

    // ==================== POLYMARKET DISCOVERY TOOLS ====================
    {
        name: 'search_polymarket',
        description: 'Search across Polymarket markets, events, and profiles by keyword query.',
        input_schema: {
            type: 'object' as const,
            properties: {
                query: {
                    type: 'string',
                    description: 'Search query (e.g., "bitcoin", "election", "super bowl")',
                },
                limit: {
                    type: 'number',
                    description: 'Maximum results (default 20)',
                },
            },
            required: ['query'],
        },
    },
    {
        name: 'get_polymarket_tags',
        description: 'Get all available tags/categories on Polymarket. Use to discover category IDs for filtering.',
        input_schema: {
            type: 'object' as const,
            properties: {},
            required: [],
        },
    },
    {
        name: 'get_polymarket_sports',
        description: 'Get sports leagues with metadata. Returns tag_id, title, slug, series information. Use to discover sports markets.',
        input_schema: {
            type: 'object' as const,
            properties: {},
            required: [],
        },
    },
    {
        name: 'get_polymarket_series',
        description: 'List recurring market collections (series). Returns id, ticker, slug, title, seriesType, recurrence.',
        input_schema: {
            type: 'object' as const,
            properties: {},
            required: [],
        },
    },

    // ==================== CROSS-PLATFORM TOOLS ====================
    {
        name: 'get_trending_markets',
        description: `Get trending markets by 24h volume (already sorted by volume descending). 
        Returns top N most active markets. Use for: "trending", "popular", "most active", "hot markets".
        DO NOT make multiple calls - returns optimally sorted results in ONE call.`,
        input_schema: {
            type: 'object' as const,
            properties: {
                limit: {
                    type: 'number',
                    description: 'Number of markets to return (default 5, max 20)',
                },
                platform: {
                    type: 'string',
                    enum: ['kalshi', 'polymarket', 'all'],
                    description: 'Filter by platform (default "all")',
                },
            },
            required: [],
        },
    },
    {
        name: 'discover_markets',
        description: 'Advanced market discovery with filtering across both platforms. Use for targeted searches with multiple criteria.',
        input_schema: {
            type: 'object' as const,
            properties: {
                platform: {
                    type: 'string',
                    enum: ['kalshi', 'polymarket', 'all'],
                    description: 'Filter by platform',
                },
                category: {
                    type: 'string',
                    description: 'Category filter (e.g., "politics", "crypto", "sports")',
                },
                search_query: {
                    type: 'string',
                    description: 'Keyword search',
                },
                min_volume: {
                    type: 'number',
                    description: 'Minimum trading volume',
                },
                min_liquidity: {
                    type: 'number',
                    description: 'Minimum liquidity',
                },
                max_end_date: {
                    type: 'string',
                    description: 'Markets ending before this date (ISO format)',
                },
                min_end_date: {
                    type: 'string',
                    description: 'Markets ending after this date (ISO format)',
                },
                limit: {
                    type: 'number',
                    description: 'Maximum markets to return (default 30)',
                },
            },
            required: [],
        },
    },
    {
        name: 'analyze_market',
        description: 'Get comprehensive analysis of a specific market including opportunity score (1-100), implied probability, spread analysis, liquidity assessment, and risk factors.',
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
                    description: 'Market identifier (ticker for Kalshi, condition_id for Polymarket)',
                },
            },
            required: ['platform', 'market_id'],
        },
    },
    {
        name: 'compare_markets',
        description: 'Compare multiple markets side by side. Useful for finding best opportunities or arbitrage.',
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
                    description: 'Array of {platform, market_id} objects to compare',
                },
            },
            required: ['markets'],
        },
    },
];

// Type for tool input parameters
export interface ToolInput {
    // Kalshi params
    ticker?: string;
    depth?: number;
    event_ticker?: string;
    series_ticker?: string;
    tickers?: string;
    min_close_ts?: number;
    max_close_ts?: number;
    with_nested_markets?: boolean;
    min_ts?: number;
    max_ts?: number;

    // Polymarket params
    condition_id?: string;
    token_id?: string;
    query?: string;
    active?: boolean;
    closed?: boolean;
    tag_id?: number;
    series_id?: number;
    order?: string;
    ascending?: boolean;
    volume_num_min?: number;
    liquidity_num_min?: number;
    end_date_min?: string;
    end_date_max?: string;
    offset?: number;
    side?: 'BUY' | 'SELL';
    market?: string;
    interval?: string;
    startTs?: number;
    endTs?: number;
    id?: string;

    // Common params
    limit?: number;
    cursor?: string;
    status?: 'initialized' | 'open' | 'closed' | 'settled' | 'determined';
    category?: string;
    platform?: 'kalshi' | 'polymarket' | 'all';
    search_query?: string;
    min_volume?: number;
    min_liquidity?: number;
    max_end_date?: string;
    min_end_date?: string;
    market_id?: string;
    markets?: Array<{ platform: string; market_id: string }>;
}
