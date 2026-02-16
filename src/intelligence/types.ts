/**
 * PredictMax Intelligence Types
 * 
 * Comprehensive type definitions for the enhanced prediction market AI system.
 */

// ==================== UNIFIED MARKET SCHEMA ====================

export interface UnifiedMarket {
    // Universal identifiers
    id: string;
    platform: 'kalshi' | 'polymarket';
    
    // Core metadata
    question: string;
    description?: string;
    category: MarketCategory;
    subcategory?: string;
    tags: string[];
    
    // Hierarchical structure
    series?: {
        ticker: string;
        frequency: string;
        title: string;
    };
    event: {
        ticker: string;
        title: string;
        subtitle?: string;
        strikeDate?: Date;
    };
    
    // Market specifics
    market: {
        ticker: string;
        type: 'binary' | 'multivariate';
        outcomes: string[];
        status: 'open' | 'closed' | 'settled' | 'initialized';
        
        // Time boundaries
        openTime?: Date;
        closeTime: Date;
        expirationTime: Date;
    };
    
    // Pricing data
    pricing: {
        yesBid: number;
        yesAsk: number;
        noBid: number;
        noAsk: number;
        lastPrice: number;
        spread: number;
        midpoint: number;
    };
    
    // Liquidity metrics
    liquidity: {
        volume24h: number;
        totalVolume: number;
        openInterest: number;
        notionalValue: number;
        liquidityScore: 'LOW' | 'MEDIUM' | 'HIGH';
    };
    
    // Platform-specific raw data
    platformData: any;
    
    // Domain-specific context (enriched)
    sportsContext?: SportsContext;
    politicsContext?: PoliticsContext;
    cryptoContext?: CryptoContext;
    economicsContext?: EconomicsContext;
}

export type MarketCategory = 
    | 'sports'
    | 'politics'
    | 'crypto'
    | 'economics'
    | 'weather'
    | 'entertainment'
    | 'science'
    | 'finance'
    | 'other';

// ==================== SPORTS INTELLIGENCE ====================

export interface SportsContext {
    sport: SportType;
    matchType?: string; // ATP, WTA, NBA, NFL, etc.
    
    players: {
        player1: PlayerStats;
        player2: PlayerStats;
    };
    
    teams?: {
        team1: TeamStats;
        team2: TeamStats;
    };
    
    headToHead: {
        overall: string;
        onSurface?: string;
        lastMatch?: MatchResult;
        recentMatches?: MatchResult[];
    };
    
    context: {
        tournament?: string;
        surface?: string; // tennis
        round?: string;
        venue?: string;
        homeAway?: 'home' | 'away' | 'neutral';
    };
    
    externalOdds: {
        implied: number;
        bookmakers: BookmakerOdds[];
        movement?: OddsMovement;
    };
}

export type SportType = 
    | 'tennis'
    | 'basketball'
    | 'football'
    | 'baseball'
    | 'soccer'
    | 'hockey'
    | 'golf'
    | 'mma'
    | 'boxing'
    | 'other';

export interface PlayerStats {
    name: string;
    ranking?: number;
    points?: number;
    recentForm: {
        wins: number;
        losses: number;
        last10?: MatchResult[];
    };
    surfaceRecord?: SurfaceRecord;
    injuryStatus?: 'healthy' | 'questionable' | 'injured' | 'unknown';
    seasonStats?: Record<string, any>;
}

export interface TeamStats {
    name: string;
    ranking?: number;
    record: {
        wins: number;
        losses: number;
        ties?: number;
    };
    homeRecord?: { wins: number; losses: number };
    awayRecord?: { wins: number; losses: number };
    recentForm: MatchResult[];
    injuredPlayers?: string[];
}

export interface SurfaceRecord {
    surface: string;
    wins: number;
    losses: number;
    winRate: number;
}

export interface MatchResult {
    date: string;
    opponent: string;
    score: string;
    won: boolean;
    surface?: string;
    tournament?: string;
}

export interface BookmakerOdds {
    bookmaker: string;
    odds1: number;
    odds2: number;
    implied1: number;
    implied2: number;
    timestamp: Date;
}

export interface OddsMovement {
    direction: 'up' | 'down' | 'stable';
    change24h: number;
    openingOdds: number;
    currentOdds: number;
}

// ==================== POLITICS INTELLIGENCE ====================

export interface PoliticsContext {
    electionType: 'presidential' | 'congressional' | 'gubernatorial' | 'primary' | 'referendum' | 'other';
    jurisdiction: string;
    candidates?: CandidateInfo[];
    
    polls: {
        average: number;
        recent: PollResult[];
        trend: 'improving' | 'declining' | 'stable';
    };
    
    demographics?: DemographicBreakdown;
    historicalData?: HistoricalElectionData;
    
    expertForecasts: {
        fiveThirtyEight?: ForecastModel;
        economist?: ForecastModel;
        rcp?: ForecastModel;
    };
    
