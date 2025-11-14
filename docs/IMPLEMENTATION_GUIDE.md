# TurboCache-JS Implementation Guide

## Quick Start Implementation

### Step 1: Project Setup

```bash
npm init -y
npm install --save keyv cacheable @nestjs/common @nestjs/core reflect-metadata rxjs
npm install --save-dev typescript @types/node
```

### Step 2: Core Interfaces

Create `src/core/interfaces.ts`:

```typescript
export interface ICacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  mget<T>(keys: string[]): Promise<Map<string, T>>;
  mset<T>(entries: Map<string, T>, ttl?: number): Promise<void>;
}

export interface CacheOptions {
  key?: string;
  ttl?: number;
  namespace?: string;
  condition?: (result: any) => boolean;
}

export interface CacheConfig {
  stores: StoreConfig[];
  defaultTTL?: number;
  enableMetrics?: boolean;
}

export interface StoreConfig {
  name: string;
  type: 'redis' | 'memory' | 'mongodb' | 'postgresql' | 'multi-tier';
  primary?: StorageBackend;
  secondary?: StorageBackend;
  ttl?: number;
}

export interface StorageBackend {
  type: 'redis' | 'memory' | 'mongodb' | 'postgresql' | 's3';
  uri?: string;
  options?: Record<string, any>;
  ttl?: number;
}
```

### Step 3: Implement CacheManager

```typescript
// src/core/cache-manager.ts
export class CacheManager {
  private adapter: ICacheAdapter;
  private defaultTTL: number;
  
  constructor(adapter: ICacheAdapter, config: CacheConfig) {
    this.adapter = adapter;
    this.defaultTTL = config.defaultTTL || 3600;
  }
  
  async get<T>(key: string): Promise<T | null> {
    return this.adapter.get<T>(key);
  }
  
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    return this.adapter.set(key, value, ttl || this.defaultTTL);
  }
  
  async delete(key: string): Promise<void> {
    return this.adapter.delete(key);
  }
}
```

### Step 4: Create @TurboCache Decorator

```typescript
// src/decorators/turbocache.decorator.ts
import { CacheOptions } from '../core/interfaces';

export function TurboCache(options: CacheOptions = {}): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const cacheManager = this.cacheManager || globalCacheManager;
      const key = generateCacheKey(options.key, args, propertyKey);
      
      // Try to get from cache
      const cached = await cacheManager.get(key);
      if (cached !== null) {
        return cached;
      }
      
      // Execute original method
      const result = await originalMethod.apply(this, args);
      
      // Check condition
      if (!options.condition || options.condition(result)) {
        await cacheManager.set(key, result, options.ttl);
      }
      
      return result;
    };
    
    return descriptor;
  };
}

function generateCacheKey(
  pattern: string | undefined,
  args: any[],
  methodName: string | symbol
): string {
  if (!pattern) {
    return `${String(methodName)}:${JSON.stringify(args)}`;
  }
  
  // Parse #{param} expressions
  return pattern.replace(/#\{(\w+)\}/g, (_, param) => {
    // Simple implementation
    return args[0]?.[param] || args[0] || '';
  });
}
```

### Step 5: NestJS Module

```typescript
// src/modules/turbocache.module.ts
import { DynamicModule, Module, Provider } from '@nestjs/common';
import { CacheManager } from '../core/cache-manager';
import { CacheConfig } from '../core/interfaces';

@Module({})
export class TurboCacheModule {
  static register(config: CacheConfig): DynamicModule {
    const cacheProvider: Provider = {
      provide: 'CACHE_MANAGER',
      useFactory: () => {
        const adapter = createAdapter(config.stores[0]);
        return new CacheManager(adapter, config);
      },
    };
    
    return {
      module: TurboCacheModule,
      providers: [cacheProvider],
      exports: [cacheProvider],
      global: true,
    };
  }
}

function createAdapter(store: StoreConfig): ICacheAdapter {
  // Factory to create adapters based on storage type
  // Internally uses Keyv or Cacheable - consumers don't need to know
  
  if (store.type === 'multi-tier') {
    return createMultiTierAdapter(store);
  }
  
  // For single-tier, use Keyv as the underlying implementation
  return createSingleTierAdapter(store);
}

function createSingleTierAdapter(store: StoreConfig): ICacheAdapter {
  const backend = store.primary!;
  
  switch (backend.type) {
    case 'redis':
      return new KeyvAdapter({
        uri: backend.uri,
        ...backend.options
      });
    case 'memory':
      return new MemoryAdapter(backend.options);
    case 'mongodb':
      return new KeyvAdapter({
        uri: backend.uri,
        store: 'mongodb',
        ...backend.options
      });
    case 'postgresql':
      return new KeyvAdapter({
        uri: backend.uri,
        store: 'postgresql',
        ...backend.options
      });
    default:
      throw new Error(`Unsupported storage type: ${backend.type}`);
  }
}

function createMultiTierAdapter(store: StoreConfig): ICacheAdapter {
  const l1 = createSingleTierAdapter({
    name: 'l1',
    type: store.primary!.type,
    primary: store.primary,
    ttl: store.primary!.ttl
  });
  
  const l2 = createSingleTierAdapter({
    name: 'l2',
    type: store.secondary!.type,
    primary: store.secondary,
    ttl: store.secondary!.ttl
  });
  
  return new MultiTierAdapter({ l1, l2 });
}
```

## Implementation Priority

### Week 1-2: Core Foundation
1. Setup TypeScript project structure
2. Implement core interfaces
3. Create basic CacheManager
4. Implement KeyvAdapter
5. Write unit tests

### Week 3-4: Decorators
1. @TurboCache decorator
2. Key generation logic
3. @TurboCacheEvict decorator
4. @TurboCachePut decorator
5. Integration tests

### Week 5-6: Advanced Features
1. Multi-tier adapter
2. TTL strategies
3. Compression support
4. Performance benchmarks

### Week 7-8: NestJS Integration
1. Module system
2. Dependency injection
3. Interceptors
4. Examples

## Testing Approach

```typescript
describe('CacheManager', () => {
  let cacheManager: CacheManager;
  
  beforeEach(() => {
    const adapter = new MemoryAdapter();
    cacheManager = new CacheManager(adapter, { stores: [] });
  });
  
  it('should cache values', async () => {
    await cacheManager.set('key', 'value');
    const result = await cacheManager.get('key');
    expect(result).toBe('value');
  });
});
```

## Best Practices

1. **Always use TypeScript strict mode**
2. **Write tests first (TDD)**
3. **Keep adapters stateless**
4. **Use dependency injection**
5. **Document public APIs**
6. **Benchmark performance**
7. **Monitor memory usage**
