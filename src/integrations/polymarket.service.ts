/**
 * Polymarket Service
 *
 * Official Polymarket API Integration
 * Documentation: https://docs.polymarket.com
 *
 * IMPORTANT: No API key, authentication, or wallet is required to fetch market data.
 * Read-only endpoints are fully public.
 *
 * API Structure:
 * - Gamma API (https://gamma-api.polymarket.com): Market discovery, metadata, events
 * - CLOB API (https://clob.polymarket.com): Prices, order books, trading
 * - Data API (https://data-api.polymarket.com): User positions, trade history
 */

import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { HttpsAgent } from 'agentkeepalive';
import { ConfigService } from '../config/config.service';
import { CacheService } from '../common/cache.service';

export interface PolymarketMarket {
    condition_id: string;
    question_id: string;
    tokens: PolymarketToken[];
    question: string;
    description: string;
    end_date_iso: string;
    game_start_time?: string;
    category: string;
    volume: string;
    volume_num: number;
    liquidity: string;
    liquidity_num: number;
    outcomes: string[];
    outcome_prices: string[];
    active: boolean;
    closed: boolean;
    archived: boolean;
    accepting_orders: boolean;
    accepting_order_timestamp?: string;
    minimum_order_size: string;
    minimum_tick_size: string;
}

export interface PolymarketToken {
    token_id: string;
    outcome: string;
    price: number;
    winner: boolean;
}

export interface PolymarketOrderBook {
    market: string;
    asset_id: string;
    bids: Array<{ price: string; size: string }>;
    asks: Array<{ price: string; size: string }>;
    timestamp: string;
}

export interface PolymarketPrice {
    token_id: string;
    price: number;
}

@Injectable()
export class PolymarketService {
    private readonly gammaClient: AxiosInstance;
    private readonly clobClient: AxiosInstance;
    private readonly logger = new Logger(PolymarketService.name);
    private pendingRequests = new Map<string, Promise<any>>();

    // Official Polymarket API endpoints (docs.polymarket.com)
    private readonly GAMMA_API_URL = 'https://gamma-api.polymarket.com';
    private readonly CLOB_API_URL = 'https://clob.polymarket.com';

