/**
 * Sports Intelligence Service
 * 
 * Provides contextual sports data for prediction market analysis:
 * - Player/team stats and rankings
 * - Head-to-head records
 * - Recent form analysis
 * - Surface/venue advantages
 * - External odds comparison
 */

import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { CacheService } from '../common/cache.service';
import {
    UnifiedMarket,
    SportsContext,
    SportType,
    PlayerStats,
    TeamStats,
    MatchResult,
    BookmakerOdds,
    SurfaceRecord,
} from './types';

// ATP/WTA Rankings data (would be fetched from API in production)
const ATP_RANKINGS: Record<string, { ranking: number; points: number }> = {
    'Jannik Sinner': { ranking: 1, points: 11830 },
    'Carlos Alcaraz': { ranking: 2, points: 9010 },
    'Alexander Zverev': { ranking: 3, points: 7075 },
    'Novak Djokovic': { ranking: 4, points: 6470 },
    'Daniil Medvedev': { ranking: 5, points: 6400 },
    'Andrey Rublev': { ranking: 6, points: 4920 },
    'Casper Ruud': { ranking: 7, points: 4490 },
    'Taylor Fritz': { ranking: 8, points: 4300 },
    'Hubert Hurkacz': { ranking: 9, points: 4055 },
    'Stefanos Tsitsipas': { ranking: 10, points: 3950 },
    'Luciano Darderi': { ranking: 42, points: 1342 },
};

const WTA_RANKINGS: Record<string, { ranking: number; points: number }> = {
    'Iga Swiatek': { ranking: 1, points: 10885 },
    'Aryna Sabalenka': { ranking: 2, points: 9416 },
    'Coco Gauff': { ranking: 3, points: 8108 },
    'Elena Rybakina': { ranking: 4, points: 6026 },
    'Jessica Pegula': { ranking: 5, points: 5785 },
};

// Head-to-head records
const HEAD_TO_HEAD: Record<string, { overall: string; surface?: Record<string, string> }> = {
    'Jannik Sinner vs Luciano Darderi': {
        overall: '1-0',
        surface: {
            'hard': '1-0',
            'clay': '0-0',
        },
    },
    'Carlos Alcaraz vs Jannik Sinner': {
        overall: '5-4',
        surface: {
            'hard': '2-2',
            'clay': '2-1',
            'grass': '1-1',
        },
    },
};

@Injectable()
export class SportsIntelligenceService {
    private readonly logger = new Logger(SportsIntelligenceService.name);
    private readonly oddsClient: AxiosInstance;

    constructor(private cacheService: CacheService) {
        // Client for fetching odds (would use OddsAPI or similar in production)
        this.oddsClient = axios.create({
            timeout: 5000,
        });
    }

    /**
     * Enrich a sports market with contextual intelligence
     */
    async enrichSportsMarket(market: UnifiedMarket): Promise<UnifiedMarket> {
        if (market.category !== 'sports') {
            return market;
        }

        try {
            const sportType = this.detectSportType(market.question);
            
            if (sportType === 'tennis') {
                const context = await this.enrichTennisMarket(market);
                return { ...market, sportsContext: context };
            }
            
            if (sportType === 'basketball' || sportType === 'football') {
                const context = await this.enrichTeamSportsMarket(market, sportType);
                return { ...market, sportsContext: context };
            }

            return market;
        } catch (error) {
            this.logger.error(`Failed to enrich sports market: ${error}`);
            return market;
        }
    }

    /**
     * Enrich tennis market with player stats, H2H, and odds
     */
    private async enrichTennisMarket(market: UnifiedMarket): Promise<SportsContext> {
        const players = this.extractPlayers(market.question);
        
        if (players.length < 2) {
            throw new Error('Could not extract two players from market');
        }

        const [player1Stats, player2Stats] = await Promise.all([
            this.getTennisPlayerStats(players[0]),
            this.getTennisPlayerStats(players[1]),
        ]);

        const h2h = this.getHeadToHead(players[0], players[1]);
        const surface = this.detectSurface(market.question);
        const tournament = this.detectTournament(market.question);
        const matchType = this.detectMatchType(players[0], players[1]);

        // Get external odds for comparison
        const externalOdds = await this.getExternalOdds(players[0], players[1]);

        return {
            sport: 'tennis',
            matchType,
            players: {
                player1: player1Stats,
                player2: player2Stats,
            },
            headToHead: {
                overall: h2h.overall,
                onSurface: h2h.surface?.[surface],
                lastMatch: this.getLastMatch(players[0], players[1]),
            },
            context: {
                tournament,
                surface,
                round: this.detectRound(market.question),
            },
            externalOdds,
        };
    }

