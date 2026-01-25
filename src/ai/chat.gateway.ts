import {
    WebSocketGateway,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AiService } from './ai.service';
import { ConversationService } from './conversation.service';
import { MarketService } from '../market/market.service';

interface ChatMessagePayload {
    content: string;
    conversationId?: string;
    userId: string;
}

interface JoinConversationPayload {
    conversationId: string;
    userId: string;
}

@WebSocketGateway({
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
    },
    namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(ChatGateway.name);
    private userSockets: Map<string, Set<string>> = new Map();

    constructor(
        private aiService: AiService,
        private conversationService: ConversationService,
        @Inject(forwardRef(() => MarketService))
        private marketService: MarketService,
    ) { }

    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);
        client.emit('connected', { socketId: client.id });
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
        // Clean up user socket mapping
        for (const [userId, sockets] of this.userSockets.entries()) {
            if (sockets.has(client.id)) {
                sockets.delete(client.id);
                if (sockets.size === 0) {
                    this.userSockets.delete(userId);
                }
                break;
            }
        }
    }

    @SubscribeMessage('register')
    handleRegister(
        @MessageBody() data: { userId: string },
        @ConnectedSocket() client: Socket,
    ) {
        const { userId } = data;
        if (!this.userSockets.has(userId)) {
            this.userSockets.set(userId, new Set());
        }
        this.userSockets.get(userId)?.add(client.id);
        this.logger.log(`User ${userId} registered with socket ${client.id}`);
        return { success: true };
    }

    @SubscribeMessage('message')
    async handleMessage(
        @MessageBody() payload: ChatMessagePayload,
        @ConnectedSocket() client: Socket,
    ) {
        const { content, userId } = payload;
        let { conversationId } = payload;

        this.logger.log(
            `Message from ${userId}: ${content.substring(0, 50)}...`,
        );

        try {
            // Create new conversation if needed
            if (!conversationId) {
                const conversation =
                    await this.conversationService.createConversation(userId);
                if (!conversation) {
                    client.emit('error', { message: 'Failed to create conversation' });
                    return;
                }
                conversationId = conversation.id;
                client.emit('conversation_created', { conversationId });
            }

            // Join the conversation room
            client.join(`conversation:${conversationId}`);

            // Emit typing indicator
            this.server
                .to(`conversation:${conversationId}`)
                .emit('assistant_typing', { conversationId });

            // Fetch relevant markets for context
            // If the message contains "sports", fetch sports markets, otherwise fetch trending
            let marketContext: any[] = [];
            const lowercaseContent = content.toLowerCase();
            if (lowercaseContent.includes('sport')) {
                marketContext = await this.marketService.discoverMarkets({
                    category: 'sports',
                    limit: 10
                });
            } else if (lowercaseContent.includes('crypto')) {
                marketContext = await this.marketService.discoverMarkets({
                    category: 'crypto',
                    limit: 10
                });
            } else {
                marketContext = await this.marketService.getMarketsForAIContext(10);
            }

            // Get AI response (tool calling handles market data fetching internally)
            const response = await this.aiService.chat(
                content,
                conversationId,
                userId,
            );

            // Emit response
            client.emit('message_response', {
                conversationId: response.conversationId,
                content: response.content,
                messageId: response.messageId,
                role: 'assistant',
                timestamp: new Date().toISOString(),
            });

            // Stop typing indicator
            this.server
                .to(`conversation:${conversationId}`)
                .emit('assistant_stopped_typing', { conversationId });

            return {
                success: true,
                conversationId: response.conversationId,
            };
        } catch (error) {
            this.logger.error('Error handling message:', error);
            client.emit('error', {
                message: 'Failed to process message',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            return { success: false };
        }
    }

    @SubscribeMessage('join_conversation')
    async handleJoinConversation(
        @MessageBody() payload: JoinConversationPayload,
        @ConnectedSocket() client: Socket,
    ) {
        const { conversationId, userId } = payload;

        try {
            const conversation =
                await this.conversationService.getConversationWithMessages(conversationId);

            if (!conversation) {
                client.emit('error', { message: 'Conversation not found' });
                return { success: false };
            }

            // Verify user owns the conversation
            if (conversation.user_id !== userId) {
                client.emit('error', { message: 'Unauthorized' });
                return { success: false };
            }

            // Join conversation room
            client.join(`conversation:${conversationId}`);

            // Send conversation history
            client.emit('conversation_history', {
                conversationId,
                messages: conversation.messages,
            });

            this.logger.log(`User ${userId} joined conversation ${conversationId}`);
            return { success: true };
        } catch (error) {
            this.logger.error('Error joining conversation:', error);
            client.emit('error', { message: 'Failed to join conversation' });
            return { success: false };
        }
    }

    @SubscribeMessage('list_conversations')
    async handleListConversations(
        @MessageBody() data: { userId: string },
        @ConnectedSocket() client: Socket,
    ) {
        try {
            const conversations = await this.conversationService.listConversations(
                data.userId,
            );
            client.emit('conversations_list', { conversations });
            return { success: true };
        } catch (error) {
            this.logger.error('Error listing conversations:', error);
            client.emit('error', { message: 'Failed to list conversations' });
            return { success: false };
        }
    }
}
