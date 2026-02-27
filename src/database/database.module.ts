import { Module, Global } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { BetaKeyService } from './beta-key.service';

@Global()
@Module({
    providers: [DatabaseService, BetaKeyService],
    exports: [DatabaseService, BetaKeyService],
})
export class DatabaseModule { }