    /**
     * Enrich team sports market
     */
    private async enrichTeamSportsMarket(
        market: UnifiedMarket,
        sport: SportType
    ): Promise<SportsContext> {
        const teams = this.extractTeams(market.question);
        
        if (teams.length < 2) {
            throw new Error('Could not extract two teams from market');
        }

        // In production, would fetch from sports APIs
        const team1Stats = this.getTeamStats(teams[0], sport);
        const team2Stats = this.getTeamStats(teams[1], sport);

        return {
            sport,
            matchType: sport === 'basketball' ? 'NBA' : 'NFL',
            players: {
                player1: { name: teams[0], recentForm: { wins: 0, losses: 0 } },
                player2: { name: teams[1], recentForm: { wins: 0, losses: 0 } },
            },
            teams: {
                team1: team1Stats,
                team2: team2Stats,
            },
            headToHead: {
                overall: 'N/A',
            },
            context: {
                venue: this.detectVenue(market.question),
                homeAway: this.detectHomeAway(market.question, teams[0], teams[1]),
            },
            externalOdds: {
                implied: 0.5,
                bookmakers: [],
            },
        };
    }

    /**
     * Get tennis player stats
     */
    private async getTennisPlayerStats(playerName: string): Promise<PlayerStats> {
        const cacheKey = `tennis_stats_${playerName}`;
        
        return this.cacheService.wrap(
            cacheKey,
            300, // 5 minute cache (in seconds)
            async () => {
                // Check ATP rankings first
                let rankingData = ATP_RANKINGS[playerName];
                let tour = 'ATP';
                
                // Check WTA if not in ATP
                if (!rankingData) {
                    rankingData = WTA_RANKINGS[playerName];
                    tour = 'WTA';
                }

                // Get recent form (would fetch from API in production)
                const recentForm = await this.getRecentForm(playerName);

                return {
                    name: playerName,
                    ranking: rankingData?.ranking || 999,
                    points: rankingData?.points || 0,
                    recentForm,
                    surfaceRecord: this.getSurfaceRecord(playerName),
                    injuryStatus: 'healthy' as const,
                    seasonStats: {
                        tour,
                        wins: Math.floor(Math.random() * 30) + 10,
                        losses: Math.floor(Math.random() * 10) + 2,
                        titles: Math.floor(Math.random() * 3),
                    },
                };
            }
        );
    }

    /**
     * Get team stats
     */
    private getTeamStats(teamName: string, sport: SportType): TeamStats {
        // In production, would fetch from sports APIs
        return {
            name: teamName,
            ranking: Math.floor(Math.random() * 30) + 1,
            record: {
                wins: Math.floor(Math.random() * 20) + 5,
                losses: Math.floor(Math.random() * 15) + 3,
            },
            recentForm: [],
            homeRecord: {
                wins: Math.floor(Math.random() * 10) + 3,
                losses: Math.floor(Math.random() * 5) + 1,
            },
            awayRecord: {
                wins: Math.floor(Math.random() * 8) + 2,
                losses: Math.floor(Math.random() * 7) + 2,
            },
        };
    }

    /**
     * Get recent form for a player
     */
    private async getRecentForm(playerName: string): Promise<{ wins: number; losses: number; last10?: MatchResult[] }> {
        // In production, would fetch from tennis API
        // Simulate based on ranking
        const ranking = ATP_RANKINGS[playerName]?.ranking || WTA_RANKINGS[playerName]?.ranking || 100;
        
        // Better ranked players have better recent form
        const winRate = Math.max(0.3, 1 - (ranking / 150));
        const wins = Math.round(10 * winRate);
        const losses = 10 - wins;

        return {
            wins,
            losses,
            last10: [], // Would include actual match results
        };
    }

    /**
     * Get surface record for a player
     */
    private getSurfaceRecord(playerName: string): SurfaceRecord {
        const ranking = ATP_RANKINGS[playerName]?.ranking || WTA_RANKINGS[playerName]?.ranking || 100;
        const baseWinRate = Math.max(0.3, 1 - (ranking / 150));

        return {
            surface: 'hard',
            wins: Math.round(50 * baseWinRate),
            losses: Math.round(50 * (1 - baseWinRate)),
            winRate: baseWinRate,
        };
    }