    keyFactors: string[];
    newsContext?: NewsItem[];
}

export interface CandidateInfo {
    name: string;
    party: string;
    incumbent: boolean;
    pollingAverage: number;
}

export interface PollResult {
    pollster: string;
    date: string;
    results: Record<string, number>;
    sampleSize: number;
    margin: number;
    rating?: string; // A+, A, B, etc.
}

export interface DemographicBreakdown {
    byAge: Record<string, number>;
    byGender: Record<string, number>;
    byEducation: Record<string, number>;
    byRace: Record<string, number>;
    byRegion: Record<string, number>;
}

export interface HistoricalElectionData {
    previousResults: Record<string, any>[];
    incumbentAdvantage?: number;
    swingHistory?: number[];
}

export interface ForecastModel {
    probability: number;
    confidence: number;
    lastUpdated: Date;
    methodology?: string;
}

export interface NewsItem {
    headline: string;
    source: string;
    date: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    relevance: number;
}

// ==================== CRYPTO INTELLIGENCE ====================

export interface CryptoContext {
    asset: string;
    currentPrice: number;
    threshold?: number;
    
    priceHistory: {
        day: PricePoint[];
        week: PricePoint[];
        month: PricePoint[];
    };
    
    onchain: {
        walletActivity?: OnchainMetric;
        largeTransactions?: OnchainMetric;
        exchangeFlows?: ExchangeFlows;
        whaleActivity?: WhaleMetric[];
    };
    
    technicals: {
        rsi?: number;
        macd?: MACDIndicator;
        supportResistance?: SupportResistance;
        movingAverages?: MovingAverages;
        volatility?: number;
    };
    
    analysis: {
        currentDistance: number;
        percentageMove: number;
        historicalVolatility: number;
        impliedVolatility?: number;
        daysToExpiry: number;
        probabilityToHit?: number;
    };
    
    sentiment?: {
        social: number; // -1 to 1
        news: number;
        overall: number;
    };
}

export interface PricePoint {
    timestamp: Date;
    price: number;
    volume?: number;
}

export interface OnchainMetric {
    value: number;
    change24h: number;
    trend: 'up' | 'down' | 'stable';
}

export interface ExchangeFlows {
    netFlow: number;
    inflow: number;
    outflow: number;
    trend: 'accumulating' | 'distributing' | 'neutral';
}

export interface WhaleMetric {
    address: string;
    action: 'buy' | 'sell' | 'transfer';
    amount: number;
    timestamp: Date;
}

export interface MACDIndicator {
    line: number;
    signal: number;
    histogram: number;
    trend: 'bullish' | 'bearish' | 'neutral';
}

export interface SupportResistance {
    supports: number[];
    resistances: number[];
    currentLevel: 'support' | 'resistance' | 'middle';
}

export interface MovingAverages {
    ma20: number;
    ma50: number;
    ma200: number;
    crossover?: 'golden' | 'death' | 'none';
}

// ==================== ECONOMICS INTELLIGENCE ====================

export interface EconomicsContext {
    indicator: string;
    currentValue?: number;
    threshold?: number;
    
    historicalData: {
        values: DataPoint[];
        trend: 'increasing' | 'decreasing' | 'stable';
        volatility: number;
    };
    
    forecasts: {
        consensus?: number;
        range: { low: number; high: number };
        models: EconomicModel[];
    };
    
    relatedIndicators: RelatedIndicator[];
    marketImpact: MarketImpactAssessment;
}

export interface DataPoint {
    date: string;
    value: number;
    revised?: boolean;
}

export interface EconomicModel {
    source: string;
    forecast: number;
    confidence: number;
}

export interface RelatedIndicator {
    name: string;
    correlation: number;
    currentValue: number;
    trend: string;
}

export interface MarketImpactAssessment {
    equities: 'positive' | 'negative' | 'neutral';
    bonds: 'positive' | 'negative' | 'neutral';
    currencies: 'positive' | 'negative' | 'neutral';
    crypto: 'positive' | 'negative' | 'neutral';
}

// ==================== QUERY PARSING ====================

export interface ParsedQuery {
    originalQuery: string;
    intent: QueryIntent;
    domain?: MarketCategory;
    
    // Sport-specific
    sport?: SportType;
    matchType?: string;
    players?: string[];
    teams?: string[];
    
    // Politics-specific
    election?: string;
    candidates?: string[];
    jurisdiction?: string;
    
    // Crypto-specific
    asset?: string;
    threshold?: number;
    
    // Economics-specific
    indicator?: string;
    
    // Time constraints
    timeframe?: TimeFrame;
    
    // Platform preference
    platform?: 'kalshi' | 'polymarket' | 'both';
    
    // Additional filters
    minVolume?: number;
    minLiquidity?: number;
    maxSpread?: number;
    
    confidence: number;
}

