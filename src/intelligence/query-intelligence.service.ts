/**
 * Query Intelligence Service
 * 
 * Parses natural language queries into structured search parameters
 * using AI for intent classification and entity extraction.
 */

import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '../config/config.service';
import {
    ParsedQuery,
    QueryIntent,
    MarketCategory,
    SportType,
    TimeFrame,
} from './types';

const QUERY_PARSING_PROMPT = `You are a prediction market query parser. Extract structured information from natural language queries.

TASK: Parse the user query and extract relevant information for market discovery.

IMPORTANT RULES:
1. For sports queries, normalize player names (e.g., "Sinner" → "Jannik Sinner")
2. Detect sport type from context (tennis players, NBA teams, etc.)
3. Identify query intent: discovery, analysis, comparison, execution, monitoring
4. Extract time constraints (next week, tomorrow, etc.)
5. Detect platform preference if mentioned (Kalshi, Polymarket)
6. For head-to-head matches, set exactMatch: true

OUTPUT FORMAT (JSON only, no markdown):
{
  "intent": "discovery|analysis|comparison|execution|monitoring|portfolio|arbitrage|general",
  "domain": "sports|politics|crypto|economics|weather|entertainment|other|null",
  "sport": "tennis|basketball|football|baseball|soccer|hockey|golf|mma|boxing|other|null",
  "matchType": "ATP|WTA|NBA|NFL|MLB|NHL|UFC|null",
  "players": ["Full Name 1", "Full Name 2"],
  "teams": ["Team Name 1", "Team Name 2"],
  "election": "string or null",
  "candidates": ["Candidate 1", "Candidate 2"],
  "asset": "BTC|ETH|SOL|etc or null",
  "threshold": "number or null",
  "indicator": "inflation|employment|GDP|etc or null",
  "timeframe": {
    "type": "relative|absolute",
    "description": "next 7 days|this week|etc"
  },
  "platform": "kalshi|polymarket|both",
  "minVolume": "number or null",
  "exactMatch": "boolean",
  "confidence": "0.0-1.0"
}

EXAMPLES:

Query: "Darderi vs Sinner on Kalshi"
Output:
{
  "intent": "discovery",
  "domain": "sports",
  "sport": "tennis",
  "matchType": "ATP",
  "players": ["Luciano Darderi", "Jannik Sinner"],
  "teams": [],
  "election": null,
  "candidates": [],
  "asset": null,
  "threshold": null,
  "indicator": null,
  "timeframe": null,
  "platform": "kalshi",
  "minVolume": null,
  "exactMatch": true,
  "confidence": 0.95
}

Query: "Who will win Super Bowl next year"
Output:
{
  "intent": "discovery",
  "domain": "sports",
  "sport": "football",
  "matchType": "NFL",
  "players": [],
  "teams": [],
  "election": null,
  "candidates": [],
  "asset": null,
  "threshold": null,
  "indicator": null,
  "timeframe": {
    "type": "relative",
    "description": "next year"
  },
  "platform": "both",
  "minVolume": null,
  "exactMatch": false,
  "confidence": 0.9
}

Query: "Bitcoin reaching 100k before March"
Output:
{
  "intent": "discovery",
  "domain": "crypto",
  "sport": null,
  "matchType": null,
  "players": [],
  "teams": [],
  "election": null,
  "candidates": [],
  "asset": "BTC",
  "threshold": 100000,
  "indicator": null,
  "timeframe": {
    "type": "absolute",
    "description": "before March"
  },
  "platform": "both",
  "minVolume": null,
  "exactMatch": false,
  "confidence": 0.92
}

Query: "2024 presidential election odds Trump vs Biden"
Output:
{
  "intent": "comparison",
  "domain": "politics",
  "sport": null,
  "matchType": null,
  "players": [],
  "teams": [],
  "election": "2024 US Presidential Election",
  "candidates": ["Donald Trump", "Joe Biden"],
  "asset": null,
  "threshold": null,
  "indicator": null,
  "timeframe": null,
  "platform": "both",
  "minVolume": null,
  "exactMatch": false,
  "confidence": 0.95
}`;