    /**
     * Get head-to-head record between two players
     */
    private getHeadToHead(player1: string, player2: string): { overall: string; surface?: Record<string, string> } {
        const key1 = `${player1} vs ${player2}`;
        const key2 = `${player2} vs ${player1}`;
        
        if (HEAD_TO_HEAD[key1]) {
            return HEAD_TO_HEAD[key1];
        }
        
        if (HEAD_TO_HEAD[key2]) {
            // Reverse the record
            const h2h = HEAD_TO_HEAD[key2];
            const [wins, losses] = h2h.overall.split('-').map(Number);
            return {
                overall: `${losses}-${wins}`,
                surface: h2h.surface ? Object.fromEntries(
                    Object.entries(h2h.surface).map(([k, v]) => {
                        const [w, l] = v.split('-').map(Number);
                        return [k, `${l}-${w}`];
                    })
                ) : undefined,
            };
        }

        // No H2H record found, return first meeting
        return { overall: '0-0 (First meeting)' };
    }

    /**
     * Get last match between two players
     */
    private getLastMatch(player1: string, player2: string): MatchResult | undefined {
        // In production, would fetch from API
        return undefined;
    }

    /**
     * Get external bookmaker odds for comparison
     */
    private async getExternalOdds(player1: string, player2: string): Promise<{
        implied: number;
        bookmakers: BookmakerOdds[];
        movement?: any;
    }> {
        // In production, would fetch from OddsAPI or similar
        // For now, calculate based on rankings
        const rank1 = ATP_RANKINGS[player1]?.ranking || WTA_RANKINGS[player1]?.ranking || 100;
        const rank2 = ATP_RANKINGS[player2]?.ranking || WTA_RANKINGS[player2]?.ranking || 100;

        // Simple Elo-like probability based on ranking difference
        const rankDiff = rank2 - rank1;
        const implied = 1 / (1 + Math.pow(10, -rankDiff / 50));

        return {
            implied,
            bookmakers: [
                {
                    bookmaker: 'Estimated (Ranking-based)',
                    odds1: 1 / implied,
                    odds2: 1 / (1 - implied),
                    implied1: implied,
                    implied2: 1 - implied,
                    timestamp: new Date(),
                },
            ],
        };
    }

    /**
     * Extract player names from market question
     */
    private extractPlayers(question: string): string[] {
        const players: string[] = [];
        
        // Check for known players
        const allPlayers = { ...ATP_RANKINGS, ...WTA_RANKINGS };
        for (const player of Object.keys(allPlayers)) {
            const lastName = player.split(' ').pop()?.toLowerCase() || '';
            if (question.toLowerCase().includes(lastName)) {
                players.push(player);
            }
        }

        // Try to extract from "vs" pattern
        if (players.length < 2) {
            const vsMatch = question.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:vs\.?|versus|v\.?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
            if (vsMatch) {
                players.push(this.normalizePlayerName(vsMatch[1]));
                players.push(this.normalizePlayerName(vsMatch[2]));
            }
        }

        return players.slice(0, 2);
    }

    /**
     * Extract team names from market question
     */
    private extractTeams(question: string): string[] {
        // NBA teams
        const nbaTeams = ['Lakers', 'Celtics', 'Warriors', 'Heat', 'Nets', 'Bulls', 'Knicks', 'Bucks', 'Suns', '76ers'];
        // NFL teams
        const nflTeams = ['Chiefs', 'Eagles', 'Bills', 'Cowboys', '49ers', 'Dolphins', 'Ravens', 'Lions', 'Packers', 'Jets'];
        
        const allTeams = [...nbaTeams, ...nflTeams];
        const found: string[] = [];

        for (const team of allTeams) {
            if (question.toLowerCase().includes(team.toLowerCase())) {
                found.push(team);
            }
        }

        return found.slice(0, 2);
    }

    /**
     * Normalize player name
     */
    private normalizePlayerName(name: string): string {
        const allPlayers = { ...ATP_RANKINGS, ...WTA_RANKINGS };
        const lowerName = name.toLowerCase();
        
        for (const player of Object.keys(allPlayers)) {
            if (player.toLowerCase().includes(lowerName) || 
                lowerName.includes(player.split(' ').pop()?.toLowerCase() || '')) {
                return player;
            }
        }
        
        return name;
    }

    /**
     * Detect sport type from question
     */
    private detectSportType(question: string): SportType {
        const lower = question.toLowerCase();
        
        if (lower.includes('tennis') || lower.includes('atp') || lower.includes('wta') ||
            lower.includes('wimbledon') || lower.includes('us open') || lower.includes('australian open')) {
            return 'tennis';
        }
        
        if (lower.includes('nba') || lower.includes('basketball')) {
            return 'basketball';
        }
        
        if (lower.includes('nfl') || lower.includes('super bowl') || lower.includes('football')) {
            return 'football';
        }
        
        if (lower.includes('mlb') || lower.includes('baseball')) {
            return 'baseball';
        }
        
        if (lower.includes('nhl') || lower.includes('hockey')) {
            return 'hockey';
        }
        
        if (lower.includes('ufc') || lower.includes('mma')) {
            return 'mma';
        }

        // Check for tennis players
        const players = this.extractPlayers(question);
        if (players.length > 0) {
            return 'tennis';
        }

        return 'other';
    }

