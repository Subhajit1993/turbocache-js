# TurboCache-JS: Enterprise Caching Library Architecture

## Executive Summary

TurboCache-JS is a high-performance, intelligent caching library designed for TypeScript/NestJS microservices. It provides a unified abstraction layer over `cacheable` and `keyv`, offering decorator-based APIs, NestJS dependency injection, distributed caching, and intelligent cache invalidation strategies.

---

## 1. Core Design Principles

### 1.1 Design Philosophy
- **Zero-Config Philosophy**: Works out of the box with sensible defaults
- **Progressive Enhancement**: Start simple, add complexity as needed
- **Type-Safe First**: Leverage TypeScript for compile-time safety
- **Adapter Pattern**: Support multiple storage backends seamlessly
- **Microservice-Ready**: Built for distributed systems from ground up

### 1.2 Key Technical Requirements
- Full TypeScript support with strict type checking
- Decorator-based API for clean, declarative caching
- NestJS module system integration
- Support for multiple storage adapters (Redis, Memory, Memcached, etc.)
- Intelligent cache invalidation and TTL management
- Cache warming and pre-loading strategies
- Distributed cache coordination
- Observability and metrics collection
- Zero-downtime cache updates

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Application Layer                      │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Controllers │  │   Services    │  │   Resolvers   │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                │                   │           │
│         └────────────────┴───────────────────┘           │
│                          │                               │
└──────────────────────────┼───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                 TurboCache Decorator Layer               │
│  @TurboCache()  @TurboCacheEvict()  @TurboCachePut()  @TurboCacheKey()  │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│                   TurboCache Core Module                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │            Cache Manager (Orchestrator)            │  │
│  ├────────────────────────────────────────────────────┤  │
│  │  • Cache Strategy Engine                          │  │
│  │  • Key Generation & Namespacing                   │  │
│  │  • TTL & Invalidation Logic                       │  │
│  │  • Serialization/Deserialization                  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────┬───────────────────────────────┘
                           │
┌──────────────────────────▼───────────────────────────────┐
│               Adapter Abstraction Layer                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │  Keyv    │  │Cacheable │  │  Custom  │  │  Multi  │ │
│  │ Adapter  │  │ Adapter  │  │ Adapter  │  │  Tier   │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │
└───────┼─────────────┼─────────────┼──────────────┼──────┘
        │             │             │              │
┌───────▼─────────────▼─────────────▼──────────────▼──────┐
│                    Storage Backends                      │
│  ┌────────┐  ┌─────────┐  ┌────────┐  ┌──────────────┐ │
│  │ Redis  │  │ Memory  │  │MongoDB │  │   S3/Cloud   │ │
│  └────────┘  └─────────┘  └────────┘  └──────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 2.2 Module Structure

```
turbocache-js/
├── src/
│   ├── core/
│   │   ├── cache-manager.ts           # Main orchestrator
│   │   ├── cache-config.ts            # Configuration types
│   │   ├── cache-strategy.ts          # Strategy implementations
│   │   └── interfaces.ts              # Core interfaces
│   ├── decorators/
│   │   ├── cacheable.decorator.ts     # @Cacheable decorator
│   │   ├── cache-evict.decorator.ts   # @CacheEvict decorator
│   │   ├── cache-put.decorator.ts     # @CachePut decorator
│   │   ├── cache-key.decorator.ts     # @CacheKey decorator
│   │   └── index.ts
│   ├── adapters/
│   │   ├── base-adapter.ts            # Abstract base adapter
│   │   ├── keyv-adapter.ts            # Keyv wrapper
│   │   ├── cacheable-adapter.ts       # Cacheable wrapper
│   │   ├── multi-tier-adapter.ts      # L1/L2 cache
│   │   └── index.ts
│   ├── strategies/
│   │   ├── ttl-strategy.ts            # Time-based invalidation
│   │   ├── lru-strategy.ts            # LRU eviction
│   │   ├── dependency-strategy.ts     # Dependency-based invalidation
│   │   └── index.ts
│   ├── serializers/
│   │   ├── json-serializer.ts         # JSON serialization
│   │   ├── msgpack-serializer.ts      # MessagePack (optional)
│   │   └── index.ts
│   ├── key-generators/
│   │   ├── default-key-generator.ts   # Default key generation
│   │   ├── hash-key-generator.ts      # Hash-based keys
│   │   └── index.ts
│   ├── interceptors/
│   │   ├── cache.interceptor.ts       # NestJS interceptor
│   │   └── index.ts
│   ├── modules/
│   │   ├── turbocache.module.ts       # Main NestJS module
│   │   └── turbocache-async.module.ts # Async module factory
│   ├── observability/
│   │   ├── metrics.ts                 # Metrics collection
│   │   ├── logger.ts                  # Structured logging
│   │   └── health-indicator.ts        # Health checks
│   ├── utils/
│   │   ├── cache-key-builder.ts       # Key construction
│   │   ├── type-guards.ts             # Type utilities
│   │   └── index.ts
│   └── index.ts                       # Public API
├── docs/
│   ├── ARCHITECTURE.md                # This document
│   ├── API_REFERENCE.md              # API documentation
│   ├── EXAMPLES.md                   # Usage examples
│   └── MIGRATION_GUIDE.md            # Migration guide
├── examples/
│   ├── basic-usage/
│   ├── nestjs-integration/
│   ├── microservices/
│   └── advanced-patterns/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── package.json
├── tsconfig.json
└── README.md
```

