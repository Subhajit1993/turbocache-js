/**
 * NestJS integration example
 */

import { Module, Injectable, Controller, Get, Post, Param, Body, Inject } from '@nestjs/common';
import { TurboCacheModule, TurboCache, TurboCacheEvict, CacheManager } from '../src';

// 1. Configure TurboCache Module
@Module({
  imports: [
    TurboCacheModule.register({
      stores: [
        {
          name: 'default',
          type: 'memory',
          primary: {
            type: 'memory',
            options: { max: 1000 },
          },
          ttl: 3600,
        },
      ],
      namespace: 'myapp',
      enableMetrics: true,
    }),
  ],
  controllers: [UserController],
  providers: [UserService],
})
export class AppModule {}

// 2. Create service with caching
@Injectable()
export class UserService {
  private users: Map<string, any> = new Map([
    ['1', { id: '1', name: 'Alice', email: 'alice@example.com' }],
    ['2', { id: '2', name: 'Bob', email: 'bob@example.com' }],
  ]);

  @TurboCache({ key: 'user:#{id}', ttl: 3600 })
  async findById(id: string) {
    console.log(`[DB] Fetching user ${id}`);
    // Simulate database delay
    await new Promise((resolve) => setTimeout(resolve, 100));
    return this.users.get(id) || null;
  }

  @TurboCache({ key: 'users:all', ttl: 300 })
  async findAll() {
    console.log('[DB] Fetching all users');
    await new Promise((resolve) => setTimeout(resolve, 100));
    return Array.from(this.users.values());
  }

  @TurboCacheEvict({ key: 'user:#{id}' })
  async update(id: string, data: Partial<any>) {
    console.log(`[DB] Updating user ${id}`);
    const user = this.users.get(id);
    if (user) {
      this.users.set(id, { ...user, ...data });
    }
    return this.users.get(id);
  }

  @TurboCacheEvict({ key: 'user:#{id}' })
  async remove(id: string) {
    console.log(`[DB] Deleting user ${id}`);
    this.users.delete(id);
    return { deleted: true };
  }
}

// 3. Create controller
@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    @Inject('CACHE_MANAGER') private readonly cache: CacheManager, // Optional: direct cache access
  ) {}

  @Get()
  async findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Post(':id')
  async update(@Param('id') id: string, @Body() data: any) {
    return this.userService.update(id, data);
  }
}

/**
 * To use this example:
 * 
 * 1. Create a NestJS app:
 *    npm i -g @nestjs/cli
 *    nest new my-app
 * 
 * 2. Install TurboCache:
 *    npm install turbocache-js
 * 
 * 3. Import AppModule in your main.ts
 * 
 * 4. Start the app:
 *    npm run start
 * 
 * 5. Test endpoints:
 *    GET http://localhost:3000/users
 *    GET http://localhost:3000/users/1
 *    POST http://localhost:3000/users/1
 */
