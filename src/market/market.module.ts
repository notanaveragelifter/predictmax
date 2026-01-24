import { Module, forwardRef } from '@nestjs/common';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { IntegrationsModule } from '../integrations/integrations.module';
import { AiModule } from '../ai/ai.module';

@Module({
    imports: [IntegrationsModule, forwardRef(() => AiModule)],
    providers: [MarketService],
    controllers: [MarketController],
    exports: [MarketService],
})
export class MarketModule { }
