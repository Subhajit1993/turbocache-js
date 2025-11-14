/**
 * Core cache adapter interface that all storage backends must implement
 */
export interface ICacheAdapter {
  /**
   * Retrieve value by key
   * @returns null if key doesn't exist
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Store value with optional TTL
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in seconds
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Delete one or more keys
   */
  delete(key: string | string[]): Promise<void>;

  /**
   * Clear all keys or keys matching pattern
   */
  clear(pattern?: string): Promise<void>;

  /**
   * Check if key exists
   */
  has(key: string): Promise<boolean>;

  /**
   * Get multiple values at once
   */
  mget<T>(keys: string[]): Promise<Map<string, T>>;

  /**
   * Set multiple values at once
   */
  mset<T>(entries: Map<string, T>, ttl?: number): Promise<void>;

  /**
   * Get all keys matching pattern
   */
  keys(pattern?: string): Promise<string[]>;

  /**
   * Get cache statistics
   */
  stats(): Promise<CacheStats>;
}

/**
 * Cache statistics interface
 */
export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  memory: number;
  uptime: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  stores: StoreConfig[];
  namespace?: string;
  defaultTTL?: number;
  enableMetrics?: boolean;
  compression?: CompressionConfig;
  logging?: LoggingConfig;
}

/**
 * Store configuration
 */
export interface StoreConfig {
  name: string;
  type: 'redis' | 'memory' | 'mongodb' | 'postgresql' | 'multi-tier';
  primary?: StorageBackend;
  secondary?: StorageBackend;
  ttl?: number;
}

/**
 * Storage backend configuration
 */
export interface StorageBackend {
  type: 'redis' | 'memory' | 'mongodb' | 'postgresql' | 's3';
  uri?: string;
  options?: Record<string, any>;
  ttl?: number;
}

/**
 * Compression configuration
 */
export interface CompressionConfig {
  enabled: boolean;
  threshold?: number; // bytes
  algorithm?: 'gzip' | 'brotli' | 'lz4';
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  includeKeys?: boolean;
  format?: 'json' | 'text';
}

/**
 * Options for get operation
 */
export interface GetOptions {
  deserialize?: boolean;
}

/**
 * Options for set operation
 */
export interface SetOptions {
  ttl?: number;
  serialize?: boolean;
}

/**
 * Options for wrap operation
 */
export interface WrapOptions extends SetOptions {
  condition?: (value: any) => boolean;
  fallback?: any | (() => any);
}

/**
 * Serializer interface
 */
export interface ISerializer {
  serialize(value: any): string | Buffer;
  deserialize<T>(data: string | Buffer): T;
}

/**
 * Key generator interface
 */
export interface IKeyGenerator {
  generate(pattern: string | undefined, args: any[], methodName: string | symbol): string;
}

/**
 * Cache error codes
 */
export enum CacheErrorCode {
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR',
  TIMEOUT = 'TIMEOUT',
  KEY_TOO_LONG = 'KEY_TOO_LONG',
  VALUE_TOO_LARGE = 'VALUE_TOO_LARGE',
  ADAPTER_ERROR = 'ADAPTER_ERROR',
}

/**
 * Custom cache error class
 */
export class CacheError extends Error {
  constructor(
    message: string,
    public readonly code: CacheErrorCode,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'CacheError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
