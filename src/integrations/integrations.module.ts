import { Module } from '@nestjs/common';
import { KalshiService } from './kalshi.service';
import { PolymarketService } from './polymarket.service';
import { HeliusService } from './helius.service';

@Module({
    providers: [KalshiService, PolymarketService, HeliusService],
    exports: [KalshiService, PolymarketService, HeliusService],
})
export class IntegrationsModule { }
