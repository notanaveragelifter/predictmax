/**
 * YouTube Live Stream Finder Service
 * 
 * Finds live YouTube streams for sports events.
 * Uses YouTube Data API v3 to search for live broadcasts.
 */

import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { ConfigService } from '../config/config.service';
import { CacheService } from '../common/cache.service';
import { LiveSportsEvent } from './sports-event-detector.service';

export interface YouTubeStream {
    videoId: string;
    title: string;
    channelName: string;
    channelId: string;
    thumbnail: string;
    embedUrl: string;
    watchUrl: string;
    isLive: boolean;
    viewerCount: number;
    startTime?: string;
    description?: string;
}

interface YouTubeSearchResult {
    id: { videoId: string };
    snippet: {
        title: string;
        channelTitle: string;
        channelId: string;
        description: string;
        thumbnails: {
            default: { url: string };
            medium: { url: string };
            high: { url: string };
        };
        liveBroadcastContent: 'live' | 'upcoming' | 'none';
        publishedAt: string;
    };
}

@Injectable()
export class YouTubeStreamFinderService {
    private readonly logger = new Logger(YouTubeStreamFinderService.name);
    private readonly httpClient: AxiosInstance;
    private readonly apiKey: string | null;

    // Official sports channels to prioritize
    private readonly OFFICIAL_CHANNELS: Record<string, string[]> = {
        nfl: ['NFL', 'ESPN', 'FOX Sports', 'CBS Sports', 'NBC Sports', 'Amazon Prime Video'],
        nba: ['NBA', 'ESPN', 'TNT Sports', 'NBA TV'],
        mlb: ['MLB', 'ESPN', 'FOX Sports', 'TBS'],
        nhl: ['NHL', 'ESPN', 'TNT Sports'],
        tennis: ['ATP Tennis TV', 'WTA', 'Tennis Channel', 'ESPN'],
        ufc: ['UFC', 'ESPN MMA', 'UFC Fight Pass'],
        soccer: ['ESPN FC', 'FOX Soccer', 'NBC Sports Soccer', 'CBS Sports Golazo'],
    };

    // Channel IDs for verified official sources
    private readonly VERIFIED_CHANNEL_IDS: Record<string, string> = {
        'NFL': 'UCDVYQ4Zhbm3S2dlz7P1GBDg',
        'NBA': 'UCWJ2lWNubArHWmf3FIHbfcQ',
        'ESPN': 'UCiWLfSweyRNmLpgEHekhoAg',
        'FOX Sports': 'UCvYwtimI-UqKqxpLRR6DM_w',
    };

    constructor(
        private configService: ConfigService,
        private cacheService: CacheService,
    ) {
        this.apiKey = this.configService.youtubeApiKey || null;
        
        this.httpClient = axios.create({
            baseURL: 'https://www.googleapis.com/youtube/v3',
            timeout: 10000,
        });

        if (!this.apiKey) {
            this.logger.warn('YouTube API key not configured. Live stream detection will be disabled.');
        }
    }

    /**
     * Find live YouTube stream for a sports event
     */
    async findLiveStream(event: LiveSportsEvent): Promise<YouTubeStream | null> {
        if (!this.apiKey) {
            this.logger.debug('YouTube API key not configured, skipping stream search');
            return null;
        }

        try {
            // Build search query
            const searchQuery = this.buildSearchQuery(event);
            this.logger.log(`Searching YouTube for: "${searchQuery}"`);

            // Search for live streams
            const liveResults = await this.searchYouTube(searchQuery, 'live');
            
            if (liveResults.length > 0) {
                const bestMatch = this.selectBestStream(liveResults, event);
                if (bestMatch) {
                    return await this.enrichStreamDetails(bestMatch);
                }
            }

            // Fallback: search for recent uploads
            this.logger.debug('No live streams found, searching recent uploads');
            const recentResults = await this.searchYouTube(searchQuery, 'none');
            
            if (recentResults.length > 0) {
                const recentStream = await this.findRecentStream(recentResults);
                if (recentStream) {
                    return recentStream;
                }
            }

            return null;
        } catch (error) {
            this.logger.error('Error finding YouTube stream:', error);
            return null;
        }
    }

    /**
     * Build an optimized search query for the event
     */
    private buildSearchQuery(event: LiveSportsEvent): string {
        const { sport, sportCode, teams, league, event: eventName } = event;
        
        let query = '';

        // Team-based sports
        if (teams.length >= 2) {
            query = `${teams[0]} vs ${teams[1]} live`;
        } else if (eventName) {
            query = `${eventName} live`;
        }

        // Add sport/league context
        if (league && !query.toLowerCase().includes(league.toLowerCase())) {
            query += ` ${league}`;
        }

        // Add official channel keywords for better results
        const officialChannels = this.OFFICIAL_CHANNELS[sportCode];
        if (officialChannels?.length) {
            // Add first official channel to query
            query += ` ${officialChannels[0]}`;
        }

        return query.trim();
    }

    /**
     * Search YouTube for videos
     */
    private async searchYouTube(
        query: string, 
        eventType: 'live' | 'upcoming' | 'none' | 'completed'
    ): Promise<YouTubeSearchResult[]> {
        const cacheKey = `youtube_search_${query}_${eventType}`.replace(/\s+/g, '_');
        
        return this.cacheService.wrap(
            cacheKey,
            120, // Cache for 2 minutes
            async () => {
                const params: Record<string, any> = {
                    part: 'snippet',
                    q: query,
                    type: 'video',
                    maxResults: 10,
                    key: this.apiKey,
                    relevanceLanguage: 'en',
                    safeSearch: 'strict',
                    order: eventType === 'live' ? 'relevance' : 'date',
                };

                // Only add eventType if searching for live streams
                if (eventType === 'live') {
                    params.eventType = 'live';
                }

                try {
                    const response = await this.httpClient.get('/search', { params });
                    return response.data.items || [];
                } catch (error: any) {
                    if (error.response?.status === 403) {
                        this.logger.error('YouTube API quota exceeded or invalid API key');
                    }
                    throw error;
                }
            }
        );
    }

