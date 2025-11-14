# Cache Warming Guide

## Overview

**Cache warming** is the process of pre-loading frequently accessed data into the cache before it's actually requested by users. This eliminates the "cold start" problem where the first requests after deployment experience slow response times due to cache misses.

TurboCache-JS provides **full support** for cache warming with multiple strategies.

---

## Why Cache Warming?

### Without Cache Warming ❌
```
Deployment → Cold Cache → First Requests → Cache Misses → Slow Responses → Poor UX
```

### With Cache Warming ✅
```
Deployment → Warm Cache → First Requests → Cache Hits → Fast Responses → Great UX
```

### Benefits
- **Zero cold start delay** - Users get fast responses immediately
- **Consistent performance** - No performance degradation after deployments
- **Reduced database load** - Prevent thundering herd on startup
- **Better user experience** - Sub-millisecond responses from the start

---

## Warming Strategies

### 1. On-Startup Warming (Most Common)

Pre-load cache when the application starts.

```typescript
@Injectable()
export class CacheWarmingService implements OnModuleInit {
  constructor(
    @InjectCache() private cache: CacheManager,
    private userService: UserService,
    private productService: ProductService
  ) {}
  
  async onModuleInit() {
    console.log('Starting cache warming...');
    await this.warmCache();
    console.log('Cache warming completed!');
  }
  
  private async warmCache() {
    await Promise.all([
      this.warmPopularUsers(),
      this.warmPopularProducts(),
      this.warmStaticData()
    ]);
  }
  
  private async warmPopularUsers() {
    // Get top 100 most accessed users
    const users = await this.userService.getPopularUsers(100);
    
    for (const user of users) {
      await this.cache.set(`user:${user.id}`, user, 3600);
    }
    
    console.log(`Warmed ${users.length} users`);
  }
  
  private async warmPopularProducts() {
    // Get featured products
    const products = await this.productService.getFeaturedProducts();
    
    for (const product of products) {
      await this.cache.set(`product:${product.id}`, product, 7200);
    }
    
    console.log(`Warmed ${products.length} products`);
  }
  
  private async warmStaticData() {
    // Warm static/reference data
    const categories = await this.productService.getCategories();
    await this.cache.set('categories:all', categories, 86400);
    
    console.log('Warmed static data');
  }
}
```

**Register in your module:**
```typescript
@Module({
  providers: [
    CacheWarmingService,
    UserService,
    ProductService
  ]
})
export class AppModule {}
```

---

### 2. Scheduled Background Refresh

Refresh cache periodically to keep it fresh.

```typescript
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CacheRefreshService {
  constructor(
    @InjectCache() private cache: CacheManager,
    private analyticsService: AnalyticsService
  ) {}
  
  // Refresh every 5 minutes
  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshCache() {
    await this.refreshHotData();
  }
  
  // Refresh every hour
  @Cron(CronExpression.EVERY_HOUR)
  async refreshHourlyData() {
    await this.refreshAggregates();
  }
  
  // Refresh daily at 2 AM
  @Cron('0 2 * * *')
  async refreshDailyData() {
    await this.refreshReports();
  }
  
  private async refreshHotData() {
    // Get trending items from analytics
    const trending = await this.analyticsService.getTrendingItems();
    
    for (const item of trending) {
      await this.cache.set(
        `trending:${item.id}`,
        item,
        600 // Short TTL, refreshed frequently
      );
    }
  }
  
  private async refreshAggregates() {
    const stats = await this.analyticsService.getStats();
    await this.cache.set('stats:global', stats, 3600);
  }
  
  private async refreshReports() {
    const report = await this.analyticsService.generateDailyReport();
    await this.cache.set('report:daily', report, 86400);
  }
}
```

**Setup:**
```typescript
@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [CacheRefreshService]
})
export class AppModule {}
```

---

### 3. Predictive Warming

Warm cache based on access patterns and analytics.

```typescript
@Injectable()
export class PredictiveCacheWarmer {
  constructor(
    @InjectCache() private cache: CacheManager,
    private analyticsService: AnalyticsService,
    private userService: UserService
  ) {}
  
  async warmBasedOnAccessPatterns() {
    // Get most accessed items from last 24 hours
    const accessLog = await this.analyticsService.getAccessLog(24);
    
    // Group by resource type
    const grouped = this.groupByType(accessLog);
    
    // Warm top accessed items
    await Promise.all([
      this.warmTopUsers(grouped.users),
      this.warmTopProducts(grouped.products),
      this.warmTopPages(grouped.pages)
    ]);
  }
  
  private async warmTopUsers(userIds: string[]) {
    // Warm top 50 users
    const topUsers = userIds.slice(0, 50);
    
    const users = await this.userService.findByIds(topUsers);
    
    for (const user of users) {
      await this.cache.set(`user:${user.id}`, user, 3600);
    }
  }
  
  async warmForTimeOfDay() {
    const hour = new Date().getHours();
    
    // Different data during business hours vs off-hours
    if (hour >= 9 && hour <= 17) {
      await this.warmBusinessHoursData();
    } else {
      await this.warmOffHoursData();
    }
  }
  
  private async warmBusinessHoursData() {
    // Warm dashboards, reports, etc.
    console.log('Warming business hours data...');
  }
  
  private async warmOffHoursData() {
    // Warm batch processing results, etc.
    console.log('Warming off-hours data...');
  }
}
```

