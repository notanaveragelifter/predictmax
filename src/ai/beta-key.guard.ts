import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { BetaKeyService } from '../database/beta-key.service';

@Injectable()
export class BetaKeyGuard implements CanActivate {
    private readonly logger = new Logger(BetaKeyGuard.name);

    constructor(private readonly betaKeyService: BetaKeyService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const client = context.switchToWs().getClient<Socket>();

        try {
            const betaKey: string | undefined = client.handshake?.auth?.betaKey;

            if (!betaKey) {
                this.logger.warn(`Connection rejected (no key): ${client.id}`);
                client.emit('auth_error', { reason: 'No beta key provided' });
                client.disconnect(true);
                return false;
            }

            const result = await this.betaKeyService.validateKey(betaKey);

            if (result.valid) {
                this.logger.log(`Beta key accepted for socket ${client.id}`);
                return true;
            }

            this.logger.warn(
                `Connection rejected (invalid key) ${client.id}: ${result.reason ?? 'unknown'}`,
            );
            client.emit('auth_error', { reason: result.reason });
            client.disconnect(true);
            return false;
        } catch (error) {
            this.logger.error(
                `BetaKeyGuard threw unexpectedly for ${client.id}: ${error instanceof Error ? error.message : String(error)}`,
            );
            client.disconnect(true);
            return false;
        }
    }
}
