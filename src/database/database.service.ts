import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigService } from '../config/config.service';

export interface Conversation {
    id: string;
    user_id: string;
    title: string | null;
    created_at: string;
    updated_at: string;
}

export interface Message {
    id: string;
    conversation_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    metadata: Record<string, unknown>;
    created_at: string;
}

export interface MarketCache {
    id: string;
    platform: string;
    market_id: string;
    ticker: string | null;
    question: string | null;
    category: string | null;
    end_date: string | null;
    yes_price: number | null;
    no_price: number | null;
    volume: number | null;
    liquidity: number | null;
    raw_data: Record<string, unknown>;
    updated_at: string;
}

@Injectable()
export class DatabaseService implements OnModuleInit {
    private supabase: SupabaseClient;
    private readonly logger = new Logger(DatabaseService.name);

    constructor(private configService: ConfigService) {
        this.supabase = createClient(
            this.configService.supabaseUrl,
            this.configService.supabaseAnonKey,
        );
    }

    async onModuleInit() {
        // Test connection
        const { error } = await this.supabase.from('conversations').select('count');
        if (error && !error.message.includes('does not exist')) {
            this.logger.warn('Supabase connection test warning:', error.message);
        } else {
            this.logger.log('Supabase connection established');
        }
    }

    get client(): SupabaseClient {
        return this.supabase;
    }

    // Conversation Methods
    async createConversation(
        userId: string,
        title?: string,
    ): Promise<Conversation | null> {
        const { data, error } = await this.supabase
            .from('conversations')
            .insert({ user_id: userId, title })
            .select()
            .single();

        if (error) {
            this.logger.error('Failed to create conversation:', error);
            return null;
        }
        return data;
    }

    async getConversation(id: string): Promise<Conversation | null> {
        const { data, error } = await this.supabase
            .from('conversations')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            this.logger.error('Failed to get conversation:', error);
            return null;
        }
        return data;
    }

    async listConversations(userId: string): Promise<Conversation[]> {
        const { data, error } = await this.supabase
            .from('conversations')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

        if (error) {
            this.logger.error('Failed to list conversations:', error);
            return [];
        }
        return data || [];
    }

    async updateConversationTitle(
        id: string,
        title: string,
    ): Promise<Conversation | null> {
        const { data, error } = await this.supabase
            .from('conversations')
            .update({ title, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            this.logger.error('Failed to update conversation:', error);
            return null;
        }
        return data;
    }

    // Message Methods
    async addMessage(
        conversationId: string,
        role: 'user' | 'assistant' | 'system',
        content: string,
        metadata: Record<string, unknown> = {},
    ): Promise<Message | null> {
        const { data, error } = await this.supabase
            .from('messages')
            .insert({
                conversation_id: conversationId,
                role,
                content,
                metadata,
            })
            .select()
            .single();

        if (error) {
            this.logger.error('Failed to add message:', error);
            return null;
        }

        // Update conversation updated_at
        await this.supabase
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);

        return data;
    }

    async getMessages(conversationId: string): Promise<Message[]> {
        const { data, error } = await this.supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (error) {
            this.logger.error('Failed to get messages:', error);
            return [];
        }
        return data || [];
    }

    // Market Cache Methods
    async upsertMarket(market: Partial<MarketCache>): Promise<MarketCache | null> {
        const { data, error } = await this.supabase
            .from('markets_cache')
            .upsert(
                { ...market, updated_at: new Date().toISOString() },
                { onConflict: 'platform,market_id' },
            )
            .select()
            .single();

        if (error) {
            this.logger.error('Failed to upsert market:', error);
            return null;
        }
        return data;
    }

    async getMarkets(
        platform?: string,
        category?: string,
        limit = 50,
    ): Promise<MarketCache[]> {
        let query = this.supabase
            .from('markets_cache')
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(limit);

        if (platform) {
            query = query.eq('platform', platform);
        }
        if (category) {
            query = query.eq('category', category);
        }

        const { data, error } = await query;

        if (error) {
            this.logger.error('Failed to get markets:', error);
            return [];
        }
        return data || [];
    }

    async getMarketByPlatformId(
        platform: string,
        marketId: string,
    ): Promise<MarketCache | null> {
        const { data, error } = await this.supabase
            .from('markets_cache')
            .select('*')
            .eq('platform', platform)
            .eq('market_id', marketId)
            .single();

        if (error) {
            this.logger.error('Failed to get market:', error);
            return null;
        }
        return data;
    }
}