---

## 3. Core Components

### 3.1 Cache Manager

**Responsibility**: Central orchestration of all caching operations

**Key Features**:
- Manage multiple cache instances with different configurations
- Route operations to appropriate adapters
- Handle serialization/deserialization
- Coordinate cache invalidation
- Collect metrics and logs

**Implementation Pattern**:
```typescript
class CacheManager {
  private adapters: Map<string, ICacheAdapter>;
  private strategies: Map<string, ICacheStrategy>;
  private keyGenerator: IKeyGenerator;
  private serializer: ISerializer;
  private metrics: MetricsCollector;
  
  async get<T>(key: string, options?: GetOptions): Promise<T | null>;
  async set<T>(key: string, value: T, options?: SetOptions): Promise<void>;
  async delete(key: string | string[]): Promise<void>;
  async clear(pattern?: string): Promise<void>;
  async has(key: string): Promise<boolean>;
}
```

### 3.2 Decorator System

#### 3.2.1 @TurboCache
**Purpose**: Cache method results automatically

**Features**:
- Automatic key generation from method params
- Custom key expressions
- Conditional caching
- TTL configuration
- Fallback on cache miss

**Example**:
```typescript
@TurboCache({
  key: 'user:#{id}',
  ttl: 3600,
  condition: (result) => result !== null,
  namespace: 'users'
})
async getUserById(id: string): Promise<User> {
  // Expensive DB call
}
```

#### 3.2.2 @TurboCacheEvict
**Purpose**: Invalidate cache entries

**Features**:
- Single or multiple key eviction
- Pattern-based eviction
- Before/after method execution
- Conditional eviction

**Example**:
```typescript
@TurboCacheEvict({
  key: 'user:#{id}',
  allEntries: false,
  beforeInvocation: false
})
async updateUser(id: string, data: UpdateUserDto): Promise<User> {
  // Update user
}
```

#### 3.2.3 @TurboCachePut
**Purpose**: Update cache without preventing method execution

**Example**:
```typescript
@TurboCachePut({
  key: 'user:#{result.id}',
  condition: (result) => result.isActive
})
async createUser(data: CreateUserDto): Promise<User> {
  // Create and return user
}
```

### 3.3 Adapter System

**Base Interface**:
```typescript
interface ICacheAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
  mget<T>(keys: string[]): Promise<Map<string, T>>;
  mset<T>(entries: Map<string, T>, ttl?: number): Promise<void>;
  keys(pattern?: string): Promise<string[]>;
}
```

**Adapters**:
1. **KeyvAdapter**: Wraps Keyv library
2. **CacheableAdapter**: Wraps Cacheable library
3. **MultiTierAdapter**: Implements L1 (memory) + L2 (distributed) caching
4. **CustomAdapter**: Extensible for custom backends

