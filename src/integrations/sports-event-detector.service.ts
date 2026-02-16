/**
 * Sports Event Detector Service
 * 
 * Detects if a prediction market is about a live or upcoming sports event.
 * Uses ESPN API and pattern matching to identify live games.
 */

import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { CacheService } from '../common/cache.service';

export interface LiveSportsEvent {
    isLive: boolean;
    sport: string;
    sportCode: string;
    teams: string[];
    league: string;
    event: string;
    startTime: string;
    status: 'LIVE' | 'UPCOMING' | 'FINAL';
    gameId?: string;
    score?: {
        home: number;
        away: number;
        period?: string;
        clock?: string;
    };
    venue?: string;
    broadcast?: string[];
}

interface ParsedMarketInfo {
    sport: string;
    sportCode: string;
    teams: string[];
    players?: string[];
    league: string;
    rawQuestion: string;
}

@Injectable()
export class SportsEventDetectorService {
    private readonly logger = new Logger(SportsEventDetectorService.name);
    private readonly httpClient: AxiosInstance;
    
    // ESPN API endpoints for different sports
    private readonly ESPN_ENDPOINTS = {
        nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
        nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
        mlb: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
        nhl: 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard',
        ncaaf: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
        ncaab: 'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard',
        mls: 'https://site.api.espn.com/apis/site/v2/sports/soccer/usa.1/scoreboard',
        epl: 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard',
        tennis: 'https://site.api.espn.com/apis/site/v2/sports/tennis/atp/scoreboard',
        ufc: 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard',
    };

    // Team name mappings for fuzzy matching
    private readonly TEAM_ALIASES: Record<string, string[]> = {
        // NFL
        'Chiefs': ['Kansas City Chiefs', 'KC Chiefs', 'Kansas City'],
        '49ers': ['San Francisco 49ers', 'SF 49ers', 'San Francisco', 'Niners'],
        'Ravens': ['Baltimore Ravens', 'Baltimore'],
        'Bills': ['Buffalo Bills', 'Buffalo'],
        'Eagles': ['Philadelphia Eagles', 'Philly Eagles', 'Philadelphia'],
        'Cowboys': ['Dallas Cowboys', 'Dallas'],
        'Patriots': ['New England Patriots', 'New England', 'Pats'],
        'Packers': ['Green Bay Packers', 'Green Bay'],
        'Steelers': ['Pittsburgh Steelers', 'Pittsburgh'],
        'Dolphins': ['Miami Dolphins', 'Miami'],
        'Jets': ['New York Jets', 'NY Jets'],
        'Giants': ['New York Giants', 'NY Giants'],
        'Broncos': ['Denver Broncos', 'Denver'],
        'Raiders': ['Las Vegas Raiders', 'LV Raiders', 'Oakland Raiders'],
        'Chargers': ['Los Angeles Chargers', 'LA Chargers', 'San Diego Chargers'],
        'Rams': ['Los Angeles Rams', 'LA Rams', 'St Louis Rams'],
        'Bears': ['Chicago Bears', 'Chicago'],
        'Lions': ['Detroit Lions', 'Detroit'],
        'Vikings': ['Minnesota Vikings', 'Minnesota'],
        'Saints': ['New Orleans Saints', 'New Orleans'],
        'Falcons': ['Atlanta Falcons', 'Atlanta'],
        'Panthers': ['Carolina Panthers', 'Carolina'],
        'Buccaneers': ['Tampa Bay Buccaneers', 'Tampa Bay', 'Bucs'],
        'Cardinals': ['Arizona Cardinals', 'Arizona'],
        'Seahawks': ['Seattle Seahawks', 'Seattle'],
        'Commanders': ['Washington Commanders', 'Washington'],
        'Browns': ['Cleveland Browns', 'Cleveland'],
        'Bengals': ['Cincinnati Bengals', 'Cincinnati'],
        'Texans': ['Houston Texans', 'Houston'],
        'Colts': ['Indianapolis Colts', 'Indianapolis', 'Indy Colts'],
        'Jaguars': ['Jacksonville Jaguars', 'Jacksonville', 'Jags'],
        'Titans': ['Tennessee Titans', 'Tennessee'],
        
        // NBA
        'Lakers': ['Los Angeles Lakers', 'LA Lakers'],
        'Warriors': ['Golden State Warriors', 'Golden State', 'GSW'],
        'Celtics': ['Boston Celtics', 'Boston'],
        'Heat': ['Miami Heat'],
        'Bucks': ['Milwaukee Bucks', 'Milwaukee'],
        'Nets': ['Brooklyn Nets', 'Brooklyn'],
        'Knicks': ['New York Knicks', 'NY Knicks'],
        'Sixers': ['Philadelphia 76ers', 'Philadelphia', '76ers'],
        'Suns': ['Phoenix Suns', 'Phoenix'],
        'Mavericks': ['Dallas Mavericks', 'Dallas', 'Mavs'],
        'Nuggets': ['Denver Nuggets', 'Denver'],
        'Clippers': ['Los Angeles Clippers', 'LA Clippers'],
        'Grizzlies': ['Memphis Grizzlies', 'Memphis'],
        'Pelicans': ['New Orleans Pelicans', 'New Orleans'],
        'Thunder': ['Oklahoma City Thunder', 'OKC Thunder', 'Oklahoma City'],
        'Timberwolves': ['Minnesota Timberwolves', 'Minnesota', 'Wolves'],
        'Cavaliers': ['Cleveland Cavaliers', 'Cleveland', 'Cavs'],
        'Rockets': ['Houston Rockets', 'Houston'],
        'Spurs': ['San Antonio Spurs', 'San Antonio'],
        'Jazz': ['Utah Jazz', 'Utah'],
        'Trail Blazers': ['Portland Trail Blazers', 'Portland', 'Blazers'],
        'Kings': ['Sacramento Kings', 'Sacramento'],
        'Hornets': ['Charlotte Hornets', 'Charlotte'],
        'Hawks': ['Atlanta Hawks', 'Atlanta'],
        'Raptors': ['Toronto Raptors', 'Toronto'],
        'Magic': ['Orlando Magic', 'Orlando'],
        'Pistons': ['Detroit Pistons', 'Detroit'],
        'Pacers': ['Indiana Pacers', 'Indiana'],
        'Wizards': ['Washington Wizards', 'Washington'],
    };

