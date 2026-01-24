import { Module, forwardRef } from '@nestjs/common';
import { AiService } from './ai.service';
import { ChatGateway } from './chat.gateway';
import { ConversationService } from './conversation.service';
import { MarketModule } from '../market/market.module';

@Module({
    imports: [forwardRef(() => MarketModule)],
    providers: [AiService, ChatGateway, ConversationService],
    exports: [AiService, ConversationService],
})
export class AiModule { }