    constructor(
        private configService: ConfigService,
        private cacheService: CacheService,
    ) {
        // HTTP connection pooling with keep-alive
        const httpsAgent = new HttpsAgent({
            keepAlive: true,
            maxSockets: 50,
            maxFreeSockets: 10,
            timeout: 60000,
            freeSocketTimeout: 30000,
        });

        // Gamma API - Market discovery and metadata
        // No authentication required for read-only operations
        this.gammaClient = axios.create({
            baseURL: this.GAMMA_API_URL,
            timeout: 5000,
            httpsAgent,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        // CLOB API - Real-time prices and order books
        // No authentication required for price/book queries
        this.clobClient = axios.create({
            baseURL: this.CLOB_API_URL,
            timeout: 5000,
            httpsAgent,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    /**
     * Fetching Market Data
     * ---------------------
     * Per official docs: No API key, no authentication, and no wallet required.
     *
     * Gamma API Endpoints:
     * - GET /markets           : List all markets
     * - GET /markets/{id}      : Get specific market by condition_id
     * - GET /events            : List all events
     * - GET /events/{id}       : Get specific event
     *
     * Example:
     * ```typescript
     * const markets = await polymarketService.getMarkets();
     * const market = await polymarketService.getMarket('0x1234...');
     * ```
     */
    async getMarkets(
        limit = 100,
        offset = 0,
        active = true,
    ): Promise<PolymarketMarket[]> {
        try {
            // GET https://gamma-api.polymarket.com/markets
            const response = await this.gammaClient.get('/markets', {
                params: {
                    limit,
                    offset,
                    active,
                    closed: false,
                },
            });
            return response.data || [];
        } catch (error) {
            this.logger.error('Failed to fetch Polymarket markets:', error);
            return [];
        }
    }

    async getMarket(conditionId: string): Promise<PolymarketMarket | null> {
        try {
            // GET https://gamma-api.polymarket.com/markets/{condition_id}
            const response = await this.gammaClient.get(`/markets/${conditionId}`);
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to fetch Polymarket market ${conditionId}:`, error);
            return null;
        }
    }

    async searchMarkets(query: string, limit = 20): Promise<PolymarketMarket[]> {
        try {
            const response = await this.gammaClient.get('/markets', {
                params: {
                    _q: query,
                    limit,
                    active: true,
                },
            });
            return response.data || [];
        } catch (error) {
            this.logger.error(`Failed to search Polymarket markets: ${query}`, error);
            return [];
        }
    }

    async getMarketsByCategory(
        category: string,
        limit = 50,
    ): Promise<PolymarketMarket[]> {
        try {
            const response = await this.gammaClient.get('/markets', {
                params: {
                    tag: category.toLowerCase(),
                    limit,
                    active: true,
                },
            });
            return response.data || [];
        } catch (error) {
            this.logger.error(`Failed to fetch Polymarket markets by category ${category}:`, error);
            return [];
        }
    }

    /**
     * CLOB API - Prices and Order Books
     * ----------------------------------
     * Per official docs: No authentication required for read-only price data.
     *
     * Endpoints:
     * - GET /price?token_id={id}     : Get current price for a token
     * - GET /prices?token_ids={ids}  : Get prices for multiple tokens
     * - GET /book?token_id={id}      : Get order book for a token
     * - GET /midpoint?token_id={id}  : Get midpoint price
     *
     * Example:
     * ```typescript
     * const price = await polymarketService.getPrice('71321045679252212594626385532706912750332728571942532289631379312455583992563');
     * const book = await polymarketService.getOrderBook('71321045679252212594626385532706912750332728571942532289631379312455583992563');
     * ```
     */
    async getPrice(tokenId: string): Promise<number | null> {
        try {
            // GET https://clob.polymarket.com/price?token_id={token_id}
            const response = await this.clobClient.get('/price', {
                params: { token_id: tokenId },
            });
            return parseFloat(response.data.price);
        } catch (error) {
            this.logger.error(`Failed to fetch Polymarket price for ${tokenId}:`, error);
            return null;
        }
    }

    async getPrices(tokenIds: string[]): Promise<Map<string, number>> {
        try {
            // GET https://clob.polymarket.com/prices?token_ids={id1},{id2}
            const response = await this.clobClient.get('/prices', {
                params: { token_ids: tokenIds.join(',') },
            });
            const prices = new Map<string, number>();
            for (const [tokenId, price] of Object.entries(response.data)) {
                prices.set(tokenId, parseFloat(price as string));
            }
            return prices;
        } catch (error) {
            this.logger.error('Failed to fetch Polymarket prices:', error);
            return new Map();
        }
    }

    async getOrderBook(tokenId: string): Promise<PolymarketOrderBook | null> {
        try {
            // GET https://clob.polymarket.com/book?token_id={token_id}
            const response = await this.clobClient.get('/book', {
                params: { token_id: tokenId },
            });
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to fetch Polymarket order book for ${tokenId}:`, error);
            return null;
        }
    }

    async getMidpoint(tokenId: string): Promise<number | null> {
        try {
            // GET https://clob.polymarket.com/midpoint?token_id={token_id}
            const response = await this.clobClient.get('/midpoint', {
                params: { token_id: tokenId },
            });
            return parseFloat(response.data.mid);
        } catch (error) {
            this.logger.error(`Failed to fetch Polymarket midpoint for ${tokenId}:`, error);
            return null;
        }
    }

    async getTrendingMarkets(limit = 20): Promise<PolymarketMarket[]> {
        try {
            const markets = await this.getMarkets(limit * 2, 0, true);
            return markets
                .filter((m) => m.active && !m.closed)
                .sort((a, b) => b.volume_num - a.volume_num)
                .slice(0, limit);
        } catch (error) {
            this.logger.error('Failed to fetch trending Polymarket markets:', error);
            return [];
        }
    }

    // Convert Polymarket market to normalized format
    normalizeMarket(market: any) {
        const yesToken = market.tokens?.find((t: any) => t.outcome === 'Yes');
        const noToken = market.tokens?.find((t: any) => t.outcome === 'No');

        // Polymarket can have id in several places: condition_id, question_id, or top-level id
        const marketId = market.condition_id || market.id || market.question_id;

        if (!marketId) {
            this.logger.warn(`Could not find a valid ID for Polymarket market: ${market.question || 'Unknown'}`);
        }

        return {
            platform: 'polymarket',
            marketId: marketId || `poly-${Math.random().toString(36).substr(2, 9)}`,
            question: market.question,
            yesPrice: yesToken?.price || parseFloat(market.outcome_prices?.[0] || '0'),
            noPrice: noToken?.price || parseFloat(market.outcome_prices?.[1] || '0'),
            volume: market.volume_num || parseFloat(market.volume || '0'),
            liquidity: market.liquidity_num || parseFloat(market.liquidity || '0'),
            endDate: market.end_date_iso || market.endDate,
            category: market.category,
            isActive: market.active !== undefined ? market.active : true,
            isClosed: market.closed !== undefined ? market.closed : false,
        };
    }

    /**
     * Batch fetch orderbooks in parallel
     */
    async getOrderbooksBatch(tokenIds: string[]): Promise<Array<{ tokenId: string; orderbook: PolymarketOrderBook | null }>> {
        return Promise.all(
            tokenIds.map(async tokenId => ({
                tokenId,
                orderbook: await this.getOrderBook(tokenId),
            }))
        );
    }
}
