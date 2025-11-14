import Keyv from 'keyv';
import { ICacheAdapter, CacheStats, CacheError, CacheErrorCode } from '../core/interfaces';

export interface KeyvAdapterOptions {
  uri?: string;
  namespace?: string;
  ttl?: number;
  store?: any;
  serialize?: (value: any) => string;
  deserialize?: (value: string) => any;
  [key: string]: any;
}

/**
 * Adapter that wraps the Keyv library
 * Supports Redis, MongoDB, PostgreSQL, and other Keyv stores
 */
export class KeyvAdapter implements ICacheAdapter {
  private readonly keyv: Keyv;
  private hits: number = 0;
  private misses: number = 0;
  private readonly startTime: number;

  constructor(options: KeyvAdapterOptions = {}) {
    try {
      this.keyv = new Keyv(options);
      this.startTime = Date.now();

      // Handle Keyv errors
      this.keyv.on('error', (err) => {
        console.error('Keyv connection error:', err);
      });
    } catch (error) {
      throw new CacheError(
        'Failed to initialize KeyvAdapter',
        CacheErrorCode.ADAPTER_ERROR,
        error as Error,
      );
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.keyv.get(key);

      if (value === undefined) {
        this.misses++;
        return null;
      }

      this.hits++;
      return value as T;
    } catch (error) {
      throw new CacheError(
        `Failed to get key: ${key}`,
        CacheErrorCode.CONNECTION_ERROR,
        error as Error,
      );
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      // Keyv expects TTL in milliseconds
      const ttlMs = ttl ? ttl * 1000 : undefined;
      await this.keyv.set(key, value, ttlMs);
    } catch (error) {
      throw new CacheError(
        `Failed to set key: ${key}`,
        CacheErrorCode.CONNECTION_ERROR,
        error as Error,
      );
    }
  }

  async delete(key: string | string[]): Promise<void> {
    try {
      if (Array.isArray(key)) {
        await Promise.all(key.map((k) => this.keyv.delete(k)));
      } else {
        await this.keyv.delete(key);
      }
    } catch (error) {
      throw new CacheError(
        `Failed to delete key(s)`,
        CacheErrorCode.CONNECTION_ERROR,
        error as Error,
      );
    }
  }

  async clear(pattern?: string): Promise<void> {
    try {
      if (pattern) {
        // Get all keys matching pattern and delete them
        const keys = await this.keys(pattern);
        if (keys.length > 0) {
          await this.delete(keys);
        }
      } else {
        await this.keyv.clear();
      }
    } catch (error) {
      throw new CacheError(
        'Failed to clear cache',
        CacheErrorCode.CONNECTION_ERROR,
        error as Error,
      );
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const value = await this.keyv.get(key);
      return value !== undefined;
    } catch (error) {
      throw new CacheError(
        `Failed to check key: ${key}`,
        CacheErrorCode.CONNECTION_ERROR,
        error as Error,
      );
    }
  }

  async mget<T>(keys: string[]): Promise<Map<string, T>> {
    try {
      const results = new Map<string, T>();

      // Keyv doesn't have native mget, so we use Promise.all
      const values = await Promise.all(
        keys.map(async (key) => {
          const value = await this.get<T>(key);
          return { key, value };
        }),
      );

      values.forEach(({ key, value }) => {
        if (value !== null) {
          results.set(key, value);
        }
      });

      return results;
    } catch (error) {
      throw new CacheError(
        'Failed to get multiple keys',
        CacheErrorCode.CONNECTION_ERROR,
        error as Error,
      );
    }
  }

  async mset<T>(entries: Map<string, T>, ttl?: number): Promise<void> {
    try {
      const promises: Promise<void>[] = [];

      entries.forEach((value, key) => {
        promises.push(this.set(key, value, ttl));
      });

      await Promise.all(promises);
    } catch (error) {
      throw new CacheError(
        'Failed to set multiple keys',
        CacheErrorCode.CONNECTION_ERROR,
        error as Error,
      );
    }
  }

  async keys(_pattern?: string): Promise<string[]> {
    try {
      // Keyv doesn't have a native keys() method
      // This is a limitation - some stores may not support this
      // For production, consider using Redis SCAN or similar
      console.warn('keys() operation may not be efficient with all Keyv stores');

      // Return empty array if not supported
      return [];
    } catch (error) {
      throw new CacheError(
        'Failed to get keys',
        CacheErrorCode.CONNECTION_ERROR,
        error as Error,
      );
    }
  }

  async stats(): Promise<CacheStats> {
    return {
      hits: this.hits,
      misses: this.misses,
      keys: -1, // Not available without scanning all keys
      memory: -1, // Not available
      uptime: Date.now() - this.startTime,
    };
  }

  /**
   * Disconnect from the store
   */
  async disconnect(): Promise<void> {
    try {
      await this.keyv.disconnect();
    } catch (error) {
      console.error('Error disconnecting from Keyv:', error);
    }
  }
}