---

## 4. Intelligent Caching Strategies

### 4.1 Cache Invalidation Strategies

#### 4.1.1 Time-Based (TTL)
- Absolute expiration
- Sliding expiration (refresh on access)
- Scheduled invalidation

#### 4.1.2 Event-Based
- Pub/Sub invalidation across services
- Redis Pub/Sub for distributed invalidation
- Event-driven cache clearing

#### 4.1.3 Dependency-Based
- Tag-based invalidation
- Cascade invalidation (parent-child relationships)
- Version-based invalidation

#### 4.1.4 Capacity-Based
- LRU (Least Recently Used)
- LFU (Least Frequently Used)
- Size-based eviction

### 4.2 Cache Warming

**Features**:
- Pre-populate cache on startup
- Scheduled background refresh
- Predictive warming based on access patterns

**Implementation**:
```typescript
@Injectable()
class CacheWarmer {
  async warmCache(config: WarmingConfig): Promise<void>;
  async scheduleWarming(cron: string, config: WarmingConfig): Promise<void>;
}
```

### 4.3 Multi-Tier Caching

**Pattern**: L1 (Local Memory) → L2 (Distributed Redis)

**Benefits**:
- Ultra-fast local access
- Reduced network calls
- Cross-service cache sharing

**Configuration**:
```typescript
TurboCacheModule.register({
  stores: [
    {
      name: 'multi-tier',
      type: 'multi-tier',
      primary: {
        type: 'memory',
        options: { max: 1000 }
      },
      secondary: {
        type: 'redis',
        uri: 'redis://localhost:6379'
      },
      ttl: 3600
    }
  ]
})
```

---

## 5. NestJS Integration

### 5.1 Module Configuration

**Synchronous**:
```typescript
@Module({
  imports: [
    TurboCacheModule.register({
      stores: [
        {
          name: 'default',
          type: 'redis',
          primary: {
            type: 'redis',
            uri: 'redis://localhost:6379'
          },
          ttl: 3600
        }
      ],
      namespace: 'myapp',
      enableMetrics: true
    })
  ]
})
export class AppModule {}
```

**Asynchronous**:
```typescript
@Module({
  imports: [
    TurboCacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        stores: [
          {
            name: 'default',
            type: 'redis',
            primary: {
              type: 'redis',
              uri: config.get('REDIS_URL')
            },
            ttl: config.get('CACHE_TTL', 3600)
          }
        ],
        namespace: config.get('APP_NAME')
      }),
      inject: [ConfigService]
    })
  ]
})
export class AppModule {}
```

### 5.2 Service Injection

```typescript
@Injectable()
export class UserService {
  constructor(
    @InjectCache('default') private cache: CacheManager,
    private userRepository: UserRepository
  ) {}
  
  @TurboCache({
    key: 'user:#{id}',
    ttl: 3600
  })
  async findById(id: string): Promise<User> {
    return this.userRepository.findById(id);
  }
}
```

### 5.3 Interceptor-Based Caching

```typescript
@Controller('users')
@UseInterceptors(CacheInterceptor)
export class UserController {
  @Get(':id')
  @TurboCacheKey('user:#{params.id}')
  @CacheTTL(3600)
  async getUser(@Param('id') id: string) {
    // Will be cached automatically
  }
}
```

---

## 6. Microservices Features

### 6.1 Distributed Cache Coordination

**Features**:
- Cross-service cache invalidation
- Service-to-service cache sharing
- Distributed locking for cache updates

**Implementation**:
```typescript
interface IDistributedCache extends ICacheAdapter {
  publish(channel: string, message: any): Promise<void>;
  subscribe(channel: string, handler: (msg: any) => void): Promise<void>;
  lock(key: string, ttl: number): Promise<Lock>;
}
```

### 6.2 Cache Namespace Isolation

**Per-Service Namespacing**:
```typescript
{
  stores: [
    {
      name: 'default',
      type: 'redis',
      primary: {
        type: 'redis',
        uri: 'redis://localhost:6379'
      }
    }
  ],
  namespace: `${SERVICE_NAME}:${ENVIRONMENT}`
}
```

