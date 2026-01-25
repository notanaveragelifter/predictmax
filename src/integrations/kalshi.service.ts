import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { HttpsAgent } from 'agentkeepalive';
import { ConfigService } from '../config/config.service';
import { CacheService } from '../common/cache.service';

export interface KalshiMarket {
    ticker: string;
    event_ticker: string;
    title: string;
    subtitle: string;
    yes_bid: number;
    yes_ask: number;
    no_bid: number;
    no_ask: number;
    last_price: number;
    volume: number;
    volume_24h: number;
    open_interest: number;
    status: string;
    close_time: string;
    expiration_time: string;
    category: string;
    result?: string;
}

export interface KalshiEvent {
    event_ticker: string;
    series_ticker?: string;
    title: string;
    subtitle: string;
    category: string;
    markets: string[];
    status: string;
}

export interface KalshiOrderBook {
    ticker: string;
    yes: Array<{ price: number; quantity: number }>;
    no: Array<{ price: number; quantity: number }>;
}

export interface KalshiMarketsFilter {
    limit?: number;
    cursor?: string;
    event_ticker?: string;
    series_ticker?: string;
    status?: 'open' | 'closed' | 'settled';
    tickers?: string[];
    min_close_ts?: number;
    max_close_ts?: number;
}

@Injectable()
export class KalshiService {
    private readonly client: AxiosInstance;
    private readonly logger = new Logger(KalshiService.name);
    private readonly baseUrl = 'https://api.elections.kalshi.com/trade-api/v2';
    private pendingRequests = new Map<string, Promise<any>>();

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

        this.client = axios.create({
            baseURL: this.baseUrl,
            timeout: 5000,
            httpsAgent,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    private async getAuthHeaders(): Promise<Record<string, string>> {
        // Kalshi uses API key authentication
        const apiKey = this.configService.kalshiApiKey;
        if (apiKey) {
            return { Authorization: `Bearer ${apiKey}` };
        }
        return {};
    }

    async getMarkets(filters: KalshiMarketsFilter = {}): Promise<KalshiMarket[]> {
        try {
            const params = new URLSearchParams();
            if (filters.limit) params.append('limit', filters.limit.toString());
            if (filters.cursor) params.append('cursor', filters.cursor);
            if (filters.event_ticker) params.append('event_ticker', filters.event_ticker);
            if (filters.status) params.append('status', filters.status);

            const response = await this.client.get('/markets', {
                params,
                headers: await this.getAuthHeaders(),
            });

            return response.data.markets || [];
        } catch (error) {
            this.logger.error('Failed to fetch Kalshi markets:', error);
            return [];
        }
    }

    async getMarket(ticker: string): Promise<KalshiMarket | null> {
        try {
            const response = await this.client.get(`/markets/${ticker}`, {
                headers: await this.getAuthHeaders(),
            });
            return response.data.market;
        } catch (error) {
            this.logger.error(`Failed to fetch Kalshi market ${ticker}:`, error);
            return null;
        }
    }

    async getMarketByTicker(ticker: string): Promise<KalshiMarket | null> {
        try {
            const response = await this.client.get(`/markets_by_ticker/${ticker}`, {
                headers: await this.getAuthHeaders(),
            });
            return response.data.market;
        } catch (error) {
            this.logger.error(`Failed to fetch Kalshi market by ticker ${ticker}:`, error);
            return null;
        }
    }

    async getOrderBook(ticker: string, depth = 10): Promise<KalshiOrderBook | null> {
        try {
            const response = await this.client.get(`/markets/${ticker}/orderbook`, {
                params: { depth },
                headers: await this.getAuthHeaders(),
            });
            return response.data.orderbook;
        } catch (error) {
            this.logger.error(`Failed to fetch Kalshi order book for ${ticker}:`, error);
            return null;
        }
    }

    async getEvents(
        limit = 100,
        status?: 'open' | 'closed' | 'settled',
    ): Promise<KalshiEvent[]> {
        try {
            const params: Record<string, string | number> = { limit };
            if (status) params.status = status;

            const response = await this.client.get('/events', {
                params,
                headers: await this.getAuthHeaders(),
            });
            return response.data.events || [];
        } catch (error) {
            this.logger.error('Failed to fetch Kalshi events:', error);
            return [];
        }
    }

    async getEvent(eventTicker: string): Promise<KalshiEvent | null> {
        try {
            const response = await this.client.get(`/events/${eventTicker}`, {
                headers: await this.getAuthHeaders(),
            });
            return response.data.event;
        } catch (error) {
            this.logger.error(`Failed to fetch Kalshi event ${eventTicker}:`, error);
            return null;
        }
    }

    async getHistoricalPrices(
        ticker: string,
        startTs?: number,
        endTs?: number,
    ): Promise<Array<{ ts: number; price: number; volume: number }>> {
        try {
            const params: Record<string, number> = {};
            if (startTs) params.start_ts = startTs;
            if (endTs) params.end_ts = endTs;

            const response = await this.client.get(`/markets/${ticker}/stats_history`, {
                params,
                headers: await this.getAuthHeaders(),
            });
            return response.data.history || [];
        } catch (error) {
            this.logger.error(`Failed to fetch Kalshi price history for ${ticker}:`, error);
            return [];
        }
    }

    async getTrendingMarkets(limit = 20): Promise<KalshiMarket[]> {
        try {
            // Get open markets sorted by volume
            const markets = await this.getMarkets({ limit, status: 'open' });
            return markets.sort((a, b) => b.volume_24h - a.volume_24h);
        } catch (error) {
            this.logger.error('Failed to fetch trending markets:', error);
            return [];
        }
    }

    /**
     * Batch fetch orderbooks in parallel
     */
    async getOrderbooksBatch(tickers: string[], depth = 10): Promise<Array<{ ticker: string; orderbook: KalshiOrderBook | null }>> {
        return Promise.all(
            tickers.map(async ticker => ({
                ticker,
                orderbook: await this.getOrderBook(ticker, depth),
            }))
        );
    }

    // Convert Kalshi market to normalized format
    normalizeMarket(market: KalshiMarket) {
        return {
            platform: 'kalshi',
            marketId: market.ticker,
            question: market.title,
            yesPrice: market.yes_bid,
            noPrice: market.no_bid,
            volume: market.volume,
            volume24h: market.volume_24h,
            endDate: market.expiration_time,
            category: market.category,
            status: market.status,
        };
    }
}