---

### 4. On-Demand Warming

Warm specific cache entries on demand (e.g., admin trigger).

```typescript
@Controller('admin/cache')
export class CacheAdminController {
  constructor(
    @InjectCache() private cache: CacheManager,
    private cacheWarmer: CacheWarmingService
  ) {}
  
  @Post('warm')
  async warmCache(@Body() dto: WarmCacheDto) {
    switch (dto.type) {
      case 'users':
        await this.cacheWarmer.warmPopularUsers();
        break;
      case 'products':
        await this.cacheWarmer.warmPopularProducts();
        break;
      case 'all':
        await this.cacheWarmer.warmCache();
        break;
    }
    
    return { success: true, message: 'Cache warmed' };
  }
  
  @Post('warm/specific')
  async warmSpecific(@Body() dto: WarmSpecificDto) {
    // Warm specific entities
    for (const id of dto.ids) {
      const entity = await this.fetchEntity(dto.type, id);
      await this.cache.set(`${dto.type}:${id}`, entity, 3600);
    }
    
    return { success: true, warmed: dto.ids.length };
  }
  
  @Get('stats')
  async getCacheStats() {
    const stats = await this.cache.stats();
    return stats;
  }
}
```

---

### 5. Progressive Warming

Warm cache gradually to avoid overwhelming the database.

```typescript
@Injectable()
export class ProgressiveCacheWarmer {
  constructor(
    @InjectCache() private cache: CacheManager,
    private userService: UserService
  ) {}
  
  async warmProgressively() {
    const totalUsers = await this.userService.count();
    const batchSize = 100;
    const delayMs = 1000; // 1 second between batches
    
    console.log(`Starting progressive warming for ${totalUsers} users...`);
    
    for (let offset = 0; offset < totalUsers; offset += batchSize) {
      await this.warmBatch(offset, batchSize);
      
      // Delay between batches to avoid DB overload
      await this.sleep(delayMs);
      
      console.log(`Warmed ${Math.min(offset + batchSize, totalUsers)}/${totalUsers}`);
    }
    
    console.log('Progressive warming completed!');
  }
  
  private async warmBatch(offset: number, limit: number) {
    const users = await this.userService.findAll({ offset, limit });
    
    // Warm in parallel within batch
    await Promise.all(
      users.map(user =>
        this.cache.set(`user:${user.id}`, user, 3600)
      )
    );
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## Best Practices

### 1. **Warm Only Hot Data**
Don't warm everything—focus on frequently accessed data.

```typescript
// ✅ Good - Warm top 100 users
await this.warmTopUsers(100);

// ❌ Bad - Warm all million users
await this.warmAllUsers();
```

### 2. **Use Appropriate TTLs**
Set reasonable expiration times based on data volatility.

```typescript
// Static data - long TTL
await this.cache.set('categories', categories, 86400); // 24 hours

// Frequently changing - short TTL
await this.cache.set('stock:levels', stock, 300); // 5 minutes

// User data - medium TTL
await this.cache.set('user:123', user, 3600); // 1 hour
```

### 3. **Warm in Parallel**
Use `Promise.all()` for faster warming.

```typescript
// ✅ Good - Parallel warming
await Promise.all([
  this.warmUsers(),
  this.warmProducts(),
  this.warmCategories()
]);

// ❌ Bad - Sequential warming
await this.warmUsers();
await this.warmProducts();
await this.warmCategories();
```

### 4. **Monitor Warming Progress**
Log warming progress for visibility.

```typescript
async warmCache() {
  const start = Date.now();
  console.log('[CacheWarmer] Starting...');
  
  await this.warmPopularData();
  
  const duration = Date.now() - start;
  console.log(`[CacheWarmer] Completed in ${duration}ms`);
}
```

### 5. **Handle Errors Gracefully**
Don't let warming failures crash the application.

```typescript
async warmCache() {
  try {
    await this.warmPopularUsers();
  } catch (error) {
    console.error('Failed to warm users:', error);
    // Continue with other warming tasks
  }
  
  try {
    await this.warmPopularProducts();
  } catch (error) {
    console.error('Failed to warm products:', error);
  }
}
```

### 6. **Use Health Checks**
Indicate when warming is complete.

```typescript
@Injectable()
export class CacheWarmingService implements OnModuleInit {
  private warmingComplete = false;
  
  async onModuleInit() {
    await this.warmCache();
    this.warmingComplete = true;
  }
  
  isReady(): boolean {
    return this.warmingComplete;
  }
}

@Controller('health')
export class HealthController {
  constructor(private warmer: CacheWarmingService) {}
  
  @Get()
  check() {
    return {
      status: this.warmer.isReady() ? 'ready' : 'warming',
      cache: this.warmer.isReady() ? 'warm' : 'cold'
    };
  }
}
```

---

## Complete Example: E-Commerce Application

```typescript
@Injectable()
export class EcommerceCacheWarmer implements OnModuleInit {
  private readonly logger = new Logger(EcommerceCacheWarmer.name);
  
