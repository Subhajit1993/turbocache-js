# Cache Metadata Feature

## Overview

The cache metadata feature allows you to include cache hit/miss information directly in your method responses. This is extremely useful for:

- **Debugging**: Understand cache behavior during development
- **Monitoring**: Track cache effectiveness in production
- **API Transparency**: Let consumers know if data is cached
- **Performance Analysis**: Measure cache hit rates

## Basic Usage

Enable metadata by setting `includeMetadata: true`:

```typescript
@TurboCache({
  key: 'users:all',
  ttl: 300,
  includeMetadata: true, // Add cache metadata to response
})
async findAll() {
  return await this.db.users.findAll();
}
```

## Response Format

### For Objects

Objects get a `__cache__` property added:

```typescript
// Cache MISS
{
  id: '1',
  name: 'Alice',
  email: 'alice@example.com',
  __cache__: {
    hit: false,
    key: 'user:1',
    timestamp: 1699876543210
  }
}

// Cache HIT
{
  id: '1',
  name: 'Alice',
  email: 'alice@example.com',
  __cache__: {
    hit: true,
    key: 'user:1',
    timestamp: 1699876543250
  }
}
```

### For Arrays

Arrays get a `__cache__` property (as arrays are objects in JavaScript):

```typescript
[
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
  __cache__: {
    hit: true,
    key: 'users:all',
    timestamp: 1699876543300
  }
]
```

### For Primitives

Primitives are wrapped in an object:

```typescript
// Original: 42
// With metadata:
{
  value: 42,
  __cache__: {
    hit: false,
    key: 'count',
    timestamp: 1699876543350
  }
}
```

## Custom Metadata Key

Change the metadata key name:

```typescript
@TurboCache({
  key: 'user:#{id}',
  ttl: 300,
  includeMetadata: true,
  metadataKey: '_cacheInfo', // Custom key instead of '__cache__'
})
async findById(id: string) {
  return await this.db.users.findById(id);
}
```

Response:
```typescript
{
  id: '1',
  name: 'Alice',
  _cacheInfo: { // Custom key
    hit: true,
    key: 'user:1',
    timestamp: 1699876543400
  }
}
```

## Metadata Properties

The metadata object contains:

| Property | Type | Description |
|----------|------|-------------|
| `hit` | `boolean` | `true` if from cache, `false` if computed |
| `key` | `string` | The cache key that was used |
| `timestamp` | `number` | Unix timestamp (ms) when response was generated |

## Use Cases

### 1. Development Debugging

```typescript
@TurboCache({
  key: 'user:#{id}',
  ttl: 3600,
  includeMetadata: process.env.NODE_ENV === 'development', // Only in dev
})
async getUser(id: string) {
  return await this.userRepo.findById(id);
}
```

### 2. API Response Headers

```typescript
@Controller('users')
export class UserController {
  @Get(':id')
  async getUser(@Param('id') id: string, @Res() res: Response) {
    const user = await this.userService.getUser(id);
    
    // Add cache info to response headers
    if (user.__cache__) {
      res.header('X-Cache', user.__cache__.hit ? 'HIT' : 'MISS');
      res.header('X-Cache-Key', user.__cache__.key);
      
      // Remove from response body
      const { __cache__, ...userData } = user;
      return res.json(userData);
    }
    
    return res.json(user);
  }
}
```

### 3. Performance Monitoring

```typescript
@Injectable()
export class UserService {
  @TurboCache({
    key: 'users:all',
    ttl: 300,
    includeMetadata: true,
  })
  async findAll() {
    return await this.db.users.findAll();
  }
}

// In your controller or interceptor
const result = await this.userService.findAll();
if (result.__cache__) {
  this.metricsService.recordCacheHit('users:all', result.__cache__.hit);
  
  // Log slow cache misses
  if (!result.__cache__.hit) {
    const duration = Date.now() - result.__cache__.timestamp;
    if (duration > 100) {
      this.logger.warn(`Slow cache miss: ${duration}ms for key ${result.__cache__.key}`);
    }
  }
}
```

