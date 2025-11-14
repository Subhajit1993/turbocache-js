/**
 * Options for @TurboCache decorator
 */
export interface TurboCacheOptions {
  /**
   * Cache key pattern with #{param} expressions
   * @example 'user:#{id}' or 'search:#{query}:#{page}'
   */
  key?: string;

  /**
   * Time to live in seconds
   * @default 3600
   */
  ttl?: number;

  /**
   * Cache store name (if using multiple stores)
   * @default 'default'
   */
  store?: string;

  /**
   * Cache namespace
   */
  namespace?: string;

  /**
   * Condition to cache result
   * @param result - Method return value
   * @param args - Method arguments
   */
  condition?: (result: any, ...args: any[]) => boolean;

  /**
   * Skip caching if condition is true
   * @param result - Method return value
   * @param args - Method arguments
   */
  unless?: (result: any, ...args: any[]) => boolean;

  /**
   * Enable stampede lock to prevent multiple simultaneous cache updates
   * @default false
   */
  stampedeLock?: boolean;

  /**
   * Stampede lock TTL in seconds
   * @default 30
   */
  stampedeTTL?: number;

  /**
   * Fallback value on error
   */
  fallback?: any | ((error: Error) => any);

  /**
   * Add cache metadata to response
   * Adds __cache__ flag: { hit: boolean, key: string, timestamp: number }
   * @default false
   */
  includeMetadata?: boolean;

  /**
   * Custom metadata key name
   * @default '__cache__'
   */
  metadataKey?: string;
}

/**
 * Options for @TurboCacheEvict decorator
 */
export interface TurboCacheEvictOptions {
  /**
   * Cache key pattern to evict
   */
  key?: string;

  /**
   * Evict all entries in namespace
   * @default false
   */
  allEntries?: boolean;

  /**
   * Evict before method invocation
   * @default false (evict after)
   */
  beforeInvocation?: boolean;

  /**
   * Cache store name
   * @default 'default'
   */
  store?: string;

  /**
   * Cache namespace
   */
  namespace?: string;

  /**
   * Condition to evict cache
   * @param result - Method return value (not available if beforeInvocation=true)
   * @param args - Method arguments
   */
  condition?: (result: any, ...args: any[]) => boolean;
}

/**
 * Options for @TurboCachePut decorator
 */
export interface TurboCachePutOptions {
  /**
   * Cache key pattern
   * Can use #{result.id} to reference return value properties
   */
  key: string;

  /**
   * Time to live in seconds
   */
  ttl?: number;

  /**
   * Cache store name
   * @default 'default'
   */
  store?: string;

  /**
   * Cache namespace
   */
  namespace?: string;

  /**
   * Condition to update cache
   * @param result - Method return value
   * @param args - Method arguments
   */
  condition?: (result: any, ...args: any[]) => boolean;
}
