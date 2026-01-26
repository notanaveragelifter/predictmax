import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { KalshiService } from './integrations/kalshi.service';
import { AiService } from './ai/ai.service';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const kalshiService = app.get(KalshiService);
    const aiService = app.get(AiService);

    console.log('--- Testing Kalshi Trending Markets ---');
    const trending = await kalshiService.getTrendingMarkets(5);
    console.log(`Found ${trending.length} trending markets:`);
    trending.forEach(m => {
        console.log(`- ${m.ticker}: ${m.title} (Volume 24h: ${m.volume_24h})`);
    });

    console.log('\n--- Testing Kalshi Global Trades ---');
    const trades = await kalshiService.getTrades({ limit: 5 });
    console.log(`Found ${trades.length} recent trades:`);
    trades.forEach(t => {
        console.log(`- Trade ${t.trade_id}: ${t.ticker} (${t.taker_side} at ${t.yes_price}c)`);
    });

    await app.close();
}

bootstrap().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
