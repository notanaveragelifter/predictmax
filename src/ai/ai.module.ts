import { Module, forwardRef } from '@nestjs/common';
import { AiService } from './ai.service';
import { ChatGateway } from './chat.gateway';
import { ConversationService } from './conversation.service';
import { MarketModule } from '../market/market.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { BetaKeyGuard } from './beta-key.guard';

@Module({
    imports: [
        forwardRef(() => MarketModule),
        IntegrationsModule,
        IntelligenceModule,
    ],
    providers: [AiService, ChatGateway, ConversationService, BetaKeyGuard],
    exports: [AiService, ConversationService],
})
export class AiModule { }