    // Tennis player names
    private readonly TENNIS_PLAYERS = [
        'Sinner', 'Djokovic', 'Alcaraz', 'Medvedev', 'Zverev', 'Rublev', 'Ruud',
        'Tsitsipas', 'Fritz', 'Hurkacz', 'De Minaur', 'Tiafoe', 'Paul', 'Shelton',
        'Swiatek', 'Sabalenka', 'Gauff', 'Rybakina', 'Pegula', 'Zheng', 'Jabeur',
        'Darderi', 'Berrettini', 'Musetti', 'Arnaldi', 'Sonego', 'Cobolli',
    ];

    constructor(private cacheService: CacheService) {
        this.httpClient = axios.create({
            timeout: 10000,
            headers: {
                'User-Agent': 'PredictMax/1.0',
            },
        });
    }

    /**
     * Detect if a market is about a live sports event
     */
    async detectLiveSportsEvent(market: { question: string; category?: string }): Promise<LiveSportsEvent | null> {
        try {
            // Parse market question
            const parsed = this.parseMarketQuestion(market.question);
            
            if (!parsed) {
                this.logger.debug(`No sports event detected in: ${market.question.slice(0, 50)}...`);
                return null;
            }

            this.logger.log(`Detected potential sports event: ${parsed.sport} - ${parsed.teams.join(' vs ')}`);

            // Check if event is live
            const liveEvent = await this.checkIfEventIsLive(parsed);
            
            if (liveEvent) {
                this.logger.log(`Found live event: ${liveEvent.event} (${liveEvent.status})`);
            }

            return liveEvent;
        } catch (error) {
            this.logger.error(`Error detecting live sports event:`, error);
            return null;
        }
    }

