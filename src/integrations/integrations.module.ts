import { Module } from '@nestjs/common';
import { KalshiService } from './kalshi.service';
import { PolymarketService } from './polymarket.service';
import { HeliusService } from './helius.service';
import { CommonModule } from '../common/common.module';

@Module({
    imports: [CommonModule],
    providers: [KalshiService, PolymarketService, HeliusService],
    exports: [KalshiService, PolymarketService, HeliusService],
})
export class IntegrationsModule { }
