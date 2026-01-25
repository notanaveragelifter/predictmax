import { Module, forwardRef } from '@nestjs/common';
import { AiService } from './ai.service';
import { ChatGateway } from './chat.gateway';
import { ConversationService } from './conversation.service';
import { MarketModule } from '../market/market.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
    imports: [forwardRef(() => MarketModule), IntegrationsModule],
    providers: [AiService, ChatGateway, ConversationService],
    exports: [AiService, ConversationService],
})
export class AiModule { }
