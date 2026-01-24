import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '../config/config.service';
import { ConversationService } from './conversation.service';
import {
    PREDICTMAX_SYSTEM_PROMPT,
    MARKET_ANALYSIS_PROMPT,
    MARKET_COMPARISON_PROMPT,
    MARKET_DISCOVERY_PROMPT,
} from './prompts';

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

    constructor(
        private configService: ConfigService,
        private conversationService: ConversationService,
    ) {
        this.anthropic = new Anthropic({
            apiKey: this.configService.anthropicApiKey,
        });
    }

    async chat(
        message: string,
        conversationId: string,
        userId: string,
        marketContext?: MarketData[],
    ): Promise<ChatResponse> {
        try {
            // Get or create conversation
            let conversation =
                await this.conversationService.getConversation(conversationId);
            if (!conversation) {
                conversation = await this.conversationService.createConversation(
                    userId,
                    undefined,
                );
                if (!conversation) {
                    throw new Error('Failed to create conversation');
                }
                conversationId = conversation.id;
            }

            // Store user message
            await this.conversationService.addMessage(conversationId, 'user', message);

            // Get conversation history
            const history =
                await this.conversationService.getMessageHistory(conversationId);

            // Build system prompt with market context if available
            let systemPrompt = PREDICTMAX_SYSTEM_PROMPT;
            if (marketContext && marketContext.length > 0) {
                systemPrompt += `\n\n## Current Market Data Available\n${JSON.stringify(marketContext, null, 2)}`;
            }

            // Call Claude API
            const response = await this.anthropic.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 4096,
                system: systemPrompt,
                messages: history.map((m) => ({
                    role: m.role,
                    content: m.content,
                })),
            });

            // Extract text content
            const assistantMessage =
                response.content[0].type === 'text' ? response.content[0].text : '';

            // Store assistant response
            const savedMessage = await this.conversationService.addMessage(
                conversationId,
                'assistant',
                assistantMessage,
                {
                    model: response.model,
                    usage: response.usage,
                },
            );

            return {
                content: assistantMessage,
                conversationId,
                messageId: savedMessage?.id || null,
            };
        } catch (error) {
            this.logger.error('Chat error:', error);
            throw error;
        }
    }

    async analyzeMarket(market: MarketData): Promise<string> {
        const prompt = MARKET_ANALYSIS_PROMPT.replace(
            '{marketData}',
            JSON.stringify(market, null, 2),
        );

        const response = await this.anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2048,
            system: PREDICTMAX_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: prompt }],
        });

        return response.content[0].type === 'text' ? response.content[0].text : '';
    }

    async compareMarkets(markets: MarketData[]): Promise<string> {
        const prompt = MARKET_COMPARISON_PROMPT.replace(
            '{marketsData}',
            JSON.stringify(markets, null, 2),
        );

        const response = await this.anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2048,
            system: PREDICTMAX_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: prompt }],
        });

        return response.content[0].type === 'text' ? response.content[0].text : '';
    }

    async getRecommendations(
        criteria: DiscoveryCriteria,
        availableMarkets: MarketData[],
    ): Promise<string> {
        const prompt = MARKET_DISCOVERY_PROMPT.replace(
            '{category}',
            criteria.category || 'any',
        )
            .replace('{timeHorizon}', criteria.timeHorizon || 'any')
            .replace('{riskProfile}', criteria.riskProfile || 'moderate')
            .replace('{liquidityPreference}', criteria.liquidityPreference || 'medium')
            .replace('{marketsData}', JSON.stringify(availableMarkets, null, 2));

        const response = await this.anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 3000,
            system: PREDICTMAX_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: prompt }],
        });

        return response.content[0].type === 'text' ? response.content[0].text : '';
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
}