// Tennis player name mappings for normalization
const TENNIS_PLAYER_ALIASES: Record<string, string> = {
    'sinner': 'Jannik Sinner',
    'jannik': 'Jannik Sinner',
    'darderi': 'Luciano Darderi',
    'luciano': 'Luciano Darderi',
    'alcaraz': 'Carlos Alcaraz',
    'carlos': 'Carlos Alcaraz',
    'djokovic': 'Novak Djokovic',
    'novak': 'Novak Djokovic',
    'nadal': 'Rafael Nadal',
    'rafa': 'Rafael Nadal',
    'federer': 'Roger Federer',
    'roger': 'Roger Federer',
    'medvedev': 'Daniil Medvedev',
    'daniil': 'Daniil Medvedev',
    'zverev': 'Alexander Zverev',
    'rublev': 'Andrey Rublev',
    'tsitsipas': 'Stefanos Tsitsipas',
    'fritz': 'Taylor Fritz',
    'ruud': 'Casper Ruud',
    'swiatek': 'Iga Swiatek',
    'iga': 'Iga Swiatek',
    'sabalenka': 'Aryna Sabalenka',
    'aryna': 'Aryna Sabalenka',
    'gauff': 'Coco Gauff',
    'coco': 'Coco Gauff',
    'rybakina': 'Elena Rybakina',
    'pegula': 'Jessica Pegula',
};

@Injectable()
export class QueryIntelligenceService {
    private readonly logger = new Logger(QueryIntelligenceService.name);
    private anthropic: Anthropic;

    constructor(private configService: ConfigService) {
        this.anthropic = new Anthropic({
            apiKey: this.configService.anthropicApiKey,
        });
    }

    /**
     * Parse a natural language query into structured search parameters
     */
    async parseQuery(query: string, conversationContext?: string): Promise<ParsedQuery> {
        try {
            // First, try quick pattern matching for common queries
            const quickParse = this.quickParse(query);
            if (quickParse && quickParse.confidence > 0.85) {
                this.logger.debug(`Quick parse successful for: ${query}`);
                return quickParse;
            }

            // Use AI for complex queries
            const response = await this.anthropic.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1000,
                messages: [
                    {
                        role: 'user',
                        content: `${QUERY_PARSING_PROMPT}\n\nQuery: "${query}"${conversationContext ? `\nConversation context: ${conversationContext}` : ''}\n\nOutput JSON:`,
                    },
                ],
            });

            const content = response.content[0];
            if (content.type !== 'text') {
                throw new Error('Unexpected response type');
            }

            // Parse the JSON response
            const parsed = this.extractJSON(content.text);
            
