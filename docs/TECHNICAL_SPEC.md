# TurboCache-JS Technical Specification

## 1. System Requirements

### 1.1 Runtime Requirements
- Node.js >= 18.x
- TypeScript >= 5.x
- NestJS >= 10.x (optional)

### 1.2 Storage Requirements
- Redis >= 6.x (recommended)
- PostgreSQL >= 12.x (optional)
- MongoDB >= 5.x (optional)

### 1.3 Development Requirements
- Jest >= 29.x
- ESLint >= 8.x
- Prettier >= 3.x

---

## 2. Core Interfaces Specification

### 2.1 ICacheAdapter

```typescript
interface ICacheAdapter {
  /**
   * Retrieve value by key
   * @returns null if key doesn't exist
   */
  get<T>(key: string): Promise<T | null>;
  
  /**
   * Store value with optional TTL
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

interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  memory: number;
  uptime: number;
}
```

### 2.2 CacheManager

```typescript
class CacheManager {
  constructor(
    private adapter: ICacheAdapter,
    private config: CacheConfig
  ) {}
  
  async get<T>(
    key: string,
    options?: GetOptions
  ): Promise<T | null>;
  
  async set<T>(
    key: string,
    value: T,
    options?: SetOptions
  ): Promise<void>;
  
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options?: SetOptions
  ): Promise<T>;
  
  async delete(key: string | string[]): Promise<void>;
  
  async clear(pattern?: string): Promise<void>;
  
  async wrap<T>(
    key: string,
    factory: () => Promise<T>,
    options?: WrapOptions
  ): Promise<T>;
}

interface GetOptions {
  deserialize?: boolean;
}

interface SetOptions {
  ttl?: number;
  serialize?: boolean;
}

interface WrapOptions extends SetOptions {
  condition?: (value: T) => boolean;
  fallback?: T | (() => T);
}
```

---

## 3. Decorator Implementation

### 3.1 @TurboCache Decorator

```typescript
interface TurboCacheOptions {
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
   * Cache namespace
   */
  namespace?: string;
  
  /**
   * Condition to cache result
   * @param result - Method return value
   */
  condition?: (result: any, ...args: any[]) => boolean;
  
  /**
   * Skip caching if condition is true
   */
  unless?: (result: any, ...args: any[]) => boolean;
  
  /**
   * Enable stampede lock
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
}

function TurboCache(options: TurboCacheOptions = {}): MethodDecorator {
  return function (
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const metadataKey = `cache:${String(propertyKey)}`;
    
    descriptor.value = async function (...args: any[]) {
      const cacheManager = getCacheManager(this);
      const key = generateKey(options.key, args, propertyKey);
      
      try {
        // Try cache first
        const cached = await cacheManager.get(key);
        if (cached !== null) {
          return cached;
        }
        
        // Execute with stampede protection if enabled
        if (options.stampedeLock) {
          return await executeWithLock(
            cacheManager,
            key,
            () => originalMethod.apply(this, args),
            options
          );
        }
        
        // Normal execution
        const result = await originalMethod.apply(this, args);
        
        // Check conditions
        if (shouldCache(result, args, options)) {
          await cacheManager.set(key, result, options.ttl);
        }
        
        return result;
      } catch (error) {
        if (options.fallback) {
          return typeof options.fallback === 'function'
            ? options.fallback(error)
            : options.fallback;
        }
        throw error;
      }
    };
    
    // Store metadata
    Reflect.defineMetadata(metadataKey, options, target);
    
    return descriptor;
  };
}
```

### 3.2 Key Generation Engine

```typescript
class KeyGenerator {
  /**
   * Generate cache key from expression and arguments
   */
  generate(
    pattern: string | undefined,
    args: any[],
    methodName: string | symbol
  ): string {
    if (!pattern) {
      return this.defaultKey(methodName, args);
    }
    
    return this.parseExpression(pattern, args);
  }
  
  private parseExpression(pattern: string, args: any[]): string {
    return pattern.replace(/#\{([^}]+)\}/g, (match, expr) => {
      return this.evaluateExpression(expr, args);
    });
  }
  
  private evaluateExpression(expr: string, args: any[]): string {
    // Handle simple cases: #{0}, #{1} for positional args
    if (/^\d+$/.test(expr)) {
      const index = parseInt(expr);
      return String(args[index] ?? '');
    }
    
    // Handle property access: #{user.id}, #{data.name}
    if (expr.includes('.')) {
      const [param, ...props] = expr.split('.');
      const index = parseInt(param) || 0;
      let value = args[index];
      
      for (const prop of props) {
        value = value?.[prop];
      }
      
      return String(value ?? '');
    }
    
    // Handle named parameters (requires metadata)
    const paramName = expr;
    const paramIndex = this.getParameterIndex(paramName);
    return String(args[paramIndex] ?? '');
  }
  
  private defaultKey(methodName: string | symbol, args: any[]): string {
    const argsHash = this.hashArgs(args);
    return `${String(methodName)}:${argsHash}`;
  }
  
  private hashArgs(args: any[]): string {
    const str = JSON.stringify(args);
    return createHash('md5').update(str).digest('hex');
  }
}
```

