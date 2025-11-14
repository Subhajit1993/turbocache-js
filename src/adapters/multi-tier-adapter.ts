import { ICacheAdapter, CacheStats } from '../core/interfaces';

export interface MultiTierOptions {
  l1: ICacheAdapter; // Fast local cache (usually memory)
  l2: ICacheAdapter; // Slower distributed cache (usually Redis)
  l1TTL?: number; // TTL for L1 in seconds
  l2TTL?: number; // TTL for L2 in seconds
}

/**
 * Multi-tier cache adapter
 * Implements L1 (memory) + L2 (distributed) caching pattern
 * 
 * Read flow:
 * 1. Check L1 (fast) - return if found
 * 2. Check L2 (distributed) - backfill L1 if found
 * 3. Return null if not found
 * 
 * Write flow:
 * 1. Write to both L1 and L2 simultaneously
 */
export class MultiTierAdapter implements ICacheAdapter {
  private readonly l1: ICacheAdapter;
  private readonly l2: ICacheAdapter;
  private readonly l1TTL: number;
  private readonly l2TTL: number;

  constructor(options: MultiTierOptions) {
    this.l1 = options.l1;
    this.l2 = options.l2;
    this.l1TTL = options.l1TTL || 300; // 5 minutes default for L1
    this.l2TTL = options.l2TTL || 3600; // 1 hour default for L2
  }

  /**
   * Get value from cache
   * Try L1 first, then L2, backfill L1 if found in L2
   */
  async get<T>(key: string): Promise<T | null> {
    // Try L1 first (fast path)
    const l1Value = await this.l1.get<T>(key);
    if (l1Value !== null) {
      return l1Value;
    }

    // Try L2 (slower path)
    const l2Value = await this.l2.get<T>(key);
    if (l2Value !== null) {
      // Backfill L1 asynchronously (don't wait for it)
      this.l1.set(key, l2Value, this.l1TTL).catch((err) => {
        console.error('Failed to backfill L1 cache:', err);
      });
      return l2Value;
    }

    return null;
  }

  /**
   * Set value in both tiers
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Write to both tiers in parallel
    await Promise.all([
      this.l1.set(key, value, ttl || this.l1TTL),
      this.l2.set(key, value, ttl || this.l2TTL),
    ]);
  }

  /**
   * Delete from both tiers
   */
  async delete(key: string | string[]): Promise<void> {
    await Promise.all([this.l1.delete(key), this.l2.delete(key)]);
  }

  /**
   * Clear both tiers
   */
  async clear(pattern?: string): Promise<void> {
    await Promise.all([this.l1.clear(pattern), this.l2.clear(pattern)]);
  }

  /**
   * Check if key exists in either tier
   */
  async has(key: string): Promise<boolean> {
    const l1Has = await this.l1.has(key);
    if (l1Has) {
      return true;
    }
    return this.l2.has(key);
  }

  /**
   * Get multiple values
   * Try L1 first, then fetch missing from L2
   */
  async mget<T>(keys: string[]): Promise<Map<string, T>> {
    // Get from L1
    const l1Results = await this.l1.mget<T>(keys);

    // Find missing keys
    const missingKeys = keys.filter((key) => !l1Results.has(key));

    if (missingKeys.length === 0) {
      return l1Results;
    }

    // Fetch missing from L2
    const l2Results = await this.l2.mget<T>(missingKeys);

    // Backfill L1 with L2 results (async, don't wait)
    if (l2Results.size > 0) {
      this.l1.mset(l2Results, this.l1TTL).catch((err) => {
        console.error('Failed to backfill L1 cache:', err);
      });
    }

    // Merge results
    const combined = new Map(l1Results);
    l2Results.forEach((value, key) => {
      combined.set(key, value);
    });

    return combined;
  }

  /**
   * Set multiple values in both tiers
   */
  async mset<T>(entries: Map<string, T>, ttl?: number): Promise<void> {
    await Promise.all([
      this.l1.mset(entries, ttl || this.l1TTL),
      this.l2.mset(entries, ttl || this.l2TTL),
    ]);
  }

  /**
   * Get keys matching pattern
   * Use L2 as source of truth for keys
   */
  async keys(pattern?: string): Promise<string[]> {
    return this.l2.keys(pattern);
  }

  /**
   * Get combined statistics from both tiers
   */
  async stats(): Promise<CacheStats> {
    const [l1Stats, l2Stats] = await Promise.all([this.l1.stats(), this.l2.stats()]);

    return {
      hits: l1Stats.hits + l2Stats.hits,
      misses: Math.max(l1Stats.misses, l2Stats.misses), // Avoid double counting
      keys: l2Stats.keys, // L2 is source of truth
      memory: l1Stats.memory + (l2Stats.memory > 0 ? l2Stats.memory : 0),
      uptime: Math.min(l1Stats.uptime, l2Stats.uptime),
    };
  }
}
