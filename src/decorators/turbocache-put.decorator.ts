import 'reflect-metadata';
import { TurboCachePutOptions } from './types';
import { getCacheManager } from './cache-manager-accessor';
import { KeyGenerator } from '../utils/key-generator';

/**
 * @TurboCachePut decorator
 * Updates cache without preventing method execution
 * Useful for create/update operations where you want to cache the result
 * 
 * @example
 * ```typescript
 * @TurboCachePut({ key: 'user:#{result.id}' })
 * async createUser(data: CreateDto): Promise<User> {
 *   return this.userRepo.create(data);
 * }
 * ```
 */
export function TurboCachePut(options: TurboCachePutOptions): MethodDecorator {
  if (!options.key) {
    throw new Error('@TurboCachePut requires a "key" option');
  }

  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    if (typeof originalMethod !== 'function') {
      throw new Error('@TurboCachePut can only be applied to methods');
    }

    descriptor.value = async function (...args: any[]) {
      const cacheManager = getCacheManager(this);

      try {
        // Execute original method
        const result = await originalMethod.apply(this, args);

        // Check condition
        if (options.condition && !options.condition(result, ...args)) {
          return result;
        }

        // Generate key (may include #{result.xxx} expressions)
        const cacheKey = generateKeyWithResult(options.key, args, result, propertyKey);

        // Update cache (async, don't block response)
        cacheManager.set(cacheKey, result, options.ttl).catch((err) => {
          console.error('Failed to update cache:', err);
        });

        return result;
      } catch (error) {
        // Don't cache on error
        throw error;
      }
    };

    // Store metadata
    Reflect.defineMetadata('turbocache:put-options', options, target, propertyKey);

    return descriptor;
  };
}

/**
 * Generate cache key that may include result properties
 * Handles expressions like #{result.id}, #{result.name}
 */
function generateKeyWithResult(
  pattern: string,
  args: any[],
  result: any,
  methodName: string | symbol,
): string {
  const keyGen = new KeyGenerator();

  // Replace #{result.xxx} expressions
  let processedPattern = pattern.replace(/#\{result\.([^}]+)\}/g, (match, prop) => {
    const value = getNestedProperty(result, prop);
    return String(value ?? '');
  });

  // Replace #{result} with the entire result
  processedPattern = processedPattern.replace(/#\{result\}/g, String(result ?? ''));

  // Generate final key with remaining expressions
  return keyGen.generate(processedPattern, args, methodName);
}

/**
 * Get nested property from object
 * Example: getNestedProperty(user, 'address.city')
 */
function getNestedProperty(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}
