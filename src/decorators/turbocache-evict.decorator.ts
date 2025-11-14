import 'reflect-metadata';
import { TurboCacheEvictOptions } from './types';
import { getCacheManager } from './cache-manager-accessor';
import { defaultKeyGenerator } from '../utils/key-generator';

/**
 * @TurboCacheEvict decorator
 * Invalidates cache entries when method is called
 * 
 * @example
 * ```typescript
 * @TurboCacheEvict({ key: 'user:#{id}' })
 * async updateUser(id: string, data: UpdateDto): Promise<User> {
 *   return this.userRepo.update(id, data);
 * }
 * ```
 */
export function TurboCacheEvict(options: TurboCacheEvictOptions = {}): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      throw new Error('@TurboCacheEvict can only be applied to methods');
    }

    descriptor.value = async function (...args: any[]) {
      const cacheManager = getCacheManager(this);

      // Evict before invocation if specified
      if (options.beforeInvocation) {
        await evictCache(cacheManager, null, args, options, propertyKey);
      }

      try {
        // Execute original method
        const result = await originalMethod.apply(this, args);

        // Evict after invocation (default)
        if (!options.beforeInvocation) {
          await evictCache(cacheManager, result, args, options, propertyKey);
        }

        return result;
      } catch (error) {
        // If before invocation, don't evict on error
        if (options.beforeInvocation) {
          throw error;
        }

        // Optionally still evict on error for after invocation
        // For now, we don't evict on error
        throw error;
      }
    };

    // Store metadata
    Reflect.defineMetadata('turbocache:evict-options', options, target, propertyKey);

    return descriptor;
  };
}

/**
 * Evict cache based on options
 */
async function evictCache(
  cacheManager: any,
  result: any,
  args: any[],
  options: TurboCacheEvictOptions,
  propertyKey: string | symbol,
): Promise<void> {
  // Check condition
  if (options.condition && !options.condition(result, ...args)) {
    return;
  }

  // Evict all entries in namespace
  if (options.allEntries) {
    await cacheManager.clear(options.namespace);
    return;
  }

  // Evict specific key
  if (options.key) {
    const cacheKey = defaultKeyGenerator.generate(options.key, args, propertyKey);
    await cacheManager.delete(cacheKey);
  }
}