    /**
     * Parse market question to extract sports info
     */
    private parseMarketQuestion(question: string): ParsedMarketInfo | null {
        const questionLower = question.toLowerCase();

        // NFL patterns
        if (this.containsSport(questionLower, ['nfl', 'football', 'super bowl', 'touchdown', 'quarterback'])) {
            const teams = this.extractTeams(question, 'nfl');
            if (teams.length >= 2) {
                return { sport: 'NFL', sportCode: 'nfl', teams, league: 'NFL', rawQuestion: question };
            }
        }

        // NBA patterns
        if (this.containsSport(questionLower, ['nba', 'basketball', 'lakers', 'warriors', 'celtics'])) {
            const teams = this.extractTeams(question, 'nba');
            if (teams.length >= 2) {
                return { sport: 'NBA', sportCode: 'nba', teams, league: 'NBA', rawQuestion: question };
            }
        }

        // Tennis patterns
        if (this.containsSport(questionLower, ['tennis', 'atp', 'wta', 'grand slam', 'wimbledon', 'us open', 'french open', 'australian open'])) {
            const players = this.extractTennisPlayers(question);
            if (players.length >= 2) {
                return { 
                    sport: 'Tennis', 
                    sportCode: 'tennis', 
                    teams: players, 
                    players, 
                    league: questionLower.includes('wta') ? 'WTA' : 'ATP',
                    rawQuestion: question 
                };
            }
        }

        // MLB patterns
        if (this.containsSport(questionLower, ['mlb', 'baseball', 'world series', 'home run'])) {
            const teams = this.extractTeams(question, 'mlb');
            if (teams.length >= 2) {
                return { sport: 'MLB', sportCode: 'mlb', teams, league: 'MLB', rawQuestion: question };
            }
        }

        // NHL patterns
        if (this.containsSport(questionLower, ['nhl', 'hockey', 'stanley cup'])) {
            const teams = this.extractTeams(question, 'nhl');
            if (teams.length >= 2) {
                return { sport: 'NHL', sportCode: 'nhl', teams, league: 'NHL', rawQuestion: question };
            }
        }

        // Soccer patterns
        if (this.containsSport(questionLower, ['soccer', 'premier league', 'epl', 'mls', 'champions league', 'world cup'])) {
            return { sport: 'Soccer', sportCode: 'epl', teams: [], league: 'EPL', rawQuestion: question };
        }

        // UFC/MMA patterns
        if (this.containsSport(questionLower, ['ufc', 'mma', 'fight', 'knockout', 'submission'])) {
            return { sport: 'UFC', sportCode: 'ufc', teams: [], league: 'UFC', rawQuestion: question };
        }

        return null;
    }

    private containsSport(text: string, keywords: string[]): boolean {
        return keywords.some(kw => text.includes(kw));
    }

    private extractTeams(question: string, sport: string): string[] {
        const teams: string[] = [];
        
        // Look for team names in the question
        for (const [team, aliases] of Object.entries(this.TEAM_ALIASES)) {
            const allNames = [team, ...aliases];
            for (const name of allNames) {
                if (question.toLowerCase().includes(name.toLowerCase())) {
                    if (!teams.includes(team)) {
                        teams.push(team);
                    }
                    break;
                }
            }
        }

        // Also try to extract from "X vs Y" or "X v Y" patterns
        const vsMatch = question.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:vs\.?|v\.?|@)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
        if (vsMatch) {
            const team1 = this.normalizeTeamName(vsMatch[1]);
            const team2 = this.normalizeTeamName(vsMatch[2]);
            if (team1 && !teams.includes(team1)) teams.push(team1);
            if (team2 && !teams.includes(team2)) teams.push(team2);
        }

