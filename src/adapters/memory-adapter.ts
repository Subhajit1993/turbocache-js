import { ICacheAdapter, CacheStats } from '../core/interfaces';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface MemoryAdapterOptions {
  max?: number; // Maximum number of items
  maxSize?: number; // Maximum memory size in bytes
}

/**
 * In-memory cache adapter using Map
 * Fast, simple, perfect for development and testing
 */
export class MemoryAdapter implements ICacheAdapter {
  private readonly cache: Map<string, CacheEntry<any>>;
  private readonly options: MemoryAdapterOptions;
  private hits: number = 0;
  private misses: number = 0;
  private readonly startTime: number;

  constructor(options: MemoryAdapterOptions = {}) {
    this.cache = new Map();
    this.options = {
      max: options.max || 1000,
      maxSize: options.maxSize,
    };
    this.startTime = Date.now();

    // Cleanup expired entries periodically
    setInterval(() => this.cleanup(), 60000); // Every minute
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Enforce max items limit
    if (this.options.max && this.cache.size >= this.options.max && !this.cache.has(key)) {
      // Evict oldest entry (LRU)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const expiresAt = ttl ? Date.now() + ttl * 1000 : 0;

    this.cache.set(key, {
      value,
      expiresAt,
    });
  }

  async delete(key: string | string[]): Promise<void> {
    if (Array.isArray(key)) {
      key.forEach((k) => this.cache.delete(k));
    } else {
      this.cache.delete(key);
    }
  }

  async clear(pattern?: string): Promise<void> {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    // Simple pattern matching (* wildcard)
    const regex = this.patternToRegex(pattern);
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    // Check if expired
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  async mget<T>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();

    for (const key of keys) {
      const value = await this.get<T>(key);
      if (value !== null) {
        results.set(key, value);
      }
    }

    return results;
  }

  async mset<T>(entries: Map<string, T>, ttl?: number): Promise<void> {
    const promises: Promise<void>[] = [];

    entries.forEach((value, key) => {
      promises.push(this.set(key, value, ttl));
    });

    await Promise.all(promises);
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.cache.keys());

    if (!pattern) {
      return allKeys;
    }

    const regex = this.patternToRegex(pattern);
    return allKeys.filter((key) => regex.test(key));
  }

  async stats(): Promise<CacheStats> {
    // Clean up expired entries before calculating stats
    this.cleanup();

    return {
      hits: this.hits,
      misses: this.misses,
      keys: this.cache.size,
      memory: this.estimateMemoryUsage(),
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Estimate memory usage (rough approximation)
   */
  private estimateMemoryUsage(): number {
    let size = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Key size
      size += key.length * 2; // 2 bytes per character (UTF-16)

      // Value size (rough estimate)
      const valueStr = JSON.stringify(entry.value);
      size += valueStr.length * 2;

      // Entry overhead
      size += 16; // Approximate overhead per entry
    }

    return size;
  }

  /**
   * Convert glob pattern to regex
   */
  private patternToRegex(pattern: string): RegExp {
    // Escape special regex characters except *
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    // Replace * with .*
    const regexStr = escaped.replace(/\*/g, '.*');
    return new RegExp(`^${regexStr}$`);
  }
}
