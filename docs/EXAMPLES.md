# TurboCache-JS Usage Examples

## Basic Usage

### Simple Service Caching

```typescript
@Injectable()
export class UserService {
  constructor(
    @InjectCache() private cache: CacheManager,
    private userRepo: UserRepository
  ) {}
  
  @TurboCache({ key: 'user:#{id}', ttl: 3600 })
  async findById(id: string): Promise<User> {
    return this.userRepo.findById(id);
  }
  
  @TurboCacheEvict({ key: 'user:#{id}' })
  async update(id: string, data: UpdateUserDto): Promise<User> {
    return this.userRepo.update(id, data);
  }
  
  @TurboCachePut({ key: 'user:#{result.id}' })
  async create(data: CreateUserDto): Promise<User> {
    return this.userRepo.create(data);
  }
}
```

## Advanced Patterns

### Multi-Tier Caching

```typescript
@Module({
  imports: [
    TurboCacheModule.register({
      stores: [
        {
          name: 'multi-tier',
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
      ]
    })
  ]
})
export class AppModule {}
```

### Cache Warming

```typescript
@Injectable()
export class CacheWarmingService implements OnModuleInit {
  constructor(private cache: CacheManager) {}
  
  async onModuleInit() {
    await this.warmUserCache();
  }
  
  private async warmUserCache() {
    const popularUsers = await this.getPopularUsers();
    for (const user of popularUsers) {
      await this.cache.set(`user:${user.id}`, user, 7200);
    }
  }
}
```

### Distributed Invalidation

```typescript
@Injectable()
export class ProductService {
  constructor(
    @InjectCache() private cache: CacheManager,
    private eventBus: EventBus
  ) {}
  
  @TurboCacheEvict({ key: 'product:#{id}' })
  async update(id: string, data: UpdateDto): Promise<Product> {
    const product = await this.repo.update(id, data);
    
    // Notify other services
    await this.eventBus.publish('product.updated', {
      productId: id,
      action: 'invalidate-cache'
    });
    
    return product;
  }
}
```

## Microservices Integration

### Service A (Publisher)

```typescript
@Injectable()
export class OrderService {
  @TurboCacheEvict({ key: 'inventory:#{productId}' })
  async createOrder(productId: string, qty: number) {
    const order = await this.orderRepo.create({ productId, qty });
    
    // Publish event for other services
    await this.messageBus.emit('inventory.changed', {
      productId,
      keys: [`inventory:${productId}`]
    });
    
    return order;
  }
}
```

### Service B (Subscriber)

```typescript
@Injectable()
export class InventoryService implements OnModuleInit {
  constructor(
    @InjectCache() private cache: CacheManager,
    private messageBus: MessageBus
  ) {}
  
  async onModuleInit() {
    this.messageBus.subscribe('inventory.changed', async (event) => {
      // Invalidate local cache
      for (const key of event.keys) {
        await this.cache.delete(key);
      }
    });
  }
  
  @TurboCache({ key: 'inventory:#{productId}', ttl: 600 })
  async getInventory(productId: string) {
    return this.inventoryRepo.findByProduct(productId);
  }
}
```

## Performance Optimization

### Batch Operations

```typescript
@Injectable()
export class BatchService {
  async getUsersBatch(ids: string[]): Promise<Map<string, User>> {
    const keys = ids.map(id => `user:${id}`);
    const cached = await this.cache.mget<User>(keys);
    
    // Find missing
    const missing = ids.filter(id => !cached.has(`user:${id}`));
    
    if (missing.length > 0) {
      const users = await this.repo.findByIds(missing);
      const toCache = new Map(
        users.map(u => [`user:${u.id}`, u])
      );
      await this.cache.mset(toCache, 3600);
      
      // Merge
      toCache.forEach((v, k) => cached.set(k, v));
    }
    
    return cached;
  }
}
```

### Stampede Prevention

```typescript
@TurboCache({
  key: 'expensive:report',
  ttl: 3600,
  stampedeLock: true,
  stampedeTTL: 30
})
async generateExpensiveReport(): Promise<Report> {
  // Only one instance will execute
  // Others will wait for the result
  return this.heavyComputation();
}
```

## GraphQL Integration

```typescript
@Resolver(() => User)
export class UserResolver {
  @Query(() => User)
  @TurboCache({ key: 'user:#{args.id}' })
  async user(@Args('id') id: string) {
    return this.userService.findById(id);
  }
  
  @Mutation(() => User)
  @TurboCacheEvict({ key: 'user:#{args.id}' })
  async updateUser(
    @Args('id') id: string,
    @Args('data') data: UpdateUserInput
  ) {
    return this.userService.update(id, data);
  }
}
```

## Testing Examples

```typescript
describe('UserService', () => {
  let service: UserService;
  let cache: CacheManager;
  
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        TurboCacheModule.register({
          stores: [{
            name: 'default',
            type: 'memory',
            primary: {
              type: 'memory'
            }
          }]
        })
      ],
      providers: [UserService]
    }).compile();
    
    service = module.get(UserService);
    cache = module.get('CACHE_MANAGER');
  });
  
  it('should cache user', async () => {
    const user = await service.findById('123');
    const cached = await cache.get('user:123');
    
    expect(cached).toEqual(user);
  });
});
```

## Error Handling

```typescript
@Injectable()
export class ResilientService {
  @TurboCache({
    key: 'data:#{id}',
    fallback: true,
    onError: 'log'
  })
  async getData(id: string): Promise<Data> {
    try {
      return await this.api.fetch(id);
    } catch (error) {
      // Return stale cache on error
      const stale = await this.cache.getStale(`data:${id}`);
      if (stale) return stale;
      throw error;
    }
  }
}
```