export type QueryIntent = 
    | 'discovery'      // Find markets matching criteria
    | 'analysis'       // Deep analysis of specific market
    | 'comparison'     // Compare multiple markets
    | 'execution'      // Trading recommendation
    | 'monitoring'     // Set up alerts/tracking
    | 'portfolio'      // Portfolio analysis
    | 'arbitrage'      // Find arbitrage opportunities
    | 'general';       // General question

export interface TimeFrame {
    type: 'relative' | 'absolute';
    start?: Date;
    end?: Date;
    description?: string; // "next 7 days", "this week", etc.
}

// ==================== PROBABILITY ANALYSIS ====================

export interface ProbabilityAnalysis {
    fairValue: number;
    models: ProbabilityModel[];
    edge: number;
    confidence: number;
    breakdown?: ProbabilityBreakdown;
}

export interface ProbabilityModel {
    name: string;
    probability: number;
    weight: number;
    confidence: number;
    breakdown?: Record<string, any>;
}

export interface ProbabilityBreakdown {
    marketConsensus: number;
    statisticalModel: number;
    externalOdds?: number;
    historicalPattern?: number;
    expertConsensus?: number;
}

// ==================== RISK ASSESSMENT ====================

export interface RiskAssessment {
    liquidityRisk: RiskMetric;
    settlementRisk: RiskMetric;
    volatilityRisk: RiskMetric;
    concentrationRisk: RiskMetric;
    timeRisk: RiskMetric;
    overallRisk: number;
    riskFactors: string[];
}

export interface RiskMetric {
    score: number; // 1-10, higher = riskier
    level: 'LOW' | 'MEDIUM' | 'HIGH';
    details: Record<string, any>;
}

// ==================== TRADE RECOMMENDATION ====================

export interface TradeRecommendation {
    action: 'BUY' | 'SELL' | 'WAIT';
    side?: 'YES' | 'NO';
    confidence: number;
    edge: number;
    
    analysis: ProbabilityAnalysis;
    risk: RiskAssessment;
    
    sizing: {
        recommended: number;
        maximum: number;
        conservativeUnit: number;
        kellyFraction?: number;
    };
    
    pricing: {
        targetEntry: number;
        limitPrice: number;
        expectedSlippage: number;
        stopLoss?: number;
        takeProfit?: number;
    };
    
    timing: {
        urgency: 'LOW' | 'MEDIUM' | 'HIGH';
        timeHorizon: string;
        exitStrategy: string;
        optimalEntry?: string;
    };
    
    reasoning: string;
    keyFactors: string[];
    risks: string[];
    alternatives?: AlternativeMarket[];
}

export interface AlternativeMarket {
    market: UnifiedMarket;
    edge: number;
    reason: string;
}

// ==================== PERFORMANCE TRACKING ====================

export interface PredictionRecord {
    id: string;
    timestamp: Date;
    market: UnifiedMarket;
    recommendation: TradeRecommendation;
    actualOutcome?: 'YES' | 'NO';
    settled: boolean;
    performance?: {
        edgeAccuracy: number;
        profitLoss: number;
        roi: number;
        brierScore: number;
    };
}

export interface PerformanceMetrics {
    totalPredictions: number;
    settledPredictions: number;
    accuracy: number;
    averageEdge: number;
    brierScore: number;
    profitability: number;
    calibration: CalibrationData[];
    byCategory: Record<MarketCategory, CategoryMetrics>;
}

export interface CalibrationData {
    predictedProbability: number;
    actualFrequency: number;
    count: number;
}

export interface CategoryMetrics {
    accuracy: number;
    avgEdge: number;
    count: number;
    profitability: number;
}

// ==================== ALERTS & MONITORING ====================

export interface MarketAlert {
    id: string;
    type: AlertType;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    market: UnifiedMarket;
    message: string;
    data: Record<string, any>;
    timestamp: Date;
    action?: string;
}

export type AlertType = 
    | 'PRICE_SPIKE'
    | 'VOLUME_SURGE'
    | 'EDGE_OPPORTUNITY'
    | 'SPREAD_CHANGE'
    | 'LIQUIDITY_DROP'
    | 'SETTLEMENT_NEAR'
    | 'NEWS_EVENT'
    | 'ARBITRAGE';

// ==================== USER PROFILE ====================

export interface UserProfile {
    userId: string;
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
    sportExpertise: SportType[];
    preferredCategories: MarketCategory[];
    averagePosition: number;
    preferredHoldTime: string;
    historicalROI?: number;
    tradingHistory?: TradeHistory[];
    watchList?: WatchListItem[];
}

export interface TradeHistory {
    marketId: string;
    platform: string;
    side: 'YES' | 'NO';
    entryPrice: number;
    exitPrice?: number;
    outcome?: 'WIN' | 'LOSS' | 'PENDING';
    profitLoss?: number;
    timestamp: Date;
}

export interface WatchListItem {
    marketId: string;
    platform: string;
    addedAt: Date;
    priceAlertAbove?: number;
    priceAlertBelow?: number;
    notes?: string;
}