        return teams.slice(0, 2);
    }

    private extractTennisPlayers(question: string): string[] {
        const players: string[] = [];
        
        for (const player of this.TENNIS_PLAYERS) {
            if (question.toLowerCase().includes(player.toLowerCase())) {
                players.push(player);
            }
        }

        return players.slice(0, 2);
    }

    private normalizeTeamName(name: string): string | null {
        const nameLower = name.toLowerCase().trim();
        
        for (const [team, aliases] of Object.entries(this.TEAM_ALIASES)) {
            if (team.toLowerCase() === nameLower || 
                aliases.some(a => a.toLowerCase() === nameLower)) {
                return team;
            }
        }
        
        return name;
    }

    /**
     * Check if the event is currently live using ESPN API
     */
    private async checkIfEventIsLive(parsed: ParsedMarketInfo): Promise<LiveSportsEvent | null> {
        const endpoint = this.ESPN_ENDPOINTS[parsed.sportCode];
        
        if (!endpoint) {
            this.logger.debug(`No ESPN endpoint for sport: ${parsed.sportCode}`);
            return null;
        }

        // Check cache first
        const cacheKey = `espn_${parsed.sportCode}_scoreboard`;
        
        try {
            const data = await this.cacheService.wrap(
                cacheKey,
                60, // Cache for 1 minute
                async () => {
                    this.logger.debug(`Fetching ESPN scoreboard for ${parsed.sport}`);
                    const response = await this.httpClient.get(endpoint);
                    return response.data;
                }
            );

            if (!data?.events) {
                return null;
            }

            // Search for matching game
            for (const game of data.events) {
                const isMatch = this.isMatchingGame(game, parsed);
                
                if (isMatch) {
                    const status = game.status?.type?.state; // 'pre', 'in', 'post'
                    const statusDetail = game.status?.type?.detail;
                    
                    // Get team info
                    const homeTeam = game.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'home');
                    const awayTeam = game.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'away');
                    
                    // Determine event status
                    let eventStatus: 'LIVE' | 'UPCOMING' | 'FINAL';
                    
                    if (status === 'in') {
                        eventStatus = 'LIVE';
                    } else if (status === 'post') {
                        eventStatus = 'FINAL';
                    } else {
                        // Check if upcoming within 3 hours
                        const gameTime = new Date(game.date);
                        const now = new Date();
                        const hoursUntil = (gameTime.getTime() - now.getTime()) / (1000 * 60 * 60);
                        
                        if (hoursUntil > 0 && hoursUntil < 3) {
                            eventStatus = 'UPCOMING';
                        } else {
                            // Not live or upcoming soon
                            continue;
                        }
                    }

                    return {
                        isLive: eventStatus === 'LIVE',
                        sport: parsed.sport,
                        sportCode: parsed.sportCode,
                        teams: [
                            awayTeam?.team?.displayName || parsed.teams[0],
                            homeTeam?.team?.displayName || parsed.teams[1],
                        ],
                        league: parsed.league,
                        event: game.name || `${awayTeam?.team?.displayName} @ ${homeTeam?.team?.displayName}`,
                        startTime: game.date,
                        status: eventStatus,
                        gameId: game.id,
                        score: eventStatus !== 'UPCOMING' ? {
                            away: parseInt(awayTeam?.score || '0'),
                            home: parseInt(homeTeam?.score || '0'),
                            period: game.status?.period?.toString(),
                            clock: game.status?.displayClock,
                        } : undefined,
                        venue: game.competitions?.[0]?.venue?.fullName,
                        broadcast: game.competitions?.[0]?.broadcasts?.[0]?.names || [],
                    };
                }
            }

            return null;
        } catch (error) {
            this.logger.error(`ESPN API error for ${parsed.sport}:`, error);
            return null;
        }
    }

    private isMatchingGame(game: any, parsed: ParsedMarketInfo): boolean {
        const homeTeam = game.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'home')?.team;
        const awayTeam = game.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'away')?.team;
        
        if (!homeTeam || !awayTeam) return false;

        const homeNames = [
            homeTeam.displayName?.toLowerCase(),
            homeTeam.shortDisplayName?.toLowerCase(),
            homeTeam.abbreviation?.toLowerCase(),
            homeTeam.name?.toLowerCase(),
        ].filter(Boolean);

        const awayNames = [
            awayTeam.displayName?.toLowerCase(),
            awayTeam.shortDisplayName?.toLowerCase(),
            awayTeam.abbreviation?.toLowerCase(),
            awayTeam.name?.toLowerCase(),
        ].filter(Boolean);

        // Check if parsed teams match the game
        for (const team of parsed.teams) {
            const teamLower = team.toLowerCase();
            const matchesHome = homeNames.some(n => n.includes(teamLower) || teamLower.includes(n));
            const matchesAway = awayNames.some(n => n.includes(teamLower) || teamLower.includes(n));
            
            if (matchesHome || matchesAway) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get all live games for a sport
     */
    async getLiveGames(sportCode: string): Promise<LiveSportsEvent[]> {
        const endpoint = this.ESPN_ENDPOINTS[sportCode];
        
        if (!endpoint) {
            return [];
        }

        try {
            const response = await this.httpClient.get(endpoint);
            const data = response.data;
            
            if (!data?.events) {
                return [];
            }

            const liveGames: LiveSportsEvent[] = [];

            for (const game of data.events) {
                const status = game.status?.type?.state;
                
                if (status === 'in') {
                    const homeTeam = game.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'home');
                    const awayTeam = game.competitions?.[0]?.competitors?.find((c: any) => c.homeAway === 'away');

                    liveGames.push({
                        isLive: true,
                        sport: sportCode.toUpperCase(),
                        sportCode,
                        teams: [awayTeam?.team?.displayName, homeTeam?.team?.displayName],
                        league: sportCode.toUpperCase(),
                        event: game.name,
                        startTime: game.date,
                        status: 'LIVE',
                        gameId: game.id,
                        score: {
                            away: parseInt(awayTeam?.score || '0'),
                            home: parseInt(homeTeam?.score || '0'),
                            period: game.status?.period?.toString(),
                            clock: game.status?.displayClock,
                        },
                        venue: game.competitions?.[0]?.venue?.fullName,
                        broadcast: game.competitions?.[0]?.broadcasts?.[0]?.names || [],
                    });
                }
            }

            return liveGames;
        } catch (error) {
            this.logger.error(`Error fetching live ${sportCode} games:`, error);
            return [];
        }
    }
}
