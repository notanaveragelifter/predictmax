import {
    Controller,
    Get,
    Param,
    Query,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { MarketService, MarketDiscoveryFilters } from './market.service';
import { AiService } from '../ai/ai.service';

@Controller('markets')
export class MarketController {
    constructor(
        private marketService: MarketService,
        private aiService: AiService,
    ) { }

    @Get()
    async getMarkets(
        @Query('platform') platform?: 'kalshi' | 'polymarket' | 'all',
        @Query('category') category?: string,
        @Query('minVolume') minVolume?: string,
        @Query('minLiquidity') minLiquidity?: string,
        @Query('search') searchQuery?: string,
        @Query('limit') limit?: string,
    ) {
        const filters: MarketDiscoveryFilters = {
            platform: platform || 'all',
            category,
            searchQuery,
            limit: limit ? parseInt(limit, 10) : 50,
            minVolume: minVolume ? parseFloat(minVolume) : undefined,
            minLiquidity: minLiquidity ? parseFloat(minLiquidity) : undefined,
        };

        const markets = await this.marketService.discoverMarkets(filters);

        return {
            success: true,
            count: markets.length,
            filters,
            markets,
        };
    }

    @Get('trending')
    async getTrendingMarkets(@Query('limit') limit?: string) {
        const markets = await this.marketService.getTrendingMarkets(
            limit ? parseInt(limit, 10) : 20,
        );

        return {
            success: true,
            count: markets.length,
            markets,
        };
    }

    @Get('discover')
    async discoverMarkets(
        @Query('category') category?: string,
        @Query('timeHorizon') timeHorizon?: string,
        @Query('riskProfile') riskProfile?: 'conservative' | 'moderate' | 'aggressive',
        @Query('liquidityPreference') liquidityPreference?: 'high' | 'medium' | 'low',
    ) {
        // Apply time horizon filter
        const filters: MarketDiscoveryFilters = {
            platform: 'all',
            category,
            limit: 50,
        };

        if (timeHorizon) {
            const days = parseInt(timeHorizon, 10);
            if (!isNaN(days)) {
                filters.maxEndDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
            }
        }

        // Apply liquidity preference
        if (liquidityPreference === 'high') {
            filters.minVolume = 10000;
            filters.minLiquidity = 50000;
        } else if (liquidityPreference === 'medium') {
            filters.minVolume = 1000;
            filters.minLiquidity = 5000;
        }

        const markets = await this.marketService.discoverMarkets(filters);

        // Get AI recommendations
        const recommendations = await this.aiService.getRecommendations(
            { category, timeHorizon, riskProfile, liquidityPreference },
            markets.map((m) => ({
                platform: m.platform,
                marketId: m.marketId,
                question: m.question,
                yesPrice: m.yesPrice,
                noPrice: m.noPrice,
                volume: m.volume,
                liquidity: m.liquidity,
                endDate: m.endDate,
                category: m.category,
            })),
        );

        return {
            success: true,
            criteria: { category, timeHorizon, riskProfile, liquidityPreference },
            marketsAnalyzed: markets.length,
            recommendations,
        };
    }

    @Get('analyze/:platform/:marketId')
    async analyzeMarket(
        @Param('platform') platform: string,
        @Param('marketId') marketId: string,
    ) {
        const market = await this.marketService.getMarketDetails(platform, marketId);

        if (!market) {
            throw new HttpException('Market not found', HttpStatus.NOT_FOUND);
        }

        const opportunity = await this.marketService.analyzeOpportunity(market);
        const aiAnalysis = await this.aiService.analyzeMarket({
            platform: market.platform,
            marketId: market.marketId,
            question: market.question,
            yesPrice: market.yesPrice,
            noPrice: market.noPrice,
            volume: market.volume,
            liquidity: market.liquidity,
            endDate: market.endDate,
            category: market.category,
        });

        return {
            success: true,
            market,
            opportunity,
            aiAnalysis,
        };
    }

    @Get(':platform/:marketId')
    async getMarket(
        @Param('platform') platform: string,
        @Param('marketId') marketId: string,
    ) {
        const market = await this.marketService.getMarketDetails(platform, marketId);

        if (!market) {
            throw new HttpException('Market not found', HttpStatus.NOT_FOUND);
        }

        return {
            success: true,
            market,
        };
    }

    @Get('compare')
    async compareMarkets(@Query('markets') marketsParam: string) {
        if (!marketsParam) {
            throw new HttpException(
                'Markets parameter required (format: platform:marketId,platform:marketId)',
                HttpStatus.BAD_REQUEST,
            );
        }

        const marketIds = marketsParam.split(',').map((m) => {
            const [platform, marketId] = m.split(':');
            return { platform, marketId };
        });

        const markets = await Promise.all(
            marketIds.map(({ platform, marketId }) =>
                this.marketService.getMarketDetails(platform, marketId),
            ),
        );

        const validMarkets = markets.filter((m) => m !== null);

        if (validMarkets.length < 2) {
            throw new HttpException(
                'At least 2 valid markets required for comparison',
                HttpStatus.BAD_REQUEST,
            );
        }

        const comparison = await this.aiService.compareMarkets(
            validMarkets.map((m) => ({
                platform: m!.platform,
                marketId: m!.marketId,
                question: m!.question,
                yesPrice: m!.yesPrice,
                noPrice: m!.noPrice,
                volume: m!.volume,
                liquidity: m!.liquidity,
                endDate: m!.endDate,
                category: m!.category,
            })),
        );

        return {
            success: true,
            markets: validMarkets,
            comparison,
        };
    }
}
