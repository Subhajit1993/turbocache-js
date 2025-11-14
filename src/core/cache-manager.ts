import {
  ICacheAdapter,
  CacheConfig,
  GetOptions,
  WrapOptions,
  CacheStats,
} from './interfaces';

/**
 * Main cache orchestrator - handles all caching operations
 * This is the primary interface consumers interact with
 */
export class CacheManager {
  private readonly adapter: ICacheAdapter;
  private readonly namespace: string;
  private readonly defaultTTL: number;
  private readonly enableMetrics: boolean;

  constructor(adapter: ICacheAdapter, config: CacheConfig) {
    this.adapter = adapter;
    this.namespace = config.namespace || '';
    this.defaultTTL = config.defaultTTL || 3600;
    this.enableMetrics = config.enableMetrics ?? false;
  }

  /**
   * Retrieve cached value by key
   */
  async get<T>(key: string, _options?: GetOptions): Promise<T | null> {
    const fullKey = this.buildKey(key);
    return this.adapter.get<T>(fullKey);
  }

  /**
   * Store value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const fullKey = this.buildKey(key);
    const effectiveTTL = ttl ?? this.defaultTTL;
    return this.adapter.set(fullKey, value, effectiveTTL);
  }

  /**
   * Delete cached value(s)
   */
  async delete(key: string | string[]): Promise<void> {
    if (Array.isArray(key)) {
      const fullKeys = key.map((k) => this.buildKey(k));
      return this.adapter.delete(fullKeys);
    }
    const fullKey = this.buildKey(key);
    return this.adapter.delete(fullKey);
  }

  /**
   * Clear cache entries matching pattern
   */
  async clear(pattern?: string): Promise<void> {
    const fullPattern = pattern ? this.buildKey(pattern) : undefined;
    return this.adapter.clear(fullPattern);
  }

  /**
   * Check if key exists in cache
   */
  async has(key: string): Promise<boolean> {
    const fullKey = this.buildKey(key);
    return this.adapter.has(fullKey);
  }

  /**
   * Get multiple values at once (batch operation)
   */
  async mget<T>(keys: string[]): Promise<Map<string, T>> {
    const fullKeys = keys.map((k) => this.buildKey(k));
    const results = await this.adapter.mget<T>(fullKeys);

    // Convert back to original keys (remove namespace)
    const normalized = new Map<string, T>();
    results.forEach((value, fullKey) => {
      const originalKey = this.removeNamespace(fullKey);
      normalized.set(originalKey, value);
    });

    return normalized;
  }

  /**
   * Set multiple values at once (batch operation)
   */
  async mset<T>(entries: Map<string, T>, ttl?: number): Promise<void> {
    const fullEntries = new Map<string, T>();
    entries.forEach((value, key) => {
      fullEntries.set(this.buildKey(key), value);
    });

    const effectiveTTL = ttl ?? this.defaultTTL;
    return this.adapter.mset(fullEntries, effectiveTTL);
  }

  /**
   * Get value from cache or compute it if not found
   * @param key - Cache key
   * @param factory - Function to compute value if not cached
   * @param options - Cache options
   */
  async wrap<T>(
    key: string,
    factory: () => Promise<T>,
    options?: WrapOptions,
  ): Promise<T> {
    // Try to get from cache
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    try {
      // Execute factory function
      const value = await factory();

      // Check condition if provided
      const shouldCache = !options?.condition || options.condition(value);

      if (shouldCache) {
        await this.set(key, value, options?.ttl);
      }

      return value;
    } catch (error) {
      // Handle fallback
      if (options?.fallback !== undefined) {
        return typeof options.fallback === 'function'
          ? options.fallback()
          : options.fallback;
      }
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  async stats(): Promise<CacheStats> {
    return this.adapter.stats();
  }

  /**
   * Get all keys matching pattern
   */
  async keys(pattern?: string): Promise<string[]> {
    const fullPattern = pattern ? this.buildKey(pattern) : undefined;
    const fullKeys = await this.adapter.keys(fullPattern);

    // Remove namespace from keys
    return fullKeys.map((key) => this.removeNamespace(key));
  }

  /**
   * Build full key with namespace
   */
  private buildKey(key: string): string {
    return this.namespace ? `${this.namespace}:${key}` : key;
  }

  /**
   * Remove namespace from key
   */
  private removeNamespace(fullKey: string): string {
    if (!this.namespace) {
      return fullKey;
    }
    const prefix = `${this.namespace}:`;
    return fullKey.startsWith(prefix) ? fullKey.slice(prefix.length) : fullKey;
  }
}
