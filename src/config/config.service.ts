import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
    constructor(private configService: NestConfigService) { }

    // AI Configuration
    get anthropicApiKey(): string {
        return this.configService.get<string>('ANTHROPIC_API_KEY') || '';
    }

    // Supabase Configuration
    get supabaseUrl(): string {
        return this.configService.get<string>('SUPABASE_URL') || '';
    }

    get supabaseAnonKey(): string {
        return this.configService.get<string>('SUPABASE_ANON_KEY') || '';
    }

    // Kalshi Configuration
    get kalshiApiKey(): string {
        return this.configService.get<string>('KALSHI_API_KEY') || '';
    }

    get kalshiApiSecret(): string {
        return this.configService.get<string>('KALSHI_API_SECRET') || '';
    }

    // Polymarket Configuration
    get polymarketApiKey(): string {
        return this.configService.get<string>('POLYMARKET_API_KEY') || '';
    }

    // Helius Configuration
    get heliusApiKey(): string {
        return this.configService.get<string>('HELIUS_API_KEY') || '';
    }

    // Server Configuration
    get port(): number {
        return this.configService.get<number>('PORT') || 3000;
    }

    get nodeEnv(): string {
        return this.configService.get<string>('NODE_ENV') || 'development';
    }

    get isDevelopment(): boolean {
        return this.nodeEnv === 'development';
    }

    get isProduction(): boolean {
        return this.nodeEnv === 'production';
    }
}
