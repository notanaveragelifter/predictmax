import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ConfigService } from '../config/config.service';

export interface HeliusTransaction {
    signature: string;
    slot: number;
    timestamp: number;
    type: string;
    source: string;
    fee: number;
    feePayer: string;
    description: string;
    nativeTransfers: Array<{
        fromUserAccount: string;
        toUserAccount: string;
        amount: number;
    }>;
    tokenTransfers: Array<{
        fromUserAccount: string;
        toUserAccount: string;
        mint: string;
        tokenAmount: number;
        tokenStandard: string;
    }>;
    accountData: Array<{
        account: string;
        nativeBalanceChange: number;
        tokenBalanceChanges: Array<{
            mint: string;
            rawTokenAmount: {
                tokenAmount: string;
                decimals: number;
            };
        }>;
    }>;
}

export interface HeliusAsset {
    id: string;
    interface: string;
    content: {
        json_uri: string;
        metadata: {
            name: string;
            symbol: string;
            description?: string;
        };
    };
    authorities: Array<{
        address: string;
        scopes: string[];
    }>;
    compression?: {
        eligible: boolean;
        compressed: boolean;
    };
    ownership: {
        owner: string;
        delegate?: string;
    };
    royalty?: {
        royalty_model: string;
        percent: number;
    };
    token_info?: {
        balance: number;
        decimals: number;
        supply?: number;
        price_info?: {
            price_per_token: number;
            currency: string;
        };
    };
}

export interface HeliusWebhook {
    webhookID: string;
    wallet: string;
    webhookURL: string;
    transactionTypes: string[];
    accountAddresses: string[];
    webhookType: string;
}

@Injectable()
export class HeliusService {
    private readonly client: AxiosInstance;
    private readonly rpcClient: AxiosInstance;
    private readonly logger = new Logger(HeliusService.name);

    constructor(private configService: ConfigService) {
        const apiKey = this.configService.heliusApiKey;

        this.client = axios.create({
            baseURL: `https://api.helius.xyz/v0`,
            headers: {
                'Content-Type': 'application/json',
            },
            params: {
                'api-key': apiKey,
            },
        });

        this.rpcClient = axios.create({
            baseURL: `https://mainnet.helius-rpc.com/?api-key=${apiKey}`,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }

    async getTransactions(
        address: string,
        limit = 50,
    ): Promise<HeliusTransaction[]> {
        try {
            const response = await this.client.get(`/addresses/${address}/transactions`, {
                params: { limit },
            });
            return response.data || [];
        } catch (error) {
            this.logger.error(`Failed to fetch transactions for ${address}:`, error);
            return [];
        }
    }

    async getEnhancedTransaction(
        signature: string,
    ): Promise<HeliusTransaction | null> {
        try {
            const response = await this.client.get('/transactions', {
                params: { signatures: signature },
            });
            return response.data?.[0] || null;
        } catch (error) {
            this.logger.error(`Failed to fetch transaction ${signature}:`, error);
            return null;
        }
    }

    async getAssetsByOwner(
        owner: string,
        page = 1,
        limit = 100,
    ): Promise<HeliusAsset[]> {
        try {
            const response = await this.rpcClient.post('', {
                jsonrpc: '2.0',
                id: 'helius-das',
                method: 'getAssetsByOwner',
                params: {
                    ownerAddress: owner,
                    page,
                    limit,
                },
            });
            return response.data?.result?.items || [];
        } catch (error) {
            this.logger.error(`Failed to fetch assets for ${owner}:`, error);
            return [];
        }
    }

    async getAsset(assetId: string): Promise<HeliusAsset | null> {
        try {
            const response = await this.rpcClient.post('', {
                jsonrpc: '2.0',
                id: 'helius-das',
                method: 'getAsset',
                params: { id: assetId },
            });
            return response.data?.result || null;
        } catch (error) {
            this.logger.error(`Failed to fetch asset ${assetId}:`, error);
            return null;
        }
    }

    async searchAssets(query: {
        ownerAddress?: string;
        creatorAddress?: string;
        groupKey?: string;
        groupValue?: string;
        page?: number;
        limit?: number;
    }): Promise<HeliusAsset[]> {
        try {
            const response = await this.rpcClient.post('', {
                jsonrpc: '2.0',
                id: 'helius-das',
                method: 'searchAssets',
                params: query,
            });
            return response.data?.result?.items || [];
        } catch (error) {
            this.logger.error('Failed to search assets:', error);
            return [];
        }
    }

    async getTokenBalances(address: string): Promise<
        Array<{
            mint: string;
            balance: number;
            decimals: number;
        }>
    > {
        try {
            const response = await this.client.get(`/addresses/${address}/balances`);
            return response.data?.tokens || [];
        } catch (error) {
            this.logger.error(`Failed to fetch token balances for ${address}:`, error);
            return [];
        }
    }

    async getNativeBalance(address: string): Promise<number> {
        try {
            const response = await this.client.get(`/addresses/${address}/balances`);
            return response.data?.nativeBalance || 0;
        } catch (error) {
            this.logger.error(`Failed to fetch native balance for ${address}:`, error);
            return 0;
        }
    }

    async getPriorityFeeEstimate(
        accountKeys: string[],
        options?: {
            includeAllPriorityFeeLevels?: boolean;
        },
    ): Promise<{
        priorityFeeEstimate?: number;
        priorityFeeLevels?: {
            min: number;
            low: number;
            medium: number;
            high: number;
            veryHigh: number;
            unsafeMax: number;
        };
    }> {
        try {
            const response = await this.rpcClient.post('', {
                jsonrpc: '2.0',
                id: 'helius-fee',
                method: 'getPriorityFeeEstimate',
                params: [
                    {
                        accountKeys,
                        options: {
                            includeAllPriorityFeeLevels:
                                options?.includeAllPriorityFeeLevels ?? true,
                        },
                    },
                ],
            });
            return response.data?.result || {};
        } catch (error) {
            this.logger.error('Failed to get priority fee estimate:', error);
            return {};
        }
    }

    // Webhook management
    async createWebhook(config: {
        webhookURL: string;
        transactionTypes: string[];
        accountAddresses: string[];
        webhookType?: 'enhanced' | 'raw';
    }): Promise<HeliusWebhook | null> {
        try {
            const response = await this.client.post('/webhooks', {
                ...config,
                webhookType: config.webhookType || 'enhanced',
            });
            return response.data;
        } catch (error) {
            this.logger.error('Failed to create webhook:', error);
            return null;
        }
    }

    async getWebhooks(): Promise<HeliusWebhook[]> {
        try {
            const response = await this.client.get('/webhooks');
            return response.data || [];
        } catch (error) {
            this.logger.error('Failed to get webhooks:', error);
            return [];
        }
    }

    async deleteWebhook(webhookId: string): Promise<boolean> {
        try {
            await this.client.delete(`/webhooks/${webhookId}`);
            return true;
        } catch (error) {
            this.logger.error(`Failed to delete webhook ${webhookId}:`, error);
            return false;
        }
    }
}