            // Normalize and validate
            return this.normalizeParsedQuery(query, parsed);
        } catch (error) {
            this.logger.error(`Failed to parse query: ${query}`, error);
            
            // Return a basic parsed query as fallback
            return {
                originalQuery: query,
                intent: 'discovery',
                platform: 'both',
                confidence: 0.3,
            };
        }
    }

    /**
     * Quick pattern matching for common query types
     */
    private quickParse(query: string): ParsedQuery | null {
        const lowerQuery = query.toLowerCase();
        
        // Tennis match pattern: "Player1 vs Player2"
        const vsMatch = lowerQuery.match(/(\w+)\s+(?:vs\.?|versus|v\.?)\s+(\w+)/i);
        if (vsMatch) {
            const player1 = this.normalizePlayerName(vsMatch[1]);
            const player2 = this.normalizePlayerName(vsMatch[2]);
            
            // Check if these are known tennis players
            if (this.isTennisPlayer(vsMatch[1]) || this.isTennisPlayer(vsMatch[2])) {
                return {
                    originalQuery: query,
                    intent: 'discovery',
                    domain: 'sports',
                    sport: 'tennis',
                    matchType: this.detectTennisMatchType(player1, player2),
                    players: [player1, player2],
                    platform: this.detectPlatform(lowerQuery),
                    confidence: 0.9,
                };
            }
        }

        // Crypto price threshold pattern
        const cryptoMatch = lowerQuery.match(/(btc|bitcoin|eth|ethereum|sol|solana)\s+(?:reach|hit|above|below|at)\s+\$?(\d+(?:,\d+)*(?:k)?)/i);
        if (cryptoMatch) {
            const asset = this.normalizeCryptoAsset(cryptoMatch[1]);
            let threshold = parseFloat(cryptoMatch[2].replace(/,/g, ''));
            if (cryptoMatch[2].toLowerCase().includes('k')) {
                threshold *= 1000;
            }
            
            return {
                originalQuery: query,
                intent: 'discovery',
                domain: 'crypto',
                asset,
                threshold,
                platform: this.detectPlatform(lowerQuery),
                confidence: 0.88,
            };
        }

        // Trending/popular markets pattern
        if (lowerQuery.match(/trending|popular|hot|top\s+markets?|most\s+traded/)) {
            return {
                originalQuery: query,
                intent: 'discovery',
                platform: this.detectPlatform(lowerQuery),
                confidence: 0.95,
            };
        }

        // Election pattern
        const electionMatch = lowerQuery.match(/(presidential|senate|governor|congress|election).*?(trump|biden|harris|desantis)/i);
        if (electionMatch) {
            const candidates = this.extractCandidates(lowerQuery);
            return {
                originalQuery: query,
                intent: 'discovery',
                domain: 'politics',
                election: this.normalizeElection(electionMatch[1]),
                candidates,
                platform: this.detectPlatform(lowerQuery),
                confidence: 0.87,
            };
        }

        return null;
    }

    /**
     * Extract JSON from AI response (handles markdown code blocks)
     */
    private extractJSON(text: string): any {
        // Remove markdown code blocks if present
        let jsonStr = text.trim();
        if (jsonStr.startsWith('```json')) {
            jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (jsonStr.startsWith('```')) {
            jsonStr = jsonStr.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }

        return JSON.parse(jsonStr);
    }

    /**
     * Normalize and validate parsed query
     */
    private normalizeParsedQuery(originalQuery: string, parsed: any): ParsedQuery {
        // Normalize player names
        const players = (parsed.players || []).map((p: string) => 
            this.normalizePlayerName(p)
        );

        // Normalize timeframe
        let timeframe: TimeFrame | undefined;
        if (parsed.timeframe) {
            timeframe = {
                type: parsed.timeframe.type || 'relative',
                description: parsed.timeframe.description,
            };
            
            // Parse dates if possible
            if (parsed.timeframe.description) {
                const dates = this.parseTimeDescription(parsed.timeframe.description);
                if (dates) {
                    timeframe.start = dates.start;
                    timeframe.end = dates.end;
                }
            }
        }

        return {
            originalQuery,
            intent: (parsed.intent || 'discovery') as QueryIntent,
            domain: parsed.domain as MarketCategory | undefined,
            sport: parsed.sport as SportType | undefined,
            matchType: parsed.matchType,
            players: players.length > 0 ? players : undefined,
            teams: parsed.teams?.length > 0 ? parsed.teams : undefined,
            election: parsed.election,
            candidates: parsed.candidates?.length > 0 ? parsed.candidates : undefined,
            asset: parsed.asset,
            threshold: parsed.threshold,
            indicator: parsed.indicator,
            timeframe,
            platform: (parsed.platform || 'both') as 'kalshi' | 'polymarket' | 'both',
            minVolume: parsed.minVolume,
            minLiquidity: parsed.minLiquidity,
            confidence: parsed.confidence || 0.7,
        };
    }

    /**
     * Normalize player name using alias mapping
     */
    private normalizePlayerName(name: string): string {
        const lowerName = name.toLowerCase().trim();
        return TENNIS_PLAYER_ALIASES[lowerName] || this.titleCase(name);
    }

    /**
     * Check if a name is a known tennis player
     */
    private isTennisPlayer(name: string): boolean {
        const lowerName = name.toLowerCase().trim();
        return lowerName in TENNIS_PLAYER_ALIASES;
    }

    /**
     * Detect if ATP or WTA based on player names
     */
    private detectTennisMatchType(player1: string, player2: string): string {
        const wtaPlayers = ['Iga Swiatek', 'Aryna Sabalenka', 'Coco Gauff', 'Elena Rybakina', 'Jessica Pegula'];
        
        if (wtaPlayers.includes(player1) || wtaPlayers.includes(player2)) {
            return 'WTA';
        }
        return 'ATP';
    }

    /**
     * Detect platform from query text
     */
    private detectPlatform(query: string): 'kalshi' | 'polymarket' | 'both' {
        if (query.includes('kalshi')) return 'kalshi';
        if (query.includes('polymarket') || query.includes('poly')) return 'polymarket';
        return 'both';
    }

    /**
     * Normalize crypto asset name
     */
    private normalizeCryptoAsset(asset: string): string {
        const mapping: Record<string, string> = {
            'btc': 'BTC',
            'bitcoin': 'BTC',
            'eth': 'ETH',
            'ethereum': 'ETH',
            'sol': 'SOL',
            'solana': 'SOL',
        };
        return mapping[asset.toLowerCase()] || asset.toUpperCase();
    }

    /**
     * Extract candidate names from query
     */
    private extractCandidates(query: string): string[] {
        const candidateMap: Record<string, string> = {
            'trump': 'Donald Trump',
            'biden': 'Joe Biden',
            'harris': 'Kamala Harris',
            'desantis': 'Ron DeSantis',
        };

        const candidates: string[] = [];
        for (const [key, value] of Object.entries(candidateMap)) {
            if (query.toLowerCase().includes(key)) {
                candidates.push(value);
            }
        }
        return candidates;
    }

    /**
     * Normalize election type
     */
    private normalizeElection(type: string): string {
        const mapping: Record<string, string> = {
            'presidential': '2024 US Presidential Election',
            'senate': '2024 US Senate Elections',
            'governor': '2024 Governor Elections',
            'congress': '2024 US Congressional Elections',
            'election': '2024 Elections',
        };
        return mapping[type.toLowerCase()] || type;
    }

    /**
     * Parse time description into dates
     */
    private parseTimeDescription(description: string): { start?: Date; end?: Date } | null {
        const now = new Date();
        const lower = description.toLowerCase();

        if (lower.includes('next week')) {
            const start = new Date(now);
            const end = new Date(now);
            end.setDate(end.getDate() + 7);
            return { start, end };
        }

        if (lower.includes('next month')) {
            const start = new Date(now);
            const end = new Date(now);
            end.setMonth(end.getMonth() + 1);
            return { start, end };
        }

        if (lower.includes('next 7 days') || lower.includes('this week')) {
            const start = new Date(now);
            const end = new Date(now);
            end.setDate(end.getDate() + 7);
            return { start, end };
        }

        if (lower.includes('tomorrow')) {
            const start = new Date(now);
            start.setDate(start.getDate() + 1);
            start.setHours(0, 0, 0, 0);
            const end = new Date(start);
            end.setHours(23, 59, 59, 999);
            return { start, end };
        }

        // Month-specific (before March, by April, etc.)
        const monthMatch = lower.match(/(?:before|by|in)\s+(january|february|march|april|may|june|july|august|september|october|november|december)/i);
        if (monthMatch) {
            const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                              'july', 'august', 'september', 'october', 'november', 'december'];
            const monthIndex = monthNames.indexOf(monthMatch[1].toLowerCase());
            if (monthIndex !== -1) {
                const end = new Date(now.getFullYear(), monthIndex, 1);
                if (end <= now) {
                    end.setFullYear(end.getFullYear() + 1);
                }
                return { start: now, end };
            }
        }

        return null;
    }

    /**
     * Convert string to title case
     */
    private titleCase(str: string): string {
        return str
            .toLowerCase()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    /**
     * Build search filters for market discovery based on parsed query
     */
    buildSearchFilters(parsed: ParsedQuery): SearchFilters {
        const filters: SearchFilters = {
            platform: parsed.platform === 'both' ? undefined : parsed.platform,
            active: true,
            limit: 50,
        };

        // Build search keywords
        const keywords: string[] = [];

        if (parsed.players?.length) {
            // For exact match, search for both players
            keywords.push(...parsed.players);
        }

        if (parsed.teams?.length) {
            keywords.push(...parsed.teams);
        }

        if (parsed.candidates?.length) {
            keywords.push(...parsed.candidates);
        }

        if (parsed.asset) {
            keywords.push(parsed.asset);
        }

        if (parsed.indicator) {
            keywords.push(parsed.indicator);
        }

        if (keywords.length > 0) {
            filters.searchQuery = keywords.join(' ');
        }

        // Category filter
        if (parsed.domain) {
            filters.category = parsed.domain;
        }

        // Volume filter
        if (parsed.minVolume) {
            filters.minVolume = parsed.minVolume;
        }

        // Liquidity filter
        if (parsed.minLiquidity) {
            filters.minLiquidity = parsed.minLiquidity;
        }

        // Time filters
        if (parsed.timeframe?.end) {
            filters.maxEndDate = parsed.timeframe.end;
        }
        if (parsed.timeframe?.start) {
            filters.minEndDate = parsed.timeframe.start;
        }

        return filters;
    }
}

export interface SearchFilters {
    platform?: 'kalshi' | 'polymarket';
    category?: string;
    searchQuery?: string;
    minVolume?: number;
    minLiquidity?: number;
    minEndDate?: Date;
    maxEndDate?: Date;
    active?: boolean;
    limit?: number;
}
