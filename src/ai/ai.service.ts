import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '../config/config.service';
import { ConversationService } from './conversation.service';
import { PREDICTMAX_SYSTEM_PROMPT } from './prompts';
import { PREDICTMAX_TOOLS, ToolInput } from './tools';
import { ENHANCED_TOOLS, EnhancedToolInput } from '../intelligence/enhanced-tools';
import { ENHANCED_SYSTEM_PROMPT } from '../intelligence/prompts';
import { IntelligenceToolHandler } from '../intelligence/tool-handler.service';
import { KalshiService } from '../integrations/kalshi.service';
import { PolymarketService } from '../integrations/polymarket.service';
import { MarketService } from '../market/market.service';

export interface ChatResponse {
    content: string;
    conversationId: string;
    messageId: string | null;
}

export interface MarketData {
    platform: string;
    marketId: string;
    question: string;
    yesPrice?: number;
    noPrice?: number;
    volume?: number;
    liquidity?: number;
    endDate?: string;
    category?: string;
}

export interface DiscoveryCriteria {
    category?: string;
    timeHorizon?: string;
    riskProfile?: 'conservative' | 'moderate' | 'aggressive';
    liquidityPreference?: 'high' | 'medium' | 'low';
}

@Injectable()
export class AiService {
    private anthropic: Anthropic;
    private readonly logger = new Logger(AiService.name);

    // Rate limiting configuration
    private readonly MAX_RETRIES = 1; // Fail fast on rate limits
    private readonly BASE_DELAY_MS = 500;
    private readonly MAX_DELAY_MS = 5000; // Cap delay at 5 seconds
    private readonly MAX_HISTORY_MESSAGES = 6;
    private readonly MAX_HISTORY_CHARS = 8000;
    private readonly MAX_TOOL_ITERATIONS = 3; // Limit tool call iterations

    // Combined tools: base + enhanced
    private readonly allTools = [...PREDICTMAX_TOOLS, ...ENHANCED_TOOLS];

    /**
     * Detect platform preference from user message OR conversation history.
     * This ensures we maintain context across the conversation.
     */
    private detectPlatformPreference(
        message: string,
        conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
    ): 'kalshi' | 'polymarket' | null {
        const lower = message.toLowerCase();
        const mentionsKalshi = lower.includes('kalshi');
        const mentionsPoly = lower.includes('polymarket') || lower.includes('poly market') || lower.includes('polymkt');

        // Current message takes priority
        if (mentionsKalshi && mentionsPoly) return null;
        if (mentionsKalshi) return 'kalshi';
        if (mentionsPoly) return 'polymarket';

        // Check recent conversation history for platform context
        if (conversationHistory && conversationHistory.length > 0) {
            // Look at the last 5 user messages for platform mentions
            const recentUserMessages = conversationHistory
                .filter(m => m.role === 'user')
                .slice(-5);

            for (const msg of recentUserMessages.reverse()) {
                const msgLower = msg.content.toLowerCase();
                const hasKalshi = msgLower.includes('kalshi');
                const hasPoly = msgLower.includes('polymarket') || msgLower.includes('poly market');

                if (hasKalshi && !hasPoly) return 'kalshi';
                if (hasPoly && !hasKalshi) return 'polymarket';
            }
        }

        return null;
    }

    /**
     * Apply platform constraint to tool input when user specifies a platform.
     * This ensures we ONLY query the platform the user asked about.
     */
    private applyPlatformConstraint(
        toolName: string,
        toolInput: ToolInput,
        platformConstraint: 'kalshi' | 'polymarket' | null,
    ): ToolInput {
        if (!platformConstraint) return toolInput;

        const constrainedInput = { ...toolInput } as ToolInput;

        // ALWAYS inject platform into tools that support it
        // This prevents accidental queries to the wrong platform
        const platformSupportingTools = [
            'get_trending_markets',
            'discover_markets',
            'analyze_market',
            'compare_markets',
            'intelligent_search',
            'analyze_market_deep',
            'find_best_opportunity',
            'category_scan',
        ];

        if (platformSupportingTools.includes(toolName)) {
            constrainedInput.platform = platformConstraint;
            this.logger.debug(`Injected platform ${platformConstraint} into ${toolName}`);
        }

        // Block platform-specific tools that don't match
        if (platformConstraint === 'polymarket' && toolName.startsWith('get_kalshi_')) {
            this.logger.warn(`Blocked ${toolName} - user requested polymarket`);
            return { ...constrainedInput, platform: 'polymarket', _constraint_error: 'platform_mismatch' } as ToolInput;
        }
        if (platformConstraint === 'kalshi' && (toolName.startsWith('get_polymarket_') || toolName.startsWith('search_polymarket'))) {
            this.logger.warn(`Blocked ${toolName} - user requested kalshi`);
            return { ...constrainedInput, platform: 'kalshi', _constraint_error: 'platform_mismatch' } as ToolInput;
        }

        return constrainedInput;
    }

