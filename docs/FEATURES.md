# TurboCache-JS Features

Complete feature documentation for TurboCache-JS - a high-performance, intelligent caching library for TypeScript/NestJS applications.

---

## 📋 Table of Contents

- [Implemented Features](#implemented-features)
  - [Decorators](#decorators)
  - [Cache Manager API](#cache-manager-api)
  - [Storage Adapters](#storage-adapters)
  - [NestJS Integration](#nestjs-integration)
  - [Key Generation](#key-generation)
  - [Advanced Features](#advanced-features)
- [Planned Features](#planned-features)

---

## ✅ Implemented Features

### 1. Decorators

#### 1.1 @TurboCache - Automatic Result Caching

Cache method results automatically with flexible configuration.

**Basic Usage:**
```typescript
@Injectable()
export class UserService {
  constructor(
    @Inject('CACHE_MANAGER') private cacheManager: CacheManager
  ) {}

  @TurboCache({ key: 'user:#{0}', ttl: 3600 })
  async getUser(id: string): Promise<User> {
    return this.database.findUserById(id);
  }
}
```

**Options:**
- ✅ `key?: string` - Cache key pattern with `#{param}` expressions
- ✅ `ttl?: number` - Time to live in seconds (default: 3600)
- ✅ `namespace?: string` - Cache namespace for organization
- ✅ `condition?: (result, ...args) => boolean` - Cache only if condition is true
- ✅ `unless?: (result, ...args) => boolean` - Skip caching if condition is true
- ✅ `includeMetadata?: boolean` - Add cache hit/miss metadata to response
- ✅ `metadataKey?: string` - Custom metadata key name (default: `__cache__`)
- ✅ `fallback?: any | ((error: Error) => any)` - Fallback value on error

**Conditional Caching:**
```typescript
@TurboCache({ 
  key: 'user:#{0}',
  condition: (result) => result !== null,
  unless: (result) => result.isTemporary
})
async findUser(id: string): Promise<User | null> {
  return this.database.findUserById(id);
}
```

**With Metadata:**
```typescript
@TurboCache({ 
  key: 'products:all',
  includeMetadata: true,
  metadataKey: '_cache'
})
async getProducts(): Promise<Product[]> {
  return this.database.getAllProducts();
}

// Response includes: { ...data, _cache: { hit: true, key: 'products:all', timestamp: 1234567890 } }
```

**With Fallback:**
```typescript
@TurboCache({ 
  key: 'config:#{0}',
  fallback: (error) => ({ fallback: true, error: error.message })
})
async getConfig(name: string): Promise<Config> {
  return this.remoteConfigService.fetch(name);
}
```

---

#### 1.2 @TurboCacheEvict - Cache Invalidation

Invalidate cache entries when data changes.

**Basic Usage:**
```typescript
@TurboCacheEvict({ key: 'user:#{0}' })
async updateUser(id: string, data: UpdateUserDto): Promise<User> {
  return this.database.updateUser(id, data);
}
```

**Options:**
- ✅ `key?: string` - Cache key pattern to evict
- ✅ `allEntries?: boolean` - Clear all entries in namespace
- ✅ `beforeInvocation?: boolean` - Evict before method execution (default: false)
- ✅ `namespace?: string` - Target namespace
- ✅ `condition?: (result, ...args) => boolean` - Conditional eviction

**Evict All Entries:**
```typescript
@TurboCacheEvict({ allEntries: true, namespace: 'users' })
async clearAllUsers(): Promise<void> {
  this.cache.clear('users:*');
}
```

**Before Invocation:**
```typescript
@TurboCacheEvict({ 
  key: 'user:#{0}',
  beforeInvocation: true 
})
async deleteUser(id: string): Promise<void> {
  await this.database.deleteUser(id);
}
```

**Conditional Eviction:**
```typescript
@TurboCacheEvict({ 
  key: 'user:#{0}',
  condition: (result) => result.success === true
})
async softDeleteUser(id: string): Promise<{ success: boolean }> {
  return this.database.softDelete(id);
}
```

---

#### 1.3 @TurboCachePut - Update Cache

Update cache without preventing method execution. Useful for create/update operations.

**Basic Usage:**
```typescript
@TurboCachePut({ key: 'user:#{result.id}', ttl: 3600 })
async createUser(data: CreateUserDto): Promise<User> {
  return this.database.createUser(data);
}
```

**Options:**
- ✅ `key: string` - Cache key pattern (required, supports `#{result.property}`)
- ✅ `ttl?: number` - Time to live in seconds
- ✅ `namespace?: string` - Cache namespace
- ✅ `condition?: (result, ...args) => boolean` - Conditional update

**With Result Properties:**
```typescript
@TurboCachePut({ 
  key: 'order:#{result.orderId}',
  ttl: 7200,
  condition: (result) => result.status === 'confirmed'
})
async placeOrder(orderData: OrderDto): Promise<Order> {
  return this.orderService.create(orderData);
}
```

---

### 2. Cache Manager API

Direct programmatic cache access for fine-grained control.

#### 2.1 Basic Operations

**Get:**
```typescript
const user = await cacheManager.get<User>('user:123');
```

**Set:**
```typescript
await cacheManager.set('user:123', userData, 3600); // TTL in seconds
```

**Delete:**
```typescript
await cacheManager.delete('user:123');
// Or multiple keys
await cacheManager.delete(['user:1', 'user:2', 'user:3']);
```

**Has:**
```typescript
const exists = await cacheManager.has('user:123');
```

**Clear:**
```typescript
// Clear all
await cacheManager.clear();

// Clear by pattern
await cacheManager.clear('user:*');
```

---

#### 2.2 Batch Operations

**Multi-Get (mget):**
```typescript
const users = await cacheManager.mget<User>(['user:1', 'user:2', 'user:3']);
// Returns: Map<string, User>

users.forEach((user, key) => {
  console.log(`${key}: ${user.name}`);
});
```

**Multi-Set (mset):**
```typescript
const entries = new Map([
  ['user:1', { id: '1', name: 'Alice' }],
  ['user:2', { id: '2', name: 'Bob' }],
  ['user:3', { id: '3', name: 'Charlie' }]
]);

await cacheManager.mset(entries, 3600);
```

---

#### 2.3 Wrap Function

Get from cache or compute if not found (cache-aside pattern).

```typescript
const user = await cacheManager.wrap(
  'user:123',
  async () => {
    // This only executes on cache miss
    return database.findUserById('123');
  },
  {
    ttl: 3600,
    condition: (value) => value !== null,
    fallback: { id: '123', name: 'Guest' }
  }
);
```

---

#### 2.4 Statistics & Introspection

**Get Statistics:**
```typescript
const stats = await cacheManager.stats();
console.log({
  hits: stats.hits,
  misses: stats.misses,
  keys: stats.keys,
  memory: stats.memory,      // bytes
  uptime: stats.uptime       // milliseconds
});
```

**Get Keys:**
```typescript
// All keys
const allKeys = await cacheManager.keys();

// Pattern matching
const userKeys = await cacheManager.keys('user:*');
```

---

### 3. Storage Adapters

TurboCache supports multiple storage backends through a unified adapter interface.

#### 3.1 Memory Adapter

In-memory caching with LRU eviction. Perfect for development and single-instance apps.

**Features:**
- ✅ Fast in-memory storage using `Map`
- ✅ LRU (Least Recently Used) eviction
- ✅ Automatic TTL expiration
- ✅ Pattern-based key matching
- ✅ Memory usage estimation
- ✅ Automatic cleanup of expired entries

**Configuration:**
```typescript
TurboCacheModule.register({
  stores: [{
    name: 'default',
    type: 'memory',
    primary: {
      type: 'memory',
      options: {
        max: 1000,           // Max 1000 items
        maxSize: 10485760    // Max 10MB
      }
    },
    ttl: 3600
  }],
  namespace: 'myapp'
})
```

---

#### 3.2 Keyv Adapter

Universal adapter supporting Redis, MongoDB, PostgreSQL, and other Keyv-compatible stores.

**Features:**
- ✅ Redis support via Keyv
- ✅ MongoDB support via Keyv
- ✅ PostgreSQL support via Keyv
- ✅ Custom serialization/deserialization
- ✅ Connection error handling
- ✅ Statistics tracking

**Redis Example:**
```typescript
TurboCacheModule.register({
  stores: [{
    name: 'default',
    type: 'redis',
    primary: {
      type: 'redis',
      uri: 'redis://localhost:6379',
      options: {
        keyPrefix: 'myapp:'
      }
    },
    ttl: 3600
  }],
  namespace: 'cache'
})
```

**MongoDB Example:**
```typescript
TurboCacheModule.register({
  stores: [{
    name: 'default',
    type: 'mongodb',
    primary: {
      type: 'mongodb',
      uri: 'mongodb://localhost:27017/cache'
    },
    ttl: 3600
  }]
})
```

**PostgreSQL Example:**
```typescript
TurboCacheModule.register({
  stores: [{
    name: 'default',
    type: 'postgresql',
    primary: {
      type: 'postgresql',
      uri: 'postgresql://localhost:5432/cache'
    },
    ttl: 3600
  }]
})
```

---

#### 3.3 Multi-Tier Adapter

L1 (memory) + L2 (distributed) caching for optimal performance.

**Features:**
- ✅ Two-level cache hierarchy
- ✅ L1: Fast in-memory cache (hot data)
- ✅ L2: Distributed cache (cold storage)
- ✅ Automatic L1 backfill on L2 hit
- ✅ Parallel writes to both tiers
- ✅ TTL cascading (different TTLs per tier)

**Flow:**
1. **Read:** Check L1 → Check L2 → Backfill L1 if found in L2
2. **Write:** Write to both L1 and L2 in parallel
3. **Delete:** Delete from both tiers

**Configuration:**
```typescript
TurboCacheModule.register({
  stores: [{
    name: 'default',
    type: 'multi-tier',
    primary: {
      type: 'memory',
      options: { max: 1000 },
      ttl: 300              // L1: 5 minutes
    },
    secondary: {
      type: 'redis',
      uri: 'redis://localhost:6379',
      ttl: 3600             // L2: 1 hour
    }
  }],
  namespace: 'myapp'
})
```

**Use Case:**
```typescript
// First request: Miss L1, Miss L2, fetch from DB, cache in both
const user1 = await service.getUser('123'); // ~100ms

// Second request (same instance): Hit L1
const user2 = await service.getUser('123'); // ~1ms

// Third request (different instance): Miss L1, Hit L2, backfill L1
const user3 = await service.getUser('123'); // ~5ms
```

---

### 4. NestJS Integration

First-class NestJS support with dependency injection.

#### 4.1 Synchronous Registration

```typescript
@Module({
  imports: [
    TurboCacheModule.register({
      stores: [{
        name: 'default',
        type: 'redis',
        primary: {
          type: 'redis',
          uri: 'redis://localhost:6379'
        },
        ttl: 3600
      }],
      namespace: 'myapp',
      enableMetrics: true
    })
  ]
})
export class AppModule {}
```

---

#### 4.2 Asynchronous Registration

Load configuration from ConfigModule or other async sources.

```typescript
@Module({
  imports: [
    TurboCacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        stores: [{
          name: 'default',
          type: 'redis',
          primary: {
            type: 'redis',
            uri: config.get('REDIS_URL')
          },
          ttl: config.get('CACHE_TTL', 3600)
        }],
        namespace: config.get('APP_NAME'),
        enableMetrics: config.get('ENABLE_METRICS', true)
      }),
      inject: [ConfigService]
    })
  ]
})
export class AppModule {}
```

---

#### 4.3 Dependency Injection

**Inject CacheManager:**
```typescript
@Injectable()
export class UserService {
  constructor(
    @Inject('CACHE_MANAGER') private cacheManager: CacheManager
  ) {}

  async getUser(id: string): Promise<User> {
    const cached = await this.cacheManager.get<User>(`user:${id}`);
    if (cached) return cached;

    const user = await this.database.findUserById(id);
    await this.cacheManager.set(`user:${id}`, user, 3600);
    return user;
  }
}
```

**Using Decorators:**
```typescript
@Injectable()
export class ProductService {
  constructor(
    @Inject('CACHE_MANAGER') private cacheManager: CacheManager
  ) {}

  @TurboCache({ key: 'product:#{0}', ttl: 7200 })
  async getProduct(id: string): Promise<Product> {
    return this.database.findProductById(id);
  }

  @TurboCacheEvict({ key: 'product:#{0}' })
  async updateProduct(id: string, data: UpdateDto): Promise<Product> {
    return this.database.updateProduct(id, data);
  }
}
```

---

### 5. Key Generation

Flexible cache key generation with expression syntax.

#### 5.1 Positional Arguments

```typescript
// #{0} = first parameter, #{1} = second parameter, etc.
@TurboCache({ key: 'user:#{0}' })
async getUser(id: string): Promise<User> {}

@TurboCache({ key: 'order:#{0}:#{1}' })
async getOrder(userId: string, orderId: string): Promise<Order> {}
```

---

#### 5.2 Property Access

```typescript
// Access nested properties with dot notation
@TurboCache({ key: 'report:#{0.userId}:#{0.fromDate}:#{0.toDate}' })
async generateReport(params: ReportParams): Promise<Report> {}

// Access second parameter's properties
@TurboCache({ key: 'item:#{0}:#{1.page}:#{1.limit}:#{1.sort}' })
async getItems(businessId: string, filters: FilterDto): Promise<Item[]> {}
```

---

#### 5.3 Result Properties (for @TurboCachePut)

```typescript
// Use #{result.property} to reference return value
@TurboCachePut({ key: 'user:#{result.id}' })
async createUser(data: CreateUserDto): Promise<User> {}

@TurboCachePut({ key: 'order:#{result.orderId}:status' })
async updateOrderStatus(orderId: string, status: string): Promise<Order> {}
```

---

#### 5.4 Auto-Generated Keys

```typescript
// If no key is provided, uses methodName + hash of arguments
@TurboCache()
async getExpensiveData(param1: string, param2: number): Promise<Data> {}
// Key: "getExpensiveData:a1b2c3d4e5f6g7h8"
```

---

### 6. Advanced Features

#### 6.1 Namespace Support

Organize cache entries into logical groups.

```typescript
TurboCacheModule.register({
  stores: [{ /* ... */ }],
  namespace: 'myapp'  // All keys prefixed with 'myapp:'
})

// Keys automatically namespaced:
await cache.set('user:123', data);  // Stored as 'myapp:user:123'
await cache.get('user:123');        // Looks up 'myapp:user:123'
```

**Clear by Namespace:**
```typescript
// Clear all entries in namespace
await cacheManager.clear();  // Clears all 'myapp:*' keys
```

---

#### 6.2 Pattern-Based Operations

Use glob patterns for flexible key matching.

```typescript
// Clear all user cache entries
await cacheManager.clear('user:*');

// Get all user keys
const userKeys = await cacheManager.keys('user:*');

// Clear specific pattern
await cacheManager.clear('report:business:*:2024:*');
```

---

#### 6.3 Conditional Caching

Cache only when specific conditions are met.

```typescript
// Cache only non-null results
@TurboCache({ 
  key: 'user:#{0}',
  condition: (result) => result !== null
})
async findUser(id: string): Promise<User | null> {}

// Don't cache temporary data
@TurboCache({ 
  key: 'session:#{0}',
  unless: (result) => result.isTemporary === true
})
async getSession(id: string): Promise<Session> {}

// Combine multiple conditions
@TurboCache({ 
  key: 'data:#{0}',
  condition: (result) => result.success === true,
  unless: (result) => result.items.length === 0
})
async getData(query: string): Promise<DataResponse> {}
```

---

#### 6.4 Cache Metadata

Include cache hit/miss information in responses.

```typescript
@TurboCache({ 
  key: 'products:all',
  includeMetadata: true,
  metadataKey: '_cache'
})
async getProducts(): Promise<Product[]> {
  return this.database.getAllProducts();
}

// Response on cache hit:
{
  products: [...],
  _cache: {
    hit: true,
    key: 'products:all',
    timestamp: 1699876543210
  }
}

// Response on cache miss:
{
  products: [...],
  _cache: {
    hit: false,
    key: 'products:all',
    timestamp: 1699876543210
  }
}
```

---

#### 6.5 Error Handling with Fallback

Provide fallback values when cache operations fail.

```typescript
// Static fallback
@TurboCache({ 
  key: 'config:#{0}',
  fallback: { default: true }
})
async getConfig(name: string): Promise<Config> {}

// Dynamic fallback
@TurboCache({ 
  key: 'api:#{0}',
  fallback: (error: Error) => ({
    error: true,
    message: error.message,
    timestamp: Date.now()
  })
})
async callExternalAPI(endpoint: string): Promise<ApiResponse> {}
```

---

#### 6.6 Statistics & Monitoring

Track cache performance metrics.

```typescript
const stats = await cacheManager.stats();

console.log({
  hitRate: (stats.hits / (stats.hits + stats.misses) * 100).toFixed(2) + '%',
  totalKeys: stats.keys,
  memoryUsage: (stats.memory / 1024 / 1024).toFixed(2) + ' MB',
  uptime: (stats.uptime / 1000 / 60).toFixed(2) + ' minutes'
});

// Example output:
// {
//   hitRate: '87.45%',
//   totalKeys: 2547,
//   memoryUsage: '45.32 MB',
//   uptime: '120.15 minutes'
// }
```

---

#### 6.7 Global Cache Manager (Non-NestJS)

Use TurboCache in vanilla TypeScript/Node.js applications.

```typescript
import { CacheManager, MemoryAdapter, setGlobalCacheManager } from 'turbocache-js';

// Create and set global cache manager
const adapter = new MemoryAdapter({ max: 1000 });
const cache = new CacheManager(adapter, {
  stores: [{ name: 'default', type: 'memory', ttl: 3600 }],
  namespace: 'myapp'
});

setGlobalCacheManager(cache);

// Now decorators work without injection
class UserService {
  @TurboCache({ key: 'user:#{0}' })
  async getUser(id: string): Promise<User> {
    return fetch(`/api/users/${id}`).then(r => r.json());
  }
}
```

---

## 📅 Planned Features

The following features are designed and documented but not yet implemented:

### 1. Cache Stampede Prevention

Prevent multiple simultaneous cache updates (thundering herd problem).

**Status:** 🚧 Type definitions exist, implementation pending

**Planned API:**
```typescript
@TurboCache({
  key: 'expensive:report',
  ttl: 3600,
  stampedeLock: true,    // Enable stampede prevention
  stampedeTTL: 30        // Lock expires after 30 seconds
})
async generateExpensiveReport(): Promise<Report> {
  // Only one instance executes
  // Others wait for the result
  return this.heavyComputation();
}
```

**How it will work:**
- First request acquires a distributed lock
- Concurrent requests wait for the lock holder to complete
- All waiting requests receive the same cached result
- Lock auto-expires after `stampedeTTL` to prevent deadlocks

---

### 2. Compression Support

Automatic compression for large cache values.

**Status:** 🚧 Interface defined, implementation pending

**Planned API:**
```typescript
TurboCacheModule.register({
  stores: [{ /* ... */ }],
  compression: {
    enabled: true,
    threshold: 1024,        // Compress values > 1KB
    algorithm: 'gzip'       // gzip, brotli, lz4
  }
})
```

**Algorithms planned:**
- gzip (balanced)
- brotli (best compression)
- lz4 (fastest)

---

### 3. Cache Warming

Proactively populate cache before requests arrive.

**Status:** 🗓️ In roadmap

**Planned API:**
```typescript
// On-startup warming
await cacheManager.warm('user:*', async (key) => {
  const userId = key.split(':')[1];
  return database.findUserById(userId);
});

// Scheduled refresh
cacheManager.scheduleWarm('products:featured', async () => {
  return database.getFeaturedProducts();
}, {
  interval: 3600000  // Every hour
});

// Decorator-based warming
@CacheWarm({ 
  schedule: '0 */6 * * *',  // Every 6 hours (cron)
  key: 'analytics:daily'
})
async computeDailyAnalytics(): Promise<Analytics> {}
```

---

### 4. Distributed Locking

Distributed locks for multi-instance deployments.

**Status:** 🗓️ In roadmap

**Planned API:**
```typescript
await cacheManager.lock('resource:123', async () => {
  // Critical section - only one instance executes
  const resource = await getResource('123');
  resource.update();
  await saveResource(resource);
}, {
  ttl: 30,           // Lock expires after 30 seconds
  retries: 3,        // Retry 3 times if lock is held
  retryDelay: 100    // Wait 100ms between retries
});
```

---

### 5. Request Coalescing

Deduplicate simultaneous identical requests.

**Status:** 🗓️ In roadmap

**Planned API:**
```typescript
@TurboCache({ 
  key: 'user:#{0}',
  coalesce: true  // Deduplicate concurrent identical requests
})
async getUser(id: string): Promise<User> {}

// Multiple simultaneous calls for same ID execute only once
Promise.all([
  service.getUser('123'),
  service.getUser('123'),
  service.getUser('123')
]);
// Only 1 DB call executed, all 3 receive same result
```

---

### 6. Encryption Support

Encrypt sensitive cache data at rest.

**Status:** 🗓️ In roadmap

**Planned API:**
```typescript
TurboCacheModule.register({
  stores: [{ /* ... */ }],
  encryption: {
    enabled: true,
    algorithm: 'aes-256-gcm',
    key: process.env.CACHE_ENCRYPTION_KEY
  }
})
```

---

### 7. Time-Series Optimized Storage

Specialized storage for time-series data.

**Status:** 🗓️ In roadmap

**Planned API:**
```typescript
@TurboCache({ 
  key: 'metrics:#{0}:#{1}',
  strategy: 'time-series',
  retention: 86400  // Keep 24 hours
})
async getMetrics(deviceId: string, timestamp: number): Promise<Metrics> {}
```

---

### 8. Cache Versioning

Automatic cache invalidation on schema changes.

**Status:** 🗓️ In roadmap

**Planned API:**
```typescript
@TurboCache({ 
  key: 'user:#{0}',
  version: 2  // Automatically invalidates v1 cache
})
async getUser(id: string): Promise<User> {}
```

---

### 9. Observability & Tracing

Integration with OpenTelemetry and monitoring tools.

**Status:** 🗓️ In roadmap

**Planned integrations:**
- Prometheus metrics export
- StatsD support
- OpenTelemetry tracing
- Custom logger integration

---

## 📊 Feature Matrix

| Feature | Status | Memory | Redis | MongoDB | PostgreSQL |
|---------|--------|--------|-------|---------|------------|
| Basic Operations | ✅ | ✅ | ✅ | ✅ | ✅ |
| Batch Operations | ✅ | ✅ | ✅ | ✅ | ✅ |
| TTL Support | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pattern Matching | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ |
| Statistics | ✅ | ✅ | ⚠️ | ⚠️ | ⚠️ |
| Multi-Tier | ✅ | ✅ | ✅ | ✅ | ✅ |
| Compression | 🚧 | - | - | - | - |
| Encryption | 🗓️ | - | - | - | - |
| Stampede Prevention | 🚧 | - | - | - | - |

**Legend:**
- ✅ Fully implemented
- ⚠️ Partial support or limitations
- 🚧 Planned (types defined)
- 🗓️ In roadmap
- ❌ Not supported

---

## 🔗 Related Documentation

- [API Reference](./API_REFERENCE.md) - Complete API documentation
- [Architecture](./ARCHITECTURE.md) - System design and architecture
- [Examples](./EXAMPLES.md) - Real-world usage examples
- [Setup Guide](../SETUP.md) - Installation and configuration

---

**Last Updated:** November 2024  
**Version:** 1.0.0
