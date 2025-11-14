/**
 * Example: Cache Metadata Feature
 * Shows how to use includeMetadata option to track cache hits/misses
 */

import { CacheManager } from '../src/core/cache-manager';
import { MemoryAdapter } from '../src/adapters/memory-adapter';
import { TurboCache, setGlobalCacheManager } from '../src';

// Setup
const adapter = new MemoryAdapter({ max: 1000 });
const cacheManager = new CacheManager(adapter, {
  stores: [
    {
      name: 'default',
      type: 'memory',
      primary: { type: 'memory' },
    },
  ],
  defaultTTL: 3600,
});
setGlobalCacheManager(cacheManager);

// Example service with metadata
class UserService {
  private users = [
    { id: '1', name: 'Alice', email: 'alice@example.com' },
    { id: '2', name: 'Bob', email: 'bob@example.com' },
    { id: '3', name: 'Charlie', email: 'charlie@example.com' },
  ];

  /**
   * Get all users with cache metadata
   */
  @TurboCache({
    key: 'users:all',
    ttl: 300,
    includeMetadata: true, // Enable metadata
  })
  async findAll() {
    console.log('[DB] Fetching all users from database...');
    await new Promise((resolve) => setTimeout(resolve, 100));
    return this.users;
  }

  /**
   * Get user by ID with custom metadata key
   */
  @TurboCache({
    key: 'user:#{id}',
    ttl: 300,
    includeMetadata: true,
    metadataKey: '_cacheInfo', // Custom key name
  })
  async findById(id: string) {
    console.log(`[DB] Fetching user ${id} from database...`);
    await new Promise((resolve) => setTimeout(resolve, 50));
    return this.users.find((u) => u.id === id) || null;
  }

  /**
   * Get user count - primitive return value
   */
  @TurboCache({
    key: 'users:count',
    ttl: 300,
    includeMetadata: true,
  })
  async getCount() {
    console.log('[DB] Counting users...');
    return this.users.length;
  }
}

// Demo
async function demo() {
  const service = new UserService();

  console.log('=== Cache Metadata Example ===\n');

  // Example 1: Array result with metadata
  console.log('1. First call - Cache MISS');
  const result1 = await service.findAll();
  console.log('Result:', JSON.stringify(result1, null, 2));
  console.log('\n');

  console.log('2. Second call - Cache HIT');
  const result2 = await service.findAll();
  console.log('Result:', JSON.stringify(result2, null, 2));
  console.log('\n');

  // Example 2: Object result with custom metadata key
  console.log('3. Get user with custom metadata key - Cache MISS');
  const user1 = await service.findById('1');
  console.log('Result:', JSON.stringify(user1, null, 2));
  console.log('\n');

  console.log('4. Get same user - Cache HIT');
  const user2 = await service.findById('1');
  console.log('Result:', JSON.stringify(user2, null, 2));
  console.log('\n');

  // Example 3: Primitive result wrapped in object
  console.log('5. Get count (primitive) - Cache MISS');
  const count1 = await service.getCount();
  console.log('Result:', JSON.stringify(count1, null, 2));
  console.log('\n');

  console.log('6. Get count again - Cache HIT');
  const count2 = await service.getCount();
  console.log('Result:', JSON.stringify(count2, null, 2));
  console.log('\n');

  // Example 4: Accessing metadata programmatically
  console.log('7. Using metadata programmatically');
  const result = await service.findAll();
  
  // @ts-ignore - metadata is dynamically added
  if (result.__cache__) {
    // @ts-ignore
    const { hit, key, timestamp } = result.__cache__;
    console.log(`Cache ${hit ? 'HIT' : 'MISS'} for key: ${key}`);
    console.log(`Timestamp: ${new Date(timestamp).toISOString()}`);
    
    // Filter out metadata for business logic
    // @ts-ignore
    const { __cache__, ...data } = result;
    console.log(`Data has ${data.length} items`);
  }

  console.log('\n=== Demo Complete ===');
}

// Run demo
demo().catch(console.error);

/**
 * Example outputs:
 * 
 * Cache MISS:
 * {
 *   "0": { "id": "1", "name": "Alice", "email": "alice@example.com" },
 *   "1": { "id": "2", "name": "Bob", "email": "bob@example.com" },
 *   "2": { "id": "3", "name": "Charlie", "email": "charlie@example.com" },
 *   "__cache__": {
 *     "hit": false,
 *     "key": "users:all",
 *     "timestamp": 1699876543210
 *   }
 * }
 * 
 * Cache HIT:
 * {
 *   "0": { "id": "1", "name": "Alice", "email": "alice@example.com" },
 *   "1": { "id": "2", "name": "Bob", "email": "bob@example.com" },
 *   "2": { "id": "3", "name": "Charlie", "email": "charlie@example.com" },
 *   "__cache__": {
 *     "hit": true,
 *     "key": "users:all",
 *     "timestamp": 1699876543250
 *   }
 * }
 * 
 * Primitive wrapped:
 * {
 *   "value": 3,
 *   "__cache__": {
 *     "hit": false,
 *     "key": "users:count",
 *     "timestamp": 1699876543300
 *   }
 * }
 */
