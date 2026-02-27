import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface BetaKeyValidationResult {
    valid: boolean;
    reason?: string;
}

@Injectable()
export class BetaKeyService {
    private readonly logger = new Logger(BetaKeyService.name);

    constructor(private readonly configService: ConfigService) { }

    async validateKey(key: string): Promise<BetaKeyValidationResult> {
        const url = this.configService.get<string>('SUPABASE_VALIDATE_KEY_URL');

        if (!url) {
            this.logger.warn('SUPABASE_VALIDATE_KEY_URL is not configured');
            return { valid: false, reason: 'Validation service unavailable' };
        }

        try {
            const response = await axios.post<BetaKeyValidationResult>(
                url,
                { key },
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 5000,
                },
            );

            return response.data;
        } catch (error) {
            this.logger.error(
                `Beta key validation failed: ${error instanceof Error ? error.message : String(error)}`,
            );
            return { valid: false, reason: 'Validation service unavailable' };
        }
    }
}