    constructor(
        private configService: ConfigService,
        private conversationService: ConversationService,
        private kalshiService: KalshiService,
        private polymarketService: PolymarketService,
        private marketService: MarketService,
        private intelligenceToolHandler: IntelligenceToolHandler,
    ) {
        const apiKey = this.configService?.anthropicApiKey || '';
        if (!apiKey) {
            this.logger.warn('ANTHROPIC_API_KEY is missing. AI functionality will fail at runtime.');
        }
        this.anthropic = new Anthropic({
            apiKey: apiKey || 'placeholder',
        });
    }

    /**
     * Sleep for a given number of milliseconds
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Make an API call with exponential backoff retry logic for rate limits
     */
    private async callWithRetry<T>(
        apiCall: () => Promise<T>,
        context: string = 'API call'
    ): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
            try {
                return await apiCall();
            } catch (error: unknown) {
                lastError = error as Error;

                // Check if it's a rate limit error
                if (this.isRateLimitError(error)) {
                    const retryAfter = this.getRetryAfterSeconds(error);
                    // Cap delay at MAX_DELAY_MS to avoid long waits
                    const rawDelay = retryAfter
                        ? retryAfter * 1000
                        : this.BASE_DELAY_MS * Math.pow(2, attempt);
                    const delay = Math.min(rawDelay, this.MAX_DELAY_MS);

                    this.logger.warn(
                        `Rate limit hit for ${context}. Attempt ${attempt + 1}/${this.MAX_RETRIES}. ` +
                        `Waiting ${delay}ms before retry...`
                    );

                    await this.sleep(delay);
                    continue;
                }

                // Not a rate limit error, throw immediately
                throw error;
            }
        }

        // All retries exhausted
        throw lastError || new Error(`${context} failed after ${this.MAX_RETRIES} retries`);
    }

    /**
     * Check if error is a rate limit error (429)
     */
    private isRateLimitError(error: unknown): boolean {
        if (error && typeof error === 'object') {
            const err = error as { status?: number; message?: string };
            return err.status === 429 ||
                (err.message?.includes('rate_limit') ?? false) ||
                (err.message?.includes('429') ?? false);
        }
        return false;
    }

    /**
     * Extract retry-after header from rate limit error
     */
    private getRetryAfterSeconds(error: unknown): number | null {
        if (error && typeof error === 'object') {
            const err = error as { headers?: { get?: (key: string) => string | null } };
            const retryAfter = err.headers?.get?.('retry-after');
            if (retryAfter) {
                const seconds = parseInt(retryAfter, 10);
                return isNaN(seconds) ? null : seconds;
            }
        }
        return null;
    }

    /**
     * Trim conversation history to stay within token limits
     */
    private trimHistory(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
        // Always keep at least the last message
        if (messages.length <= 1) return messages;

        // First, limit by message count
        let trimmed = messages.slice(-this.MAX_HISTORY_MESSAGES);

        // Then, limit by total character count (rough proxy for tokens)
        let totalChars = 0;
        const result: Anthropic.MessageParam[] = [];

        // Build from most recent to oldest
        for (let i = trimmed.length - 1; i >= 0; i--) {
            const msg = trimmed[i];
            const content = typeof msg.content === 'string'
                ? msg.content
                : JSON.stringify(msg.content);
            const msgChars = content.length;

            if (totalChars + msgChars <= this.MAX_HISTORY_CHARS || result.length === 0) {
                result.unshift(msg);
                totalChars += msgChars;
            } else {
                // We've hit the limit, stop adding more
                break;
            }
        }

        // Ensure first message is from user (Claude requirement)
        if (result.length > 0 && result[0].role === 'assistant') {
            result.shift();
        }

        if (result.length < messages.length) {
            this.logger.log(`Trimmed conversation history from ${messages.length} to ${result.length} messages`);
        }

        return result;
    }

    /**
     * Truncate large results and remove non-essential fields to save tokens
     */
    private truncateResults(obj: any, limit = 10): any {
        if (Array.isArray(obj)) {
            if (obj.length > limit) {
                return [
                    ...obj.slice(0, limit).map(item => this.truncateResults(item, limit)),
                    { _info: `... and ${obj.length - limit} more items were truncated to stay within token limits.` }
                ];
            }
            return obj.map(item => this.truncateResults(item, limit));
        } else if (typeof obj === 'object' && obj !== null) {
            // Check for specific fields to omit to save tokens
            const skipFields = ['raw', 'description', 'icons', 'images', 'urls', 'tags'];
            const newObj: any = {};

            for (const [key, value] of Object.entries(obj)) {
                if (skipFields.includes(key)) continue;
                newObj[key] = this.truncateResults(value, limit);
            }
            return newObj;
        }
        return obj;
    }

    /**
     * Execute a tool call and return the result
     */
    private async executeTool(
        toolName: string,
        toolInput: ToolInput,
        platformConstraint: 'kalshi' | 'polymarket' | null = null,
    ): Promise<string> {
        const constrainedInput = this.applyPlatformConstraint(toolName, toolInput, platformConstraint);
        this.logger.log(`Executing tool: ${toolName} with input: ${JSON.stringify(constrainedInput)}`);
        const timestamp = new Date().toISOString();

        try {
            if ((constrainedInput as any)._constraint_error === 'platform_mismatch') {
                const requested = platformConstraint || 'the requested platform';
                return JSON.stringify({
                    error: `Platform mismatch: user requested ${requested}. Please use ${requested} tools.`,
                    timestamp,
                });
            }

            let result: any;
            switch (toolName) {
                // ==================== KALSHI MARKET TOOLS ====================
                case 'get_kalshi_markets': {
                    const markets = await this.kalshiService.getMarkets({
                        limit: constrainedInput.limit || 100,
                        cursor: constrainedInput.cursor,
                        status: constrainedInput.status as 'open' | 'closed' | 'settled',
                        event_ticker: constrainedInput.event_ticker,
                        series_ticker: constrainedInput.series_ticker,
                        tickers: constrainedInput.tickers?.split(','),
                        min_close_ts: constrainedInput.min_close_ts,
                        max_close_ts: constrainedInput.max_close_ts,
                    });
                    result = {
                        platform: 'kalshi',
                        endpoint: 'GET /markets',
                        timestamp,
                        count: markets.length,
                        markets: markets.map(m => this.kalshiService.normalizeMarket(m)),
                    };
                    break;
                }

                case 'get_kalshi_market': {
                    const market = await this.kalshiService.getMarket(constrainedInput.ticker!);
                    if (!market) {
                        result = { error: `Market ${constrainedInput.ticker} not found`, timestamp };
                    } else {
                        result = {
                            platform: 'kalshi',
                            endpoint: `GET /markets/${constrainedInput.ticker}`,
                            timestamp,
                            market: this.kalshiService.normalizeMarket(market),
                            raw: market,
                        };
                    }
                    break;
                }

                case 'get_kalshi_orderbook': {
                    const orderbook = await this.kalshiService.getOrderBook(
                        constrainedInput.ticker!,
                        constrainedInput.depth || 10
                    );
                    if (!orderbook) {
                        result = { error: `Order book for ${constrainedInput.ticker} not found`, timestamp };
                    } else {
                        result = {
                            platform: 'kalshi',
                            endpoint: `GET /markets/${constrainedInput.ticker}/orderbook`,
                            timestamp,
                            ticker: constrainedInput.ticker,
                            orderbook,
                            note: 'Prices in cents (0-100). Only bids shown; yes_bid + no_ask ≈ 100.',
                        };
                    }
                    break;
                }

                case 'get_kalshi_trades': {
                    const trades = await this.kalshiService.getTrades({
                        ticker: constrainedInput.ticker,
                        limit: constrainedInput.limit || 50,
                        cursor: constrainedInput.cursor,
                        min_ts: constrainedInput.min_ts,
                        max_ts: constrainedInput.max_ts,
                    });
                    result = {
                        platform: 'kalshi',
                        endpoint: constrainedInput.ticker ? `GET /markets/${constrainedInput.ticker}/trades` : 'GET /markets/trades',
                        timestamp,
                        count: trades.length,
                        trades,
                    };
                    break;
                }

                case 'get_kalshi_market_history': {
                    const history = await this.kalshiService.getHistoricalPrices(
                        constrainedInput.ticker!,
                        constrainedInput.min_ts,
                        constrainedInput.max_ts
                    );
                    result = {
                        platform: 'kalshi',
                        endpoint: `GET /markets/${constrainedInput.ticker}/history`,
                        timestamp,
                        ticker: constrainedInput.ticker,
                        data_points: history.length,
                        history,
                    };
                    break;
                }

                // ==================== KALSHI EVENT & SERIES TOOLS ====================
                case 'get_kalshi_events': {
                    const events = await this.kalshiService.getEvents(
                        constrainedInput.limit || 100,
                        constrainedInput.status as 'open' | 'closed' | 'settled'
                    );
                    result = {
                        platform: 'kalshi',
                        endpoint: 'GET /events',
                        timestamp,
                        count: events.length,
                        events,
                    };
                    break;
                }

                case 'get_kalshi_event': {
                    const event = await this.kalshiService.getEvent(constrainedInput.event_ticker!);
                    if (!event) {
                        result = { error: `Event ${constrainedInput.event_ticker} not found`, timestamp };
                    } else {
                        result = {
                            platform: 'kalshi',
                            endpoint: `GET /events/${constrainedInput.event_ticker}`,
                            timestamp,
                            event,
                        };
                    }
                    break;
                }

                case 'get_kalshi_series': {
                    // Kalshi series endpoint - using events as proxy
                    const events = await this.kalshiService.getEvents(constrainedInput.limit || 50);
                    // Extract unique series from events
                    const seriesSet = new Set<string>();
                    const seriesList = events.filter(e => {
                        if (seriesSet.has(e.series_ticker || '')) return false;
                        seriesSet.add(e.series_ticker || '');
                        return true;
                    }).map(e => ({
                        series_ticker: e.series_ticker,
                        category: e.category,
                        sample_event: e.title,
                    }));
                    result = {
                        platform: 'kalshi',
                        endpoint: 'GET /series',
                        timestamp,
                        count: seriesList.length,
                        series: seriesList,
                        note: 'Series extracted from events. Use series_ticker to filter markets/events.',
                    };
                    break;
                }

                // ==================== POLYMARKET MARKET TOOLS ====================
                case 'get_polymarket_markets': {
                    let markets;
                    if (constrainedInput.category) {
                        markets = await this.polymarketService.getMarketsByCategory(
                            constrainedInput.category,
                            constrainedInput.limit || 50
                        );
                    } else {
                        markets = await this.polymarketService.getMarkets(
                            constrainedInput.limit || 100,
                            constrainedInput.offset || 0,
                            constrainedInput.active !== false
                        );
                    }
                    result = {
                        platform: 'polymarket',
                        endpoint: 'GET /markets (Gamma API)',
                        timestamp,
                        count: markets.length,
                        markets: markets.map(m => this.polymarketService.normalizeMarket(m)),
                    };
                    break;
                }

                case 'get_polymarket_market': {
                    const market = await this.polymarketService.getMarket(constrainedInput.id || constrainedInput.condition_id!);
                    if (!market) {
                        result = { error: `Market ${constrainedInput.id || constrainedInput.condition_id} not found`, timestamp };
                    } else {
                        result = {
                            platform: 'polymarket',
                            endpoint: `GET /markets/${constrainedInput.id || constrainedInput.condition_id}`,
                            timestamp,
                            market: this.polymarketService.normalizeMarket(market),
                            raw: market,
                        };
                    }
                    break;
                }

                case 'get_polymarket_events': {
                    // Use markets endpoint grouped by event (Gamma API)
                    const markets = await this.polymarketService.getMarkets(
                        constrainedInput.limit || 50,
                        constrainedInput.offset || 0,
                        constrainedInput.active !== false
                    );
                    // Group markets by category as proxy for events
                    const eventsByCategory = new Map<string, any[]>();
                    markets.forEach(m => {
                        const cat = m.category || 'other';
                        if (!eventsByCategory.has(cat)) eventsByCategory.set(cat, []);
                        eventsByCategory.get(cat)!.push(m);
                    });
                    const events = Array.from(eventsByCategory.entries()).map(([category, mkts]) => ({
                        category,
                        market_count: mkts.length,
                        total_volume: mkts.reduce((sum, m) => sum + (m.volume_num || 0), 0),
                        markets: mkts.slice(0, 5).map(m => this.polymarketService.normalizeMarket(m)),
                    }));
                    result = {
                        platform: 'polymarket',
                        endpoint: 'GET /events (Gamma API)',
                        timestamp,
                        count: events.length,
                        events,
                    };
                    break;
                }

                case 'get_polymarket_event': {
                    // Get market by ID/slug
                    const market = await this.polymarketService.getMarket(constrainedInput.id!);
                    if (!market) {
                        result = { error: `Event/Market ${constrainedInput.id} not found`, timestamp };
                    } else {
                        result = {
                            platform: 'polymarket',
                            endpoint: `GET /events/${constrainedInput.id}`,
                            timestamp,
                            event: this.polymarketService.normalizeMarket(market),
                        };
                    }
                    break;
                }

                // ==================== POLYMARKET CLOB TOOLS ====================
                case 'get_polymarket_price': {
                    const price = await this.polymarketService.getPrice(constrainedInput.token_id!);
                    if (price === null) {
                        result = { error: `Price for ${constrainedInput.token_id} not found`, timestamp };
                    } else {
                        result = {
                            platform: 'polymarket',
                            endpoint: 'GET /price (CLOB API)',
                            timestamp,
                            token_id: constrainedInput.token_id,
                            price,
                            implied_probability: `${(price * 100).toFixed(1)}%`,
                        };
                    }
                    break;
                }

                case 'get_polymarket_orderbook': {
                    const orderbook = await this.polymarketService.getOrderBook(constrainedInput.token_id!);
                    if (!orderbook) {
                        result = { error: `Order book for ${constrainedInput.token_id} not found`, timestamp };
                    } else {
                        result = {
                            platform: 'polymarket',
                            endpoint: 'GET /book (CLOB API)',
                            timestamp,
                            token_id: constrainedInput.token_id,
                            orderbook,
                        };
                    }
                    break;
                }

                case 'get_polymarket_spread': {
                    const orderbook = await this.polymarketService.getOrderBook(constrainedInput.token_id!);
                    if (!orderbook) {
                        result = { error: `Spread for ${constrainedInput.token_id} not found`, timestamp };
                    } else {
                        const bestBid = orderbook.bids?.[0] ? parseFloat(orderbook.bids[0].price) : 0;
                        const bestAsk = orderbook.asks?.[0] ? parseFloat(orderbook.asks[0].price) : 1;
                        const spread = bestAsk - bestBid;
                        result = {
                            platform: 'polymarket',
                            endpoint: 'GET /spread (CLOB API)',
                            timestamp,
                            token_id: constrainedInput.token_id,
                            best_bid: bestBid,
                            best_ask: bestAsk,
                            spread,
                            spread_percent: `${(spread * 100).toFixed(2)}%`,
                        };
                    }
                    break;
                }

                case 'get_polymarket_midpoint': {
                    const midpoint = await this.polymarketService.getMidpoint(constrainedInput.token_id!);
                    if (midpoint === null) {
                        result = { error: `Midpoint for ${constrainedInput.token_id} not found`, timestamp };
                    } else {
                        result = {
                            platform: 'polymarket',
                            endpoint: 'GET /midpoint (CLOB API)',
                            timestamp,
                            token_id: constrainedInput.token_id,
                            midpoint,
                            implied_probability: `${(midpoint * 100).toFixed(1)}%`,
                        };
                    }
                    break;
                }

                case 'get_polymarket_price_history': {
                    result = {
                        platform: 'polymarket',
                        endpoint: 'GET /prices-history',
                        timestamp,
                        market: constrainedInput.market,
                        note: 'Historical price data endpoint. Use interval parameter (1m, 5m, 1h, 1d) for candlestick granularity.',
                        status: 'Endpoint available - implementation pending',
                    };
                    break;
                }

                // ==================== POLYMARKET DISCOVERY TOOLS ====================
                case 'search_polymarket': {
                    const markets = await this.polymarketService.searchMarkets(
                        constrainedInput.query!,
                        constrainedInput.limit || 20
                    );
                    result = {
                        platform: 'polymarket',
                        endpoint: 'GET /search',
                        timestamp,
                        query: constrainedInput.query,
                        count: markets.length,
                        markets: markets.map(m => this.polymarketService.normalizeMarket(m)),
                    };
                    break;
                }

                case 'get_polymarket_tags': {
                    // Return common category tags
                    const tags = [
                        { id: 1, label: 'Politics', slug: 'politics' },
                        { id: 2, label: 'Crypto', slug: 'crypto' },
                        { id: 3, label: 'Sports', slug: 'sports' },
                        { id: 4, label: 'Pop Culture', slug: 'pop-culture' },
                        { id: 5, label: 'Science', slug: 'science' },
                        { id: 6, label: 'Business', slug: 'business' },
                        { id: 7, label: 'Finance', slug: 'finance' },
                    ];
                    result = {
                        platform: 'polymarket',
                        endpoint: 'GET /tags',
                        timestamp,
                        tags,
                        note: 'Use tag slugs or IDs to filter markets by category.',
                    };
                    break;
                }

                case 'get_polymarket_sports': {
                    // Return sports categories
                    const sports = [
                        { tag_id: 100, title: 'NFL', slug: 'nfl' },
                        { tag_id: 101, title: 'NBA', slug: 'nba' },
                        { tag_id: 102, title: 'MLB', slug: 'mlb' },
                        { tag_id: 103, title: 'Soccer', slug: 'soccer' },
                        { tag_id: 104, title: 'UFC', slug: 'ufc' },
                        { tag_id: 105, title: 'Tennis', slug: 'tennis' },
                    ];
                    result = {
                        platform: 'polymarket',
                        endpoint: 'GET /sports',
                        timestamp,
                        sports,
                        note: 'Use tag_id to filter events by sport. Query markets with category filter.',
                    };
                    break;
                }

                case 'get_polymarket_series': {
                    // Series information
                    result = {
                        platform: 'polymarket',
                        endpoint: 'GET /series',
                        timestamp,
                        note: 'Series represent recurring market collections (e.g., weekly sports events).',
                        status: 'Query events with series_id filter for specific series.',
                    };
                    break;
                }

                // ==================== CROSS-PLATFORM TOOLS ====================
                case 'get_trending_markets': {
                    const limit = constrainedInput.limit || 20;
                    let markets;

                    if (constrainedInput.platform === 'kalshi') {
                        const kalshi = await this.kalshiService.getTrendingMarkets(limit);
                        markets = kalshi.map((m) => this.kalshiService.normalizeMarket(m));
                    } else if (constrainedInput.platform === 'polymarket') {
                        const poly = await this.polymarketService.getTrendingMarkets(limit);
                        markets = poly.map((m) => this.polymarketService.normalizeMarket(m));
                    } else {
                        markets = await this.marketService.getTrendingMarkets(limit);
                    }

                    const filtered = constrainedInput.platform && constrainedInput.platform !== 'all'
                        ? markets.filter(m => m.platform === constrainedInput.platform)
                        : markets;
                    result = {
                        endpoint: 'Cross-platform trending',
                        timestamp,
                        platform_filter: constrainedInput.platform || 'all',
                        count: filtered.length,
                        markets: filtered,
                    };
                    break;
                }

                case 'discover_markets': {
                    const markets = await this.marketService.discoverMarkets({
                        platform: constrainedInput.platform as 'kalshi' | 'polymarket' | 'all',
                        category: constrainedInput.category,
                        searchQuery: constrainedInput.search_query,
                        minVolume: constrainedInput.min_volume,
                        minLiquidity: constrainedInput.min_liquidity,
                        maxEndDate: constrainedInput.max_end_date ? new Date(constrainedInput.max_end_date) : undefined,
                        minEndDate: constrainedInput.min_end_date ? new Date(constrainedInput.min_end_date) : undefined,
                        limit: constrainedInput.limit || 30,
                    });
                    result = {
                        endpoint: 'Cross-platform discovery',
                        timestamp,
                        filters: {
                            platform: constrainedInput.platform,
                            category: constrainedInput.category,
                            search_query: constrainedInput.search_query,
                            min_volume: constrainedInput.min_volume,
                        },
                        count: markets.length,
                        markets,
                    };
                    break;
                }

                case 'analyze_market': {
                    const market = await this.marketService.getMarketDetails(
                        constrainedInput.platform!,
                        constrainedInput.market_id!
                    );
                    if (!market) {
                        result = { error: `Market ${constrainedInput.market_id} not found on ${constrainedInput.platform}`, timestamp };
                    } else {
                        const analysis = await this.marketService.analyzeOpportunity(market);
                        result = {
                            endpoint: 'Market analysis',
                            timestamp,
                            platform: constrainedInput.platform,
                            market_id: constrainedInput.market_id,
                            analysis,
                        };
                    }
                    break;
                }

                case 'compare_markets': {
                    if (!constrainedInput.markets || constrainedInput.markets.length === 0) {
                        result = { error: 'No markets provided for comparison', timestamp };
                    } else {
                        const comparisons = await Promise.all(
                            constrainedInput.markets.map(async (m) => {
                                const market = await this.marketService.getMarketDetails(m.platform, m.market_id);
                                if (!market) return { platform: m.platform, market_id: m.market_id, error: 'Not found' };
                                const analysis = await this.marketService.analyzeOpportunity(market);
                                return { ...analysis };
                            })
                        );
                        result = {
                            endpoint: 'Market comparison',
                            timestamp,
                            count: comparisons.length,
                            comparisons,
                        };
                    }
                    break;
                }

                default:
                    // Check if it's an enhanced tool
                    if (this.intelligenceToolHandler.isEnhancedTool(toolName)) {
                        result = await this.intelligenceToolHandler.executeTool(
                            toolName,
                            constrainedInput as EnhancedToolInput
                        );
                        // Enhanced tools return formatted results
                        return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
                    }
                    result = { error: `Unknown tool: ${toolName}`, timestamp };
            }

            // Truncate and optimize result for tokens
            const optimizedResult = this.truncateResults(result);
            return JSON.stringify(optimizedResult, null, 2);
        } catch (error) {
            this.logger.error(`Tool execution error for ${toolName}:`, error);
            return JSON.stringify({
                error: `Failed to execute ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                timestamp,
            });
        }
    }

    async chat(
        message: string,
        conversationId: string,
        userId: string,
    ): Promise<ChatResponse> {
        try {
            // Get or create conversation
            let conversation = await this.conversationService.getConversation(conversationId);
            if (!conversation) {
                conversation = await this.conversationService.createConversation(userId, undefined);
                if (!conversation) {
                    throw new Error('Failed to create conversation');
                }
                conversationId = conversation.id;
            }

            // Store user message
            await this.conversationService.addMessage(conversationId, 'user', message);

            // Get conversation history
            const history = await this.conversationService.getMessageHistory(conversationId);

            // Build messages array for Claude, filtering out any empty content
            let messages: Anthropic.MessageParam[] = history
                .filter(m => m.content && m.content.trim().length > 0)
                .map((m) => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                }));

            // Trim history to stay within token limits
            messages = this.trimHistory(messages);

            // Tool calling loop with retry logic
            // Use enhanced system prompt and combined tools
            // Detect platform with conversation context
            const platformConstraint = this.detectPlatformPreference(message, history);
            this.logger.log(`Platform constraint detected: ${platformConstraint || 'none'} (from message: "${message.slice(0, 50)}...")`);

            // Build a more intelligent system prompt with context awareness
            let systemPrompt = ENHANCED_SYSTEM_PROMPT;

            if (platformConstraint) {
                systemPrompt += `\n\n## CRITICAL PLATFORM CONSTRAINT
The user is working with ${platformConstraint.toUpperCase()} ONLY.
- Do NOT call any ${platformConstraint === 'kalshi' ? 'Polymarket' : 'Kalshi'} tools or APIs
- Use ONLY ${platformConstraint} tools: ${platformConstraint === 'kalshi' ? 'get_kalshi_markets, get_kalshi_event, etc.' : 'get_polymarket_events, search_polymarket, etc.'}
- If asked for trending/discover, pass platform: "${platformConstraint}" explicitly`;
            }

            // Add context awareness instruction
            systemPrompt += `\n\n## CONVERSATION CONTEXT
This is turn ${messages.length + 1} of the conversation. Maintain context from previous messages.
- If the user refers to "this market" or "that one", look at recent context to understand what they mean
- Remember what markets/data you discussed previously
- Build on previous analysis, don't start from scratch each time

## CRITICAL: ALWAYS PROVIDE A REAL RESPONSE
You MUST always provide a substantive, helpful response. NEVER leave the user hanging with just tool results.
- After using tools, ALWAYS synthesize the results into a clear answer
- If you're analyzing a market, give your opinion and recommendation
- If data is missing or tools fail, explain what happened and suggest alternatives
- Never respond with just "I have processed the data" - that is NOT acceptable`;
            let response = await this.callWithRetry(
                () => this.anthropic.messages.create({
                    model: 'claude-sonnet-4-20250514',
                    max_tokens: 8192,
                    system: systemPrompt,
                    tools: this.allTools,
                    messages,
                }),
                'initial chat request'
            );

            // Process tool calls in a loop until we get a final response
            let iterations = 0;
            const maxIterations = this.MAX_TOOL_ITERATIONS; // Limit tool calls to reduce token usage

            while (response.stop_reason === 'tool_use' && iterations < maxIterations) {
                iterations++;
                const toolUseBlocks = response.content.filter(
                    (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
                );

                if (toolUseBlocks.length === 0) break;

                this.logger.log(`Tool calling iteration ${iterations}: ${toolUseBlocks.length} tools`);
                this.logger.debug(`Platform constraint: ${platformConstraint || 'none'}`);
                toolUseBlocks.forEach(t => this.logger.debug(`  Tool: ${t.name}, Input: ${JSON.stringify(t.input)}`));

                // Execute all tool calls in parallel
                const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
                    toolUseBlocks.map(async (toolUse) => {
                        this.logger.log(`Executing ${toolUse.name} with platform constraint: ${platformConstraint || 'none'}`);
                        const result = await this.executeTool(
                            toolUse.name,
                            toolUse.input as ToolInput,
                            platformConstraint
                        );
                        return {
                            type: 'tool_result' as const,
                            tool_use_id: toolUse.id,
                            content: result,
                        };
                    })
                );

                // Continue conversation with tool results
                messages.push({
                    role: 'assistant',
                    content: response.content,
                });
                messages.push({
                    role: 'user',
                    content: toolResults,
                });

                // Get next response with retry logic
                response = await this.callWithRetry(
                    () => this.anthropic.messages.create({
                        model: 'claude-sonnet-4-20250514',
                        max_tokens: 8192,
                        system: systemPrompt,
                        tools: this.allTools,
                        messages,
                    }),
                    `tool iteration ${iterations}`
                );
            }

            const textBlocks = response.content.filter(
                (block): block is Anthropic.TextBlock => block.type === 'text'
            );
            let assistantMessage = textBlocks.map(b => b.text).join('\n');

            // If Claude only returned tool calls without a response, force a synthesis
            if (!assistantMessage || assistantMessage.trim().length === 0) {
                this.logger.warn('Empty assistant response detected, requesting synthesis...');

                // Ask Claude to synthesize the results into a proper response
                const synthesisResponse = await this.callWithRetry(
                    () => this.anthropic.messages.create({
                        model: 'claude-sonnet-4-20250514',
                        max_tokens: 2048,
                        system: `You are PredictMax, an AI prediction market analyst. The user asked a question and you gathered data using tools, but you forgot to provide an actual response. Based on the conversation, provide a helpful, conversational answer. Be specific and actionable. Never say "I have processed the data" - actually tell them what you found.`,
                        messages: [
                            ...messages.slice(-4), // Include recent context
                            {
                                role: 'user',
                                content: 'Please provide a helpful response based on our conversation and the data you gathered. What did you find? What do you recommend?'
                            }
                        ],
                    }),
                    'synthesis request'
                );

                const synthesisText = synthesisResponse.content.filter(
                    (block): block is Anthropic.TextBlock => block.type === 'text'
                );
                assistantMessage = synthesisText.map(b => b.text).join('\n') ||
                    "I encountered an issue gathering that information. Could you please rephrase your question or try asking about a specific market?";
            }

            // Store assistant response
            const savedMessage = await this.conversationService.addMessage(
                conversationId,
                'assistant',
                assistantMessage,
                {
                    model: response.model,
                    usage: response.usage,
                    tool_iterations: iterations,
                },
            );

            return {
                content: assistantMessage,
                conversationId,
                messageId: savedMessage?.id || null,
            };
        } catch (error) {
            this.logger.error('Chat error:', error);

            // Provide user-friendly error message for rate limits
            if (this.isRateLimitError(error)) {
                const retryAfter = this.getRetryAfterSeconds(error);
                const waitMsg = retryAfter ? `Please wait ${retryAfter} seconds` : 'Please wait a moment';
                return {
                    content: `I'm currently experiencing high demand. ${waitMsg} and try again. If this persists, try a shorter question or start a new conversation.`,
                    conversationId,
                    messageId: null,
                };
            }

            throw error;
        }
    }

    async generateTitle(content: string): Promise<string> {
        const response = await this.anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 50,
            messages: [
                {
                    role: 'user',
                    content: `Generate a short, descriptive title (max 6 words) for a conversation that starts with: "${content.slice(0, 200)}"`,
                },
            ],
        });

        return response.content[0].type === 'text'
            ? response.content[0].text.replace(/"/g, '').trim()
            : 'New Conversation';
    }

    /**
     * Analyze a single market (for REST API backward compatibility)
     */
    async analyzeMarket(market: MarketData): Promise<string> {
        const response = await this.anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2048,
            system: PREDICTMAX_SYSTEM_PROMPT,
            messages: [
                {
                    role: 'user',
                    content: `Analyze this prediction market:\n\n${JSON.stringify(market, null, 2)}\n\nProvide:\n1. Market Overview\n2. Current Odds Analysis\n3. Liquidity Assessment\n4. Key Factors\n5. Risk Assessment\n6. Opportunity Score (1-10)`,
                },
            ],
        });

        return response.content[0].type === 'text' ? response.content[0].text : '';
    }

    /**
     * Compare multiple markets (for REST API backward compatibility)
     */
    async compareMarkets(markets: MarketData[]): Promise<string> {
        const response = await this.anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 3000,
            system: PREDICTMAX_SYSTEM_PROMPT,
            messages: [
                {
                    role: 'user',
                    content: `Compare these prediction markets:\n\n${JSON.stringify(markets, null, 2)}\n\nProvide:\n1. Summary Table\n2. Similarities & Differences\n3. Best Value\n4. Recommendation`,
                },
            ],
        });

        return response.content[0].type === 'text' ? response.content[0].text : '';
    }

    /**
     * Get recommendations based on criteria (for REST API backward compatibility)
     */
    async getRecommendations(
        criteria: DiscoveryCriteria,
        availableMarkets: MarketData[],
    ): Promise<string> {
        const response = await this.anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 3000,
            system: PREDICTMAX_SYSTEM_PROMPT,
            messages: [
                {
                    role: 'user',
                    content: `Based on these criteria:\n- Category: ${criteria.category || 'any'}\n- Time Horizon: ${criteria.timeHorizon || 'any'}\n- Risk Profile: ${criteria.riskProfile || 'moderate'}\n- Liquidity: ${criteria.liquidityPreference || 'medium'}\n\nRecommend the best markets from:\n${JSON.stringify(availableMarkets, null, 2)}\n\nProvide top 3-5 recommendations with reasoning.`,
                },
            ],
        });

        return response.content[0].type === 'text' ? response.content[0].text : '';
    }
}