    /**
     * Select the best stream from search results
     */
    private selectBestStream(videos: YouTubeSearchResult[], event: LiveSportsEvent): YouTubeSearchResult | null {
        if (videos.length === 0) return null;

        const officialChannels = this.OFFICIAL_CHANNELS[event.sportCode] || [];
        
        // Score each video
        const scored = videos.map(video => {
            let score = 0;
            const titleLower = video.snippet.title.toLowerCase();
            const channelName = video.snippet.channelTitle;

            // Official channel bonus (highest priority)
            if (officialChannels.some(ch => channelName.toLowerCase().includes(ch.toLowerCase()))) {
                score += 100;
            }

            // Verified channel ID match
            if (Object.values(this.VERIFIED_CHANNEL_IDS).includes(video.snippet.channelId)) {
                score += 80;
            }

            // Team name match in title
            const teamsInTitle = event.teams.filter(team => 
                titleLower.includes(team.toLowerCase())
            ).length;
            score += teamsInTitle * 30;

            // Both teams mentioned
            if (teamsInTitle >= 2) {
                score += 40;
            }

            // "Live" in title
            if (titleLower.includes('live')) {
                score += 20;
            }

            // League mention
            if (titleLower.includes(event.league.toLowerCase())) {
                score += 15;
            }

            // Negative signals - likely not official
            if (titleLower.includes('reaction') || titleLower.includes('watch party')) {
                score -= 50;
            }
            if (titleLower.includes('highlights') && !titleLower.includes('live')) {
                score -= 30;
            }

            return { video, score };
        });

        // Sort by score descending
        scored.sort((a, b) => b.score - a.score);

        this.logger.debug(`Best stream scores: ${scored.slice(0, 3).map(s => `${s.video.snippet.title.slice(0, 30)}... (${s.score})`).join(', ')}`);

        // Only return if score is above threshold
        if (scored[0]?.score >= 20) {
            return scored[0].video;
        }

        return null;
    }

    /**
     * Enrich stream with additional details
     */
    private async enrichStreamDetails(video: YouTubeSearchResult): Promise<YouTubeStream> {
        let viewerCount = 0;
        let startTime: string | undefined;

        try {
            // Get video details including live stats
            const response = await this.httpClient.get('/videos', {
                params: {
                    part: 'snippet,liveStreamingDetails,statistics',
                    id: video.id.videoId,
                    key: this.apiKey,
                },
            });

            const details = response.data.items?.[0];
            
            if (details?.liveStreamingDetails) {
                viewerCount = parseInt(details.liveStreamingDetails.concurrentViewers || '0');
                startTime = details.liveStreamingDetails.actualStartTime;
            }
        } catch (error) {
            this.logger.debug('Failed to fetch video details:', error);
        }

        return {
            videoId: video.id.videoId,
            title: video.snippet.title,
            channelName: video.snippet.channelTitle,
            channelId: video.snippet.channelId,
            thumbnail: video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium?.url,
            embedUrl: `https://www.youtube.com/embed/${video.id.videoId}?autoplay=1&mute=1`,
            watchUrl: `https://www.youtube.com/watch?v=${video.id.videoId}`,
            isLive: video.snippet.liveBroadcastContent === 'live',
            viewerCount,
            startTime,
            description: video.snippet.description?.slice(0, 200),
        };
    }

    /**
     * Find recent stream if no live stream available
     */
    private async findRecentStream(videos: YouTubeSearchResult[]): Promise<YouTubeStream | null> {
        const now = new Date();
        const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

        for (const video of videos) {
            const publishedAt = new Date(video.snippet.publishedAt);
            
            // Only consider videos from last 6 hours
            if (publishedAt > sixHoursAgo) {
                this.logger.debug(`Found recent video: ${video.snippet.title}`);
                return await this.enrichStreamDetails(video);
            }
        }

        return null;
    }

    /**
     * Get multiple streams for an event (alternative sources)
     */
    async findAllStreams(event: LiveSportsEvent): Promise<YouTubeStream[]> {
        if (!this.apiKey) {
            return [];
        }

        try {
            const searchQuery = this.buildSearchQuery(event);
            const results = await this.searchYouTube(searchQuery, 'live');
            
            // Enrich top 3 results
            const streams: YouTubeStream[] = [];
            for (const video of results.slice(0, 3)) {
                const stream = await this.enrichStreamDetails(video);
                streams.push(stream);
            }

            return streams;
        } catch (error) {
            this.logger.error('Error finding all streams:', error);
            return [];
        }
    }

    /**
     * Check if a specific video is currently live
     */
    async checkIfVideoIsLive(videoId: string): Promise<boolean> {
        if (!this.apiKey) {
            return false;
        }

        try {
            const response = await this.httpClient.get('/videos', {
                params: {
                    part: 'snippet,liveStreamingDetails',
                    id: videoId,
                    key: this.apiKey,
                },
            });

            const video = response.data.items?.[0];
            return video?.snippet?.liveBroadcastContent === 'live';
        } catch (error) {
            this.logger.error(`Error checking if video ${videoId} is live:`, error);
            return false;
        }
    }
}
