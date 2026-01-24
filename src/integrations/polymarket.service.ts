import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ConfigService } from '../config/config.service';

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
    private readonly client: AxiosInstance;
    private readonly clobClient: AxiosInstance;
    private readonly logger = new Logger(PolymarketService.name);
    private readonly gammaApiUrl = 'https://gamma-api.polymarket.com';
    private readonly clobApiUrl = 'https://clob.polymarket.com';

    constructor(private configService: ConfigService) {
        this.client = axios.create({
            baseURL: this.gammaApiUrl,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        this.clobClient = axios.create({
            baseURL: this.clobApiUrl,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    private getAuthHeaders(): Record<string, string> {
        const apiKey = this.configService.polymarketApiKey;
        if (apiKey) {
            return { 'POLY-API-KEY': apiKey };
        }
        return {};
    }

    async getMarkets(
        limit = 100,
        offset = 0,
        active = true,
    ): Promise<PolymarketMarket[]> {
        try {
            const response = await this.client.get('/markets', {
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
            const response = await this.client.get(`/markets/${conditionId}`);
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to fetch Polymarket market ${conditionId}:`, error);
            return null;
        }
    }

    async searchMarkets(query: string, limit = 20): Promise<PolymarketMarket[]> {
        try {
            const response = await this.client.get('/markets', {
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
            const response = await this.client.get('/markets', {
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

    async getPrice(tokenId: string): Promise<number | null> {
        try {
            const response = await this.clobClient.get('/price', {
                params: { token_id: tokenId },
                headers: this.getAuthHeaders(),
            });
            return parseFloat(response.data.price);
        } catch (error) {
            this.logger.error(`Failed to fetch Polymarket price for ${tokenId}:`, error);
            return null;
        }
    }

    async getPrices(tokenIds: string[]): Promise<Map<string, number>> {
        try {
            const response = await this.clobClient.get('/prices', {
                params: { token_ids: tokenIds.join(',') },
                headers: this.getAuthHeaders(),
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
            const response = await this.clobClient.get('/book', {
                params: { token_id: tokenId },
                headers: this.getAuthHeaders(),
            });
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to fetch Polymarket order book for ${tokenId}:`, error);
            return null;
        }
    }

    async getMidpoint(tokenId: string): Promise<number | null> {
        try {
            const response = await this.clobClient.get('/midpoint', {
                params: { token_id: tokenId },
                headers: this.getAuthHeaders(),
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
    normalizeMarket(market: PolymarketMarket) {
        const yesToken = market.tokens?.find((t) => t.outcome === 'Yes');
        const noToken = market.tokens?.find((t) => t.outcome === 'No');

        return {
            platform: 'polymarket',
            marketId: market.condition_id,
            questionId: market.question_id,
            question: market.question,
            description: market.description,
            yesPrice: yesToken?.price || parseFloat(market.outcome_prices?.[0] || '0'),
            noPrice: noToken?.price || parseFloat(market.outcome_prices?.[1] || '0'),
            yesTokenId: yesToken?.token_id,
            noTokenId: noToken?.token_id,
            volume: market.volume_num,
            liquidity: market.liquidity_num,
            endDate: market.end_date_iso,
            category: market.category,
            outcomes: market.outcomes,
            isActive: market.active,
            isClosed: market.closed,
            acceptingOrders: market.accepting_orders,
        };
    }
}