### 6.3 Service Discovery Integration

**Pattern**: Cache configuration discovery via service registry

```typescript
@Injectable()
class CacheDiscoveryService {
  async discoverCacheEndpoints(): Promise<CacheEndpoint[]>;
  async registerCacheService(): Promise<void>;
}
```

---

## 7. Advanced Features

### 7.1 Cache Stamped Prevention

Prevent multiple simultaneous cache updates:

```typescript
@TurboCache({
  key: 'expensive:data',
  stampedeLock: true,
  stampedeTTL: 30
})
async getExpensiveData(): Promise<Data> {
  // Only one instance will execute
}
```

### 7.2 Partial Caching

Cache subset of data:

```typescript
@TurboCache({
  key: 'user:#{id}:profile',
  fields: ['name', 'email', 'avatar']
})
async getUserProfile(id: string): Promise<UserProfile> {
  // Cache only specified fields
}
```

### 7.3 Cache Compression

Automatic compression for large payloads:

```typescript
{
  compression: {
    enabled: true,
    threshold: 1024, // bytes
    algorithm: 'gzip'
  }
}
```

### 7.4 Cache Analytics

Track cache performance:

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

interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  avgLatency: number;
  memoryUsage: number;
}

@Injectable()
class CacheAnalytics {
  getMetrics(namespace?: string): Promise<CacheMetrics>;
  getHotKeys(limit: number): Promise<string[]>;
}
```

---

## 8. Observability & Monitoring

### 8.1 Metrics Collection

**Metrics to Track**:
- Hit/Miss ratio
- Latency (P50, P95, P99)
- Memory usage
- Eviction rate
- Operation throughput

**Integration**:
- Prometheus metrics
- StatsD support
- Custom metrics adapter

### 8.2 Logging

**Structured Logging**:
```typescript
{
  logging: {
    level: 'info',
    includeKeys: true,
    format: 'json'
  }
}
```

### 8.3 Health Checks

```typescript
@Injectable()
class CacheHealthIndicator extends HealthIndicator {
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    // Check cache connectivity
    // Check memory usage
    // Check response times
  }
}
```

---

## 9. Performance Optimization

### 9.1 Batching

Batch multiple cache operations:

```typescript
const users = await cache.mget(['user:1', 'user:2', 'user:3']);
await cache.mset(new Map([
  ['user:1', user1],
  ['user:2', user2]
]));
```

### 9.2 Pipeline Operations

Redis pipeline support:

```typescript
const pipeline = cache.pipeline();
pipeline.get('key1');
pipeline.get('key2');
const results = await pipeline.exec();
```

### 9.3 Lazy Loading

Defer cache initialization:

```typescript
{
  lazyConnect: true,
  connectTimeout: 5000
}
```

---

## 10. Security Considerations

### 10.1 Encryption

**At-Rest Encryption**:
```typescript
{
  encryption: {
    enabled: true,
    algorithm: 'aes-256-gcm',
    keyProvider: () => process.env.CACHE_ENCRYPTION_KEY
  }
}
```

### 10.2 Access Control

**Key-based ACL**:
```typescript
{
  acl: {
    enabled: true,
    rules: [
      { pattern: 'admin:*', roles: ['admin'] },
      { pattern: 'user:*', roles: ['user', 'admin'] }
    ]
  }
}
```

### 10.3 Rate Limiting

Prevent cache abuse:

```typescript
{
  rateLimit: {
    enabled: true,
    maxRequests: 1000,
    window: 60000 // ms
  }
}
```

---

## 11. Testing Strategy

### 11.1 Unit Tests
- Test each adapter independently
- Test decorators in isolation
- Test key generation logic

### 11.2 Integration Tests
- Test with real storage backends
- Test NestJS module integration
- Test decorator behavior in services

### 11.3 E2E Tests
- Test full microservice scenarios
- Test distributed invalidation
- Test cache warming

### 11.4 Performance Tests
- Benchmark different adapters
- Load testing
- Memory leak detection

---

## 12. Migration Path

### 12.1 From cache-manager
```typescript
// Before
import { CacheModule } from '@nestjs/cache-manager';