---

## 4. Storage Backend Abstraction

### 4.1 Configuration Interface

```typescript
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

### 4.2 Adapter Factory (Internal)

```typescript
// This is internal - consumers never call this directly
function createAdapter(store: StoreConfig): ICacheAdapter {
  if (store.type === 'multi-tier') {
    return createMultiTierAdapter(store);
  }
  return createSingleTierAdapter(store);
}

function createSingleTierAdapter(store: StoreConfig): ICacheAdapter {
  const backend = store.primary!;
  
  switch (backend.type) {
    case 'redis':
      // Uses Keyv internally
      return new KeyvAdapter({
        uri: backend.uri,
        ...backend.options
      });
    
    case 'memory':
      return new MemoryAdapter(backend.options);
    
    case 'mongodb':
      // Uses Keyv with MongoDB store
      return new KeyvAdapter({
        uri: backend.uri,
        store: 'mongodb',
        ...backend.options
      });
    
    case 'postgresql':
      // Uses Keyv with PostgreSQL store
      return new KeyvAdapter({
        uri: backend.uri,
        store: 'postgresql',
        ...backend.options
      });
    
    default:
      throw new Error(`Unsupported storage type: ${backend.type}`);
  }
}
```

### 4.3 KeyvAdapter (Internal Implementation)

```typescript
import Keyv from 'keyv';

// Internal adapter - consumers never instantiate this
class KeyvAdapter implements ICacheAdapter {
  private keyv: Keyv;
  
  constructor(options: KeyvAdapterOptions) {
    this.keyv = new Keyv({
      uri: options.uri,
      namespace: options.namespace,
      ttl: options.ttl,
      serialize: options.serialize || JSON.stringify,
      deserialize: options.deserialize || JSON.parse
    });
  }
  
  async get<T>(key: string): Promise<T | null> {
    const value = await this.keyv.get(key);
    return value ?? null;
  }
  
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    await this.keyv.set(key, value, ttl ? ttl * 1000 : undefined);
  }
  
  async delete(key: string | string[]): Promise<void> {
    if (Array.isArray(key)) {
      await Promise.all(key.map(k => this.keyv.delete(k)));
    } else {
      await this.keyv.delete(key);
    }
  }
  
  async clear(pattern?: string): Promise<void> {
    if (pattern) {
      const keys = await this.keys(pattern);
      await this.delete(keys);
    } else {
      await this.keyv.clear();
    }
  }
  
  async has(key: string): Promise<boolean> {
    const value = await this.keyv.get(key);
    return value !== undefined;
  }
  
  async mget<T>(keys: string[]): Promise<Map<string, T>> {
    const results = await Promise.all(
      keys.map(async key => ({ key, value: await this.get<T>(key) }))
    );
    
    return new Map(
      results
        .filter(r => r.value !== null)
        .map(r => [r.key, r.value!])
    );
  }
  
  async mset<T>(entries: Map<string, T>, ttl?: number): Promise<void> {
    await Promise.all(
      Array.from(entries).map(([key, value]) =>
        this.set(key, value, ttl)
      )
    );
  }
  
  async keys(pattern?: string): Promise<string[]> {
    // Implementation depends on backend
    // For Redis, use SCAN
    throw new Error('Not implemented');
  }
  
  async stats(): Promise<CacheStats> {
    // Implementation depends on backend
    throw new Error('Not implemented');
  }
}
```

### 4.4 MultiTierAdapter (Internal Implementation)

```typescript
// Internal - created automatically from multi-tier config
class MultiTierAdapter implements ICacheAdapter {
  private l1: ICacheAdapter; // Fast local cache (memory)
  private l2: ICacheAdapter; // Slower distributed cache (Redis)
  private l1TTL: number;
  private l2TTL: number;
  
  constructor(options: MultiTierOptions) {
    this.l1 = options.l1;
    this.l2 = options.l2;
    this.l1TTL = options.l1TTL || 300;
    this.l2TTL = options.l2TTL || 3600;
  }
  
