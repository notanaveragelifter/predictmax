import { Module } from '@nestjs/common';
import { KalshiService } from './kalshi.service';
import { PolymarketService } from './polymarket.service';
import { HeliusService } from './helius.service';
import { SportsEventDetectorService } from './sports-event-detector.service';
import { YouTubeStreamFinderService } from './youtube-stream-finder.service';
import { CommonModule } from '../common/common.module';
import { ConfigModule } from '../config/config.module';

@Module({
    imports: [CommonModule, ConfigModule],
    providers: [
        KalshiService, 
        PolymarketService, 
        HeliusService,
        SportsEventDetectorService,
        YouTubeStreamFinderService,
    ],
    exports: [
        KalshiService, 
        PolymarketService, 
        HeliusService,
        SportsEventDetectorService,
        YouTubeStreamFinderService,
    ],
})
export class IntegrationsModule { }