### 4. GraphQL Field Resolver

```typescript
@Resolver(() => User)
export class UserResolver {
  @Query(() => [User])
  @TurboCache({
    key: 'users:all',
    ttl: 300,
    includeMetadata: true,
  })
  async users() {
    return await this.userService.findAll();
  }
  
  @ResolveField()
  cacheInfo(@Parent() user: any) {
    return user.__cache__ || null;
  }
}

// GraphQL Query:
// query {
//   users {
//     id
//     name
//     cacheInfo {
//       hit
//       key
//       timestamp
//     }
//   }
// }
```

### 5. Filter Metadata Before Sending

```typescript
// Utility function to clean metadata
function stripCacheMetadata<T>(data: T & { __cache__?: any }): T {
  if (data && typeof data === 'object') {
    const { __cache__, ...clean } = data;
    return clean as T;
  }
  return data;
}

// Usage
@Get()
async getUsers() {
  const users = await this.userService.findAll();
  
  // Log cache info
  if (users.__cache__) {
    this.logger.debug(`Cache ${users.__cache__.hit ? 'HIT' : 'MISS'}`);
  }
  
  // Return clean data
  return stripCacheMetadata(users);
}
```

## Best Practices

### 1. Use in Development Only

Enable metadata only in development to avoid payload overhead:

```typescript
@TurboCache({
  key: 'user:#{id}',
  ttl: 3600,
  includeMetadata: process.env.NODE_ENV !== 'production',
})
```

### 2. Use Custom Key for Internal APIs

If your API schema doesn't allow unknown properties, use a custom key:

```typescript
@TurboCache({
  key: 'user:#{id}',
  ttl: 3600,
  includeMetadata: true,
  metadataKey: '_meta', // Documented in your API schema
})
```

### 3. Strip Before Serialization

Remove metadata before sending to clients:

```typescript
// NestJS Interceptor
@Injectable()
export class CacheMetadataInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => {
        if (data && data.__cache__) {
          const { __cache__, ...clean } = data;
          return clean;
        }
        return data;
      })
    );
  }
}
```

### 4. Log Cache Metrics

Use metadata for observability:

```typescript
const result = await this.service.getData();

if (result.__cache__) {
  this.prometheus.increment('cache_requests_total', {
    hit: result.__cache__.hit,
    key: result.__cache__.key.split(':')[0], // Use prefix for grouping
  });
}
```

## Performance Considerations

- **Object Cloning**: Metadata requires cloning the cached object to avoid mutation
- **Payload Size**: Adds ~80 bytes to each response
- **Recommendation**: Enable only in development or use response interceptors to strip in production

## TypeScript Support

For TypeScript users, create a type helper:

```typescript
type WithCacheMetadata<T> = T & {
  __cache__?: {
    hit: boolean;
    key: string;
    timestamp: number;
  };
};

// Usage
const users: WithCacheMetadata<User[]> = await this.userService.findAll();
if (users.__cache__?.hit) {
  console.log('Cache hit!');
}
```

## Example: Complete Monitoring Solution

```typescript
@Injectable()
export class UserService {
  constructor(
    private db: Database,
    private metrics: MetricsService,
  ) {}

  @TurboCache({
    key: 'users:active',
    ttl: 600,
    includeMetadata: true,
  })
  async getActiveUsers() {
    const users = await this.db.users.findActive();
    return users;
  }
}

@Controller('users')
export class UserController {
  @Get('active')
  async getActiveUsers() {
    const result = await this.userService.getActiveUsers();
    
    // Extract and log metadata
    const { __cache__, ...users } = result;
    
    if (__cache__) {
      this.metrics.record({
        metric: 'cache_operation',
        hit: __cache__.hit,
        key: __cache__.key,
        responseTime: Date.now() - __cache__.timestamp,
      });
    }
    
    return users; // Return clean data
  }
}
```

## Related Options

- `condition`: Only cache when condition is true
- `unless`: Skip caching when condition is true
- `fallback`: Return fallback on error

All these options work seamlessly with metadata.
