/**
 * Basic TurboCache usage example
 */

import { CacheManager } from '../src/core/cache-manager';
import { MemoryAdapter } from '../src/adapters/memory-adapter';
import { TurboCache, TurboCacheEvict, TurboCachePut, setGlobalCacheManager } from '../src';

// 1. Setup cache manager
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

// Set global cache manager for decorators
setGlobalCacheManager(cacheManager);

// 2. Example service using decorators
class UserService {
  private users: Map<string, any> = new Map([
    ['1', { id: '1', name: 'Alice', email: 'alice@example.com' }],
    ['2', { id: '2', name: 'Bob', email: 'bob@example.com' }],
  ]);

  /**
   * Get user by ID - cached for 1 hour
   */
  @TurboCache({ key: 'user:#{id}', ttl: 3600 })
  async getUser(id: string) {
    console.log(`[DB] Fetching user ${id}`);
    return this.users.get(id) || null;
  }

  /**
   * Get all users - cached for 5 minutes
   */
  @TurboCache({ key: 'users:all', ttl: 300 })
  async getAllUsers() {
    console.log('[DB] Fetching all users');
    return Array.from(this.users.values());
  }

  /**
   * Update user - invalidates cache
   */
  @TurboCacheEvict({ key: 'user:#{id}' })
  async updateUser(id: string, data: Partial<any>) {
    console.log(`[DB] Updating user ${id}`);
    const user = this.users.get(id);
    if (user) {
      this.users.set(id, { ...user, ...data });
    }
    return this.users.get(id);
  }

  /**
   * Create user - updates cache
   */
  @TurboCachePut({ key: 'user:#{result.id}' })
  async createUser(data: any) {
    console.log('[DB] Creating user');
    const id = String(this.users.size + 1);
    const user = { id, ...data };
    this.users.set(id, user);
    return user;
  }

  /**
   * Delete user - invalidates cache
   */
  @TurboCacheEvict({ key: 'user:#{id}' })
  async deleteUser(id: string) {
    console.log(`[DB] Deleting user ${id}`);
    this.users.delete(id);
  }
}

// 3. Demo
async function demo() {
  const service = new UserService();

  console.log('\n=== Demo: TurboCache-JS ===\n');

  // First call - cache miss
  console.log('1. Get user (cache miss)');
  await service.getUser('1');

  // Second call - cache hit (no DB query)
  console.log('\n2. Get user again (cache hit)');
  await service.getUser('1');

  // Get all users - cache miss
  console.log('\n3. Get all users (cache miss)');
  await service.getAllUsers();

  // Update user - invalidates cache
  console.log('\n4. Update user (invalidates cache)');
  await service.updateUser('1', { name: 'Alice Updated' });

  // Get user after update - cache miss
  console.log('\n5. Get user after update (cache miss)');
  const user = await service.getUser('1');
  console.log('Updated user:', user);

  // Create new user - updates cache
  console.log('\n6. Create new user (updates cache)');
  const newUser = await service.createUser({ name: 'Charlie', email: 'charlie@example.com' });
  console.log('Created user:', newUser);

  // Get newly created user - cache hit
  console.log('\n7. Get newly created user (cache hit)');
  await service.getUser(newUser.id);

  // Manual cache operations
  console.log('\n8. Manual cache operations');
  await cacheManager.set('custom:key', { value: 'test' }, 60);
  const value = await cacheManager.get('custom:key');
  console.log('Retrieved from cache:', value);

  // Cache statistics
  console.log('\n9. Cache statistics');
  const stats = await cacheManager.stats();
  console.log('Stats:', stats);

  console.log('\n=== Demo Complete ===\n');
}

// Run demo
demo().catch(console.error);
