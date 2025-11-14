import 'reflect-metadata';
import { TurboCacheOptions } from './types';
import { getCacheManager } from './cache-manager-accessor';
import { defaultKeyGenerator } from '../utils/key-generator';

/**
 * @TurboCache decorator
 * Automatically caches method results
 * 
 * @example
 * ```typescript
 * @TurboCache({ key: 'user:#{id}', ttl: 3600 })
 * async getUser(id: string): Promise<User> {
 *   return this.userRepo.findById(id);
 * }
 * ```
 */
export function TurboCache(options: TurboCacheOptions = {}): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      throw new Error('@TurboCache can only be applied to methods');
    }

    descriptor.value = async function (...args: any[]) {
      try {
        const cacheManager = getCacheManager(this);

        // Generate cache key
        const cacheKey = defaultKeyGenerator.generate(options.key, args, propertyKey);

        // Try to get from cache
        const cached = await cacheManager.get(cacheKey);
        if (cached !== null) {
          // Cache hit - add metadata if requested
          if (options.includeMetadata) {
            return addCacheMetadata(cached, {
              hit: true,
              key: cacheKey,
              timestamp: Date.now(),
            }, options.metadataKey);
          }
          return cached;
        }

        // Execute original method
        const result = await originalMethod.apply(this, args);

        // Check conditions
        const shouldCache = checkCachingConditions(result, args, options);

        if (shouldCache) {
          // Store in cache (don't await to avoid slowing down response)
          cacheManager.set(cacheKey, result, options.ttl).catch((err) => {
            console.error('Failed to cache result:', err);
          });
        }

        // Cache miss - add metadata if requested
        if (options.includeMetadata) {
          return addCacheMetadata(result, {
            hit: false,
            key: cacheKey,
            timestamp: Date.now(),
          }, options.metadataKey);
        }

        return result;
      } catch (error) {
        // Handle fallback
        if (options.fallback !== undefined) {
          return typeof options.fallback === 'function'
            ? options.fallback(error as Error)
            : options.fallback;
        }
        throw error;
      }
    };

    // Store metadata for debugging
    Reflect.defineMetadata('turbocache:options', options, target, propertyKey);

    return descriptor;
  };
}

/**
 * Check if result should be cached based on conditions
 */
function checkCachingConditions(result: any, args: any[], options: TurboCacheOptions): boolean {
  // Check 'unless' condition (skip if true)
  if (options.unless && options.unless(result, ...args)) {
    return false;
  }

  // Check 'condition' (cache only if true)
  if (options.condition && !options.condition(result, ...args)) {
    return false;
  }

  return true;
}

/**
 * Add cache metadata to result
 */
function addCacheMetadata(
  result: any,
  metadata: { hit: boolean; key: string; timestamp: number },
  metadataKey: string = '__cache__',
): any {
  // For objects and arrays, add metadata property
  if (result !== null && typeof result === 'object') {
    // Clone to avoid mutating cached object
    if (Array.isArray(result)) {
      return Object.assign([...result], { [metadataKey]: metadata });
    }
    return { ...result, [metadataKey]: metadata };
  }

  // For primitives, wrap in object
  return {
    value: result,
    [metadataKey]: metadata,
  };
}
