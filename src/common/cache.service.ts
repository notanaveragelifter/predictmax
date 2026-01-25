import { Injectable, Logger } from '@nestjs/common';

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

@Injectable()
export class CacheService {
    private readonly logger = new Logger(CacheService.name);
    private cache = new Map<string, CacheEntry<any>>();
    private cleanupInterval: NodeJS.Timeout;

    constructor() {
        // Cleanup expired entries every 5 minutes
        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }

    /**
     * Get cached value
     */
    get<T>(key: string): T | null {
        const entry = this.cache.get(key);

        if (!entry) {
            return null;
        }

        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    /**
     * Set cached value with TTL in seconds
     */
    set<T>(key: string, data: T, ttlSeconds: number): void {
        const expiresAt = Date.now() + (ttlSeconds * 1000);
        this.cache.set(key, { data, expiresAt });
    }

    /**
     * Delete cached value
     */
    delete(key: string): void {
        this.cache.delete(key);
    }

    /**
     * Clear all cache
     */
    clear(): void {
        this.cache.clear();
        this.logger.log('Cache cleared');
    }

    /**
     * Get cache stats
     */
    getStats() {
        const now = Date.now();
        let expired = 0;
        let valid = 0;

        for (const entry of this.cache.values()) {
            if (now > entry.expiresAt) {
                expired++;
            } else {
                valid++;
            }
        }

        return {
            total: this.cache.size,
            valid,
            expired,
        };
    }

    /**
     * Cleanup expired entries
     */
    private cleanup(): void {
        const now = Date.now();
        let removed = 0;

        for (const [key, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(key);
                removed++;
            }
        }

        if (removed > 0) {
            this.logger.debug(`Cleaned up ${removed} expired cache entries`);
        }
    }

    /**
     * Cleanup on module destroy
     */
    onModuleDestroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }

    /**
     * Wrap a function with caching
     */
    async wrap<T>(
        key: string,
        ttlSeconds: number,
        fn: () => Promise<T>
    ): Promise<T> {
        const cached = this.get<T>(key);
        if (cached !== null) {
            return cached;
        }

        const result = await fn();
        this.set(key, result, ttlSeconds);
        return result;
    }
}
