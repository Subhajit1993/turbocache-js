import { CacheManager } from '../core/cache-manager';

/**
 * Symbol to store cache manager on class instances
 */
export const CACHE_MANAGER_KEY = Symbol('__turbocache_manager__');

/**
 * Global cache manager (fallback when not using NestJS)
 */
let globalCacheManager: CacheManager | null = null;

/**
 * Set global cache manager
 */
export function setGlobalCacheManager(manager: CacheManager): void {
  globalCacheManager = manager;
}

/**
 * Get global cache manager
 */
export function getGlobalCacheManager(): CacheManager | null {
  return globalCacheManager;
}

/**
 * Get cache manager from instance or global
 */
export function getCacheManager(instance: any): CacheManager {
  // Try to get from instance property (injected by NestJS)
  if (instance.cacheManager) {
    return instance.cacheManager;
  }

  // Try to get from symbol property
  if (instance[CACHE_MANAGER_KEY]) {
    return instance[CACHE_MANAGER_KEY];
  }

  // Fallback to global
  if (globalCacheManager) {
    return globalCacheManager;
  }

  throw new Error(
    'CacheManager not found. Either inject CacheManager in your class constructor, ' +
      'or call setGlobalCacheManager() before using decorators.',
  );
}

/**
 * Set cache manager on instance
 */
export function setCacheManager(instance: any, manager: CacheManager): void {
  instance[CACHE_MANAGER_KEY] = manager;
}