    /**
     * Detect tennis surface from question
     */
    private detectSurface(question: string): string {
        const lower = question.toLowerCase();
        
        if (lower.includes('wimbledon') || lower.includes('grass')) {
            return 'grass';
        }
        
        if (lower.includes('french open') || lower.includes('roland garros') || lower.includes('clay')) {
            return 'clay';
        }
        
        if (lower.includes('us open') || lower.includes('australian open') || lower.includes('hard')) {
            return 'hard';
        }

        // Default to hard court
        return 'hard';
    }

    /**
     * Detect tournament from question
     */
    private detectTournament(question: string): string | undefined {
        const lower = question.toLowerCase();
        const tournaments = [
            'Australian Open', 'French Open', 'Wimbledon', 'US Open',
            'Indian Wells', 'Miami Open', 'Monte Carlo', 'Madrid Open',
            'Italian Open', 'Cincinnati', 'Toronto', 'Montreal',
        ];

        for (const tournament of tournaments) {
            if (lower.includes(tournament.toLowerCase())) {
                return tournament;
            }
        }

        return undefined;
    }

    /**
     * Detect round from question
     */
    private detectRound(question: string): string | undefined {
        const lower = question.toLowerCase();
        const rounds = ['final', 'semifinal', 'semi-final', 'quarterfinal', 'quarter-final', 
                       'round of 16', 'round of 32', 'first round', 'second round', 'third round'];
        
        for (const round of rounds) {
            if (lower.includes(round)) {
                return round;
            }
        }

        return undefined;
    }

    /**
     * Detect match type (ATP/WTA)
     */
    private detectMatchType(player1: string, player2: string): string {
        if (WTA_RANKINGS[player1] || WTA_RANKINGS[player2]) {
            return 'WTA';
        }
        return 'ATP';
    }

    /**
     * Detect venue from question
     */
    private detectVenue(question: string): string | undefined {
        // Would extract venue information in production
        return undefined;
    }

    /**
     * Detect home/away from question
     */
    private detectHomeAway(question: string, team1: string, team2: string): 'home' | 'away' | 'neutral' {
        const lower = question.toLowerCase();
        
        if (lower.includes('at home') || lower.includes(`${team2.toLowerCase()} at ${team1.toLowerCase()}`)) {
            return 'home';
        }
        
        if (lower.includes('away') || lower.includes(`${team1.toLowerCase()} at ${team2.toLowerCase()}`)) {
            return 'away';
        }

        return 'neutral';
    }

    /**
     * Calculate fair value probability using sports models
     */
    calculateSportsProbability(context: SportsContext): number {
        if (context.sport === 'tennis') {
            return this.calculateTennisProbability(context);
        }
        
        // Default to market consensus for other sports
        return 0.5;
    }

    /**
     * Calculate tennis probability using Elo-like model
     */
    private calculateTennisProbability(context: SportsContext): number {
        const player1 = context.players.player1;
        const player2 = context.players.player2;

        // Base Elo calculation from rankings
        const rank1 = player1.ranking || 100;
        const rank2 = player2.ranking || 100;
        const rankDiff = rank2 - rank1;
        let baseProb = 1 / (1 + Math.pow(10, -rankDiff / 50));

        // Adjust for recent form
        const form1 = player1.recentForm.wins / (player1.recentForm.wins + player1.recentForm.losses + 0.01);
        const form2 = player2.recentForm.wins / (player2.recentForm.wins + player2.recentForm.losses + 0.01);
        const formAdj = (form1 - form2) * 0.1;
        baseProb += formAdj;

        // Adjust for surface (if available)
        if (player1.surfaceRecord && player2.surfaceRecord) {
            const surface1WinRate = player1.surfaceRecord.winRate;
            const surface2WinRate = player2.surfaceRecord.winRate;
            const surfaceAdj = (surface1WinRate - surface2WinRate) * 0.05;
            baseProb += surfaceAdj;
        }

        // H2H adjustment
        if (context.headToHead.overall && context.headToHead.overall !== '0-0 (First meeting)') {
            const [wins, losses] = context.headToHead.overall.split('-').map(Number);
            if (!isNaN(wins) && !isNaN(losses) && (wins + losses) > 0) {
                const h2hRate = wins / (wins + losses);
                const h2hAdj = (h2hRate - 0.5) * 0.1;
                baseProb += h2hAdj;
            }
        }

        // Clamp to valid probability range
        return Math.max(0.05, Math.min(0.95, baseProb));
    }
}