  async get<T>(key: string): Promise<T | null> {
    // Try L1 first
    let value = await this.l1.get<T>(key);
    if (value !== null) {
      return value;
    }
    
    // Try L2
    value = await this.l2.get<T>(key);
    if (value !== null) {
      // Backfill L1
      await this.l1.set(key, value, this.l1TTL).catch(() => {});
    }
    
    return value;
  }
  
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Write to both tiers
    await Promise.all([
      this.l1.set(key, value, ttl || this.l1TTL),
      this.l2.set(key, value, ttl || this.l2TTL)
    ]);
  }
  
  async delete(key: string | string[]): Promise<void> {
    // Delete from both tiers
    await Promise.all([
      this.l1.delete(key),
      this.l2.delete(key)
    ]);
  }
  
  async clear(pattern?: string): Promise<void> {
    await Promise.all([
      this.l1.clear(pattern),
      this.l2.clear(pattern)
    ]);
  }
  
  // ... implement other methods
}
```

---

## 5. NestJS Module Implementation

```typescript
@Module({})
export class TurboCacheModule {
  static register(config: CacheConfig): DynamicModule {
    const providers = this.createProviders(config);
    
    return {
      module: TurboCacheModule,
      providers,
      exports: providers,
      global: true
    };
  }
  
  static registerAsync(
    options: CacheModuleAsyncOptions
  ): DynamicModule {
    return {
      module: TurboCacheModule,
      imports: options.imports || [],
      providers: [
        ...this.createAsyncProviders(options),
        ...(options.extraProviders || [])
      ],
      exports: ['CACHE_MANAGER'],
      global: true
    };
  }
  
  private static createProviders(config: CacheConfig): Provider[] {
    return [
      {
        provide: 'CACHE_CONFIG',
        useValue: config
      },
      {
        provide: 'CACHE_ADAPTER',
        useFactory: (config: CacheConfig) => {
          return this.createAdapter(config.stores[0]);
        },
        inject: ['CACHE_CONFIG']
      },
      {
        provide: 'CACHE_MANAGER',
        useFactory: (adapter: ICacheAdapter, config: CacheConfig) => {
          return new CacheManager(adapter, config);
        },
        inject: ['CACHE_ADAPTER', 'CACHE_CONFIG']
      }
    ];
  }
  
  private static createAdapter(store: StoreConfig): ICacheAdapter {
    // Use the abstracted factory from section 4.2
    return createAdapter(store);
  }
}

// Decorator for injection
export function InjectCache(name: string = 'default'): ParameterDecorator {
  return Inject(`CACHE_MANAGER_${name}`);
}
```

---

## 6. Performance Specifications

### 6.1 Latency Targets
- Memory adapter: <1ms (P99)
- Redis adapter: <5ms (P99)
- Multi-tier (L1 hit): <1ms (P99)
- Multi-tier (L2 hit): <5ms (P99)

### 6.2 Throughput Targets
- Memory adapter: 1M ops/sec
- Redis adapter: 100K ops/sec
- Multi-tier: 500K ops/sec

### 6.3 Memory Limits
- Memory adapter: Configurable max (default 100MB)
- Per-cache overhead: <10MB
- Metadata overhead: <1KB per cached item

---

## 7. Error Handling

```typescript
class CacheError extends Error {
  constructor(
    message: string,
    public readonly code: CacheErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'CacheError';
  }
}

enum CacheErrorCode {
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  SERIALIZATION_ERROR = 'SERIALIZATION_ERROR',
  TIMEOUT = 'TIMEOUT',
  KEY_TOO_LONG = 'KEY_TOO_LONG',
  VALUE_TOO_LARGE = 'VALUE_TOO_LARGE'
}

// Error handling in decorators
try {
  // cache operation
} catch (error) {
  if (options.fallback) {
    return handleFallback(options.fallback, error);
  }
  
  if (options.failSilently) {
    logger.error('Cache error', error);
    return originalMethod.apply(this, args);
  }
  
  throw new CacheError('Cache operation failed', code, error);
}
```

---

## 8. Testing Requirements

### 8.1 Unit Tests
- Coverage: >90%
- All public methods tested
- Edge cases covered
- Error scenarios tested

### 8.2 Integration Tests
- Test with real Redis
- Test with real databases
- Test NestJS integration
- Test decorator behavior

### 8.3 Performance Tests
- Benchmark all adapters
- Measure latency distribution
- Load testing
- Memory leak detection

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Status**: Draft
