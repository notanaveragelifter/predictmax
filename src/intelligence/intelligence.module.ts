/**
 * Intelligence Module
 * 
 * Core module for the PredictMax enhanced intelligence system.
 * Provides smart market discovery, probability analysis, and recommendations.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { CommonModule } from '../common/common.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { DatabaseModule } from '../database/database.module';

import { QueryIntelligenceService } from './query-intelligence.service';
import { UnifiedMarketSearchService } from './unified-market-search.service';
import { SportsIntelligenceService } from './sports-intelligence.service';
import { ProbabilityEngine } from './probability-engine.service';
import { RiskAssessmentService } from './risk-assessment.service';
import { RecommendationEngine } from './recommendation-engine.service';
import { ReportGenerator } from './report-generator.service';
import { IntelligenceToolHandler } from './tool-handler.service';

@Module({
    imports: [
        ConfigModule,
        CommonModule,
        IntegrationsModule,
        DatabaseModule,
    ],
    providers: [
        QueryIntelligenceService,
        UnifiedMarketSearchService,
        SportsIntelligenceService,
        ProbabilityEngine,
        RiskAssessmentService,
        RecommendationEngine,
        ReportGenerator,
        IntelligenceToolHandler,
    ],
    exports: [
        QueryIntelligenceService,
        UnifiedMarketSearchService,
        SportsIntelligenceService,
        ProbabilityEngine,
        RiskAssessmentService,
        RecommendationEngine,
        ReportGenerator,
        IntelligenceToolHandler,
    ],
})
export class IntelligenceModule {}
