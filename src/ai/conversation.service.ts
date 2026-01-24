import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService, Conversation, Message } from '../database/database.service';

export interface ConversationWithMessages extends Conversation {
    messages: Message[];
}

@Injectable()
export class ConversationService {
    private readonly logger = new Logger(ConversationService.name);

    constructor(private databaseService: DatabaseService) { }

    async createConversation(
        userId: string,
        title?: string,
    ): Promise<Conversation | null> {
        const conversation = await this.databaseService.createConversation(
            userId,
            title,
        );
        if (conversation) {
            this.logger.log(`Created conversation ${conversation.id} for user ${userId}`);
        }
        return conversation;
    }

    async getConversation(id: string): Promise<Conversation | null> {
        return this.databaseService.getConversation(id);
    }

    async getConversationWithMessages(
        id: string,
    ): Promise<ConversationWithMessages | null> {
        const conversation = await this.databaseService.getConversation(id);
        if (!conversation) {
            return null;
        }

        const messages = await this.databaseService.getMessages(id);
        return { ...conversation, messages };
    }

    async listConversations(userId: string): Promise<Conversation[]> {
        return this.databaseService.listConversations(userId);
    }

    async addMessage(
        conversationId: string,
        role: 'user' | 'assistant' | 'system',
        content: string,
        metadata: Record<string, unknown> = {},
    ): Promise<Message | null> {
        const message = await this.databaseService.addMessage(
            conversationId,
            role,
            content,
            metadata,
        );

        // Auto-generate title from first user message if none exists
        if (message && role === 'user') {
            const conversation = await this.databaseService.getConversation(conversationId);
            if (conversation && !conversation.title) {
                const title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
                await this.databaseService.updateConversationTitle(conversationId, title);
            }
        }

        return message;
    }

    async getMessages(conversationId: string): Promise<Message[]> {
        return this.databaseService.getMessages(conversationId);
    }

    async getMessageHistory(
        conversationId: string,
        limit = 20,
    ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
        const messages = await this.databaseService.getMessages(conversationId);
        return messages
            .filter((m) => m.role !== 'system')
            .slice(-limit)
            .map((m) => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
            }));
    }
}
