# TurboCache-JS API Reference

## Table of Contents
1. [Decorators](#decorators)
2. [CacheManager](#cachemanager)
3. [Configuration](#configuration)
4. [Adapters](#adapters)

---

## Decorators

### @TurboCache

Cache method results automatically.

```typescript
@TurboCache(options?: TurboCacheOptions)
```

**Options:**
- `key?: string` - Cache key pattern (supports #{param} expressions)
- `ttl?: number` - Time to live in seconds
- `namespace?: string` - Cache namespace
- `condition?: (result: any) => boolean` - Conditional caching
- `unless?: (result: any) => boolean` - Skip caching condition

**Examples:**

```typescript
// Simple caching
@TurboCache()
async getUser(id: string): Promise<User> {}

// With TTL
@TurboCache({ ttl: 3600 })
async getProducts(): Promise<Product[]> {}

// With key expression
@TurboCache({ key: 'user:#{id}' })
async getUserById(id: string): Promise<User> {}

// Conditional caching
@TurboCache({ 
  condition: (result) => result !== null 
})
async findUser(email: string): Promise<User | null> {}
```

### @TurboCacheEvict

Invalidate cache entries.

```typescript
@TurboCacheEvict(options: TurboCacheEvictOptions)
```

**Options:**
- `key?: string` - Key to evict
- `allEntries?: boolean` - Clear all entries in namespace
- `beforeInvocation?: boolean` - Evict before method execution
- `namespace?: string` - Target namespace

**Examples:**

```typescript
// Evict single key
@TurboCacheEvict({ key: 'user:#{id}' })
async updateUser(id: string, data: UpdateDto) {}

// Evict all
@TurboCacheEvict({ allEntries: true, namespace: 'users' })
async clearAllUsers() {}

// Before invocation
@TurboCacheEvict({ 
  key: 'user:#{id}',
  beforeInvocation: true 
})
async deleteUser(id: string) {}
```

### @TurboCachePut

Update cache without preventing execution.

```typescript
@TurboCachePut(options: TurboCachePutOptions)
```

**Options:**
- `key: string` - Cache key pattern
- `ttl?: number` - Time to live
- `condition?: (result: any) => boolean` - Conditional update

**Example:**

```typescript
@TurboCachePut({ key: 'user:#{result.id}' })
async createUser(data: CreateUserDto): Promise<User> {}
```

---

## CacheManager

### Methods

#### get<T>(key: string): Promise<T | null>
Retrieve cached value.

```typescript
const user = await cache.get<User>('user:123');
```

#### set<T>(key: string, value: T, ttl?: number): Promise<void>
Store value in cache.

```typescript
await cache.set('user:123', user, 3600);
```

#### delete(key: string | string[]): Promise<void>
Remove cache entry/entries.

```typescript
await cache.delete('user:123');
await cache.delete(['user:1', 'user:2']);
```

#### clear(pattern?: string): Promise<void>
Clear cache entries matching pattern.

```typescript
await cache.clear('user:*');
```

#### has(key: string): Promise<boolean>
Check if key exists.

```typescript
const exists = await cache.has('user:123');
```

#### mget<T>(keys: string[]): Promise<Map<string, T>>
Get multiple values.

```typescript
const users = await cache.mget<User>(['user:1', 'user:2']);
```

#### mset<T>(entries: Map<string, T>, ttl?: number): Promise<void>
Set multiple values.

```typescript
await cache.mset(new Map([
  ['user:1', user1],
  ['user:2', user2]
]), 3600);
```

---

## Configuration

### Module Registration

```typescript
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
  enableMetrics: true,
  compression: {
    enabled: true,
    threshold: 1024
  }
})
```

### Async Configuration

```typescript
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
    namespace: config.get('APP_NAME')
  }),
  inject: [ConfigService]
})
```

---

## Storage Backends

### Redis

```typescript
{
  name: 'cache',
  type: 'redis',
  primary: {
    type: 'redis',
    uri: 'redis://localhost:6379',
    options: {
      keyPrefix: 'myapp:'
    }
  },
  ttl: 3600
}
```

### Memory

```typescript
{
  name: 'cache',
  type: 'memory',
  primary: {
    type: 'memory',
    options: {
      max: 1000
    }
  },
  ttl: 300
}
```

### Multi-Tier (Memory + Redis)

```typescript
{
  name: 'cache',
  type: 'multi-tier',
  primary: {
    type: 'memory',
    options: { max: 1000 },
    ttl: 300
  },
  secondary: {
    type: 'redis',
    uri: 'redis://localhost:6379',
    ttl: 3600
  }
}
```

### MongoDB

```typescript
{
  name: 'cache',
  type: 'mongodb',
  primary: {
    type: 'mongodb',
    uri: 'mongodb://localhost:27017/cache'
  },
  ttl: 3600
}
```

### PostgreSQL

```typescript
{
  name: 'cache',
  type: 'postgresql',
  primary: {
    type: 'postgresql',
    uri: 'postgresql://localhost:5432/cache'
  },
  ttl: 3600
}
```