  constructor(
    @InjectCache() private cache: CacheManager,
    private productService: ProductService,
    private categoryService: CategoryService,
    private promotionService: PromotionService,
    private analyticsService: AnalyticsService
  ) {}
  
  async onModuleInit() {
    this.logger.log('🔥 Starting cache warming...');
    const startTime = Date.now();
    
    try {
      await this.warmEssentialData();
      
      const duration = Date.now() - startTime;
      this.logger.log(`✅ Cache warming completed in ${duration}ms`);
    } catch (error) {
      this.logger.error('❌ Cache warming failed:', error);
    }
  }
  
  private async warmEssentialData() {
    // Warm in parallel for speed
    await Promise.all([
      this.warmCategories(),
      this.warmFeaturedProducts(),
      this.warmActivePromotions(),
      this.warmBestsellers(),
      this.warmHomepage()
    ]);
  }
  
  private async warmCategories() {
    const categories = await this.categoryService.findAll();
    await this.cache.set('categories:all', categories, 86400); // 24h
    this.logger.log(`Warmed ${categories.length} categories`);
  }
  
  private async warmFeaturedProducts() {
    const featured = await this.productService.getFeatured();
    
    // Cache both the list and individual products
    await this.cache.set('products:featured', featured, 3600);
    
    for (const product of featured) {
      await this.cache.set(`product:${product.id}`, product, 7200);
    }
    
    this.logger.log(`Warmed ${featured.length} featured products`);
  }
  
  private async warmActivePromotions() {
    const promotions = await this.promotionService.getActive();
    await this.cache.set('promotions:active', promotions, 1800); // 30min
    this.logger.log(`Warmed ${promotions.length} promotions`);
  }
  
  private async warmBestsellers() {
    // Get top 50 bestsellers from analytics
    const bestsellers = await this.analyticsService.getBestsellers(50);
    const products = await this.productService.findByIds(bestsellers);
    
    for (const product of products) {
      await this.cache.set(`product:${product.id}`, product, 3600);
    }
    
    this.logger.log(`Warmed ${products.length} bestsellers`);
  }
  
  private async warmHomepage() {
    // Pre-render homepage data
    const homepage = await this.buildHomepageData();
    await this.cache.set('homepage:data', homepage, 1800);
    this.logger.log('Warmed homepage data');
  }
  
  private async buildHomepageData() {
    return {
      hero: await this.productService.getHeroProducts(),
      newArrivals: await this.productService.getNewArrivals(10),
      trending: await this.analyticsService.getTrending(10),
      deals: await this.promotionService.getTopDeals()
    };
  }
}
```

---

## Testing Cache Warming

```typescript
describe('CacheWarmingService', () => {
  let service: CacheWarmingService;
  let cache: CacheManager;
  let userService: UserService;
  
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [
        TurboCacheModule.register({
          stores: [{
            name: 'default',
            type: 'memory',
            primary: { type: 'memory' }
          }]
        })
      ],
      providers: [
        CacheWarmingService,
        {
          provide: UserService,
          useValue: {
            getPopularUsers: jest.fn().mockResolvedValue([
              { id: '1', name: 'User 1' },
              { id: '2', name: 'User 2' }
            ])
          }
        }
      ]
    }).compile();
    
    service = module.get(CacheWarmingService);
    cache = module.get('CACHE_MANAGER');
    userService = module.get(UserService);
  });
  
  it('should warm user cache on startup', async () => {
    await service.onModuleInit();
    
    // Verify cache was populated
    const user1 = await cache.get('user:1');
    const user2 = await cache.get('user:2');
    
    expect(user1).toBeDefined();
    expect(user2).toBeDefined();
    expect(userService.getPopularUsers).toHaveBeenCalled();
  });
  
  it('should handle warming errors gracefully', async () => {
    jest.spyOn(userService, 'getPopularUsers')
      .mockRejectedValue(new Error('DB Error'));
    
    // Should not throw
    await expect(service.onModuleInit()).resolves.not.toThrow();
  });
});
```

---

## Summary

### Cache Warming in TurboCache-JS:

✅ **Fully Supported** - Multiple warming strategies available  
✅ **On-Startup Warming** - Use `OnModuleInit` lifecycle hook  
✅ **Scheduled Refresh** - Use `@Cron` decorators  
✅ **Predictive Warming** - Based on analytics and patterns  
✅ **Progressive Warming** - Batch processing to avoid DB overload  
✅ **On-Demand Warming** - Admin-triggered via API endpoints  

### Quick Start:

```typescript
@Injectable()
export class MyCacheWarmer implements OnModuleInit {
  constructor(@InjectCache() private cache: CacheManager) {}
  
  async onModuleInit() {
    await this.warmCache();
  }
  
  private async warmCache() {
    // Your warming logic here
    await this.cache.set('key', 'value', 3600);
  }
}
```

**Cache warming is production-ready and recommended for all high-traffic applications!**

---

*Document Version: 1.0*  
*Last Updated: Nov 2024*