// After
import { TurboCacheModule } from 'turbocache-js';
```

### 12.2 From custom solutions
- Adapter pattern allows gradual migration
- Run both systems in parallel initially
- Feature flags for rollout

---

## 13. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Core interfaces and types
- [ ] Basic CacheManager implementation
- [ ] KeyvAdapter and CacheableAdapter
- [ ] Simple @TurboCache decorator
- [ ] Basic NestJS module

### Phase 2: Decorators (Weeks 3-4)
- [ ] @TurboCacheEvict decorator
- [ ] @TurboCachePut decorator
- [ ] @TurboCacheKey decorator
- [ ] Key expression parser
- [ ] Conditional caching logic

### Phase 3: Advanced Features (Weeks 5-6)
- [ ] Multi-tier caching
- [ ] Cache warming
- [ ] Stampede prevention
- [ ] Compression support
- [ ] Serialization strategies

### Phase 4: Microservices (Weeks 7-8)
- [ ] Distributed invalidation
- [ ] Pub/Sub support
- [ ] Service discovery
- [ ] Cross-service coordination

### Phase 5: Observability (Weeks 9-10)
- [ ] Metrics collection
- [ ] Prometheus integration
- [ ] Health checks
- [ ] Analytics dashboard

### Phase 6: Production Readiness (Weeks 11-12)
- [ ] Security features
- [ ] Performance optimization
- [ ] Documentation
- [ ] Examples and guides
- [ ] Testing suite

---

## 14. Dependencies

### Core Dependencies
```json
{
  "keyv": "^4.5.x",
  "cacheable": "^1.5.x",
  "@nestjs/common": "^10.x",
  "@nestjs/core": "^10.x",
  "reflect-metadata": "^0.1.x"
}
```

### Optional Dependencies
```json
{
  "@keyv/redis": "^2.x",
  "ioredis": "^5.x",
  "msgpack-lite": "^0.1.x",
  "prom-client": "^15.x"
}
```

---

## 15. Success Metrics

### Technical Metrics
- **Performance**: <5ms cache read latency
- **Reliability**: 99.9% uptime
- **Scalability**: Handle 100k ops/sec
- **Memory**: <100MB overhead

### Developer Experience
- **Setup Time**: <15 minutes
- **Learning Curve**: <1 day for basic usage
- **Documentation**: 100% API coverage

### Business Impact
- **Cost Reduction**: 50% reduction in DB load
- **Response Time**: 70% faster API responses
- **Adoption**: Used in 80% of services

---

## 16. References & Resources

### Inspirations
- Spring Cache Abstraction
- .NET MemoryCache
- Django Cache Framework

### Standards
- RFC 7234 (HTTP Caching)
- Redis Protocol Specification

### Best Practices
- "Caching at Scale" - Facebook Engineering
- "Web Performance Daybook" - Stoyan Stefanov
- "Designing Data-Intensive Applications" - Martin Kleppmann

---

## Appendix A: Key Design Decisions

### A.1 Why Decorator-Based?
- Clean, declarative syntax
- Separation of concerns
- AOP (Aspect-Oriented Programming) pattern
- Familiar to NestJS developers

### A.2 Why Abstract Over Multiple Libraries?
- Flexibility to switch backends
- Leverage best features of each
- Future-proof against deprecations
- Vendor lock-in prevention

### A.3 Why NestJS First?
- Large enterprise adoption
- Strong DI container
- Module system
- Growing ecosystem

---

## Appendix B: FAQs

**Q: How does this differ from @nestjs/cache-manager?**  
A: TurboCache provides more advanced features like intelligent invalidation, multi-tier caching, distributed coordination, and better TypeScript support.

**Q: Can I use this without NestJS?**  
A: Yes! While optimized for NestJS, the core library works standalone with decorators.

**Q: What about GraphQL?**  
A: Full GraphQL support through field-level caching and DataLoader integration planned for Phase 4.

**Q: Production-ready timeline?**  
A: MVP in 6 weeks, production-ready in 12 weeks with full test coverage and documentation.

---

*Document Version: 1.0*  
*Last Updated: 2024*  
*Author: Platform Engineering Team*
