import { DynamicModule, Module, Provider } from '@nestjs/common';
import { CacheConfig } from '../core/interfaces';
import { CacheManager } from '../core/cache-manager';
import { createAdapter } from '../factory/adapter-factory';

export interface TurboCacheModuleAsyncOptions {
  imports?: any[];
  useFactory?: (...args: any[]) => Promise<CacheConfig> | CacheConfig;
  inject?: any[];
  extraProviders?: Provider[];
}

/**
 * TurboCache NestJS Module
 * Provides caching functionality with dependency injection
 */
@Module({})
export class TurboCacheModule {
  /**
   * Register TurboCache synchronously
   * @param config - Cache configuration
   */
  static register(config: CacheConfig): DynamicModule {
    const providers = this.createProviders(config);

    return {
      module: TurboCacheModule,
      providers,
      exports: providers,
      global: true,
    };
  }

  /**
   * Register TurboCache asynchronously
   * Useful when config depends on other modules (e.g., ConfigModule)
   */
  static registerAsync(options: TurboCacheModuleAsyncOptions): DynamicModule {
    return {
      module: TurboCacheModule,
      imports: options.imports || [],
      providers: [
        ...this.createAsyncProviders(options),
        ...(options.extraProviders || []),
      ],
      exports: ['CACHE_MANAGER'],
      global: true,
    };
  }

  /**
   * Create providers for synchronous registration
   */
  private static createProviders(config: CacheConfig): Provider[] {
    return [
      {
        provide: 'CACHE_CONFIG',
        useValue: config,
      },
      {
        provide: 'CACHE_ADAPTER',
        useFactory: (cfg: CacheConfig) => {
          // Use first store as default
          return createAdapter(cfg.stores[0]);
        },
        inject: ['CACHE_CONFIG'],
      },
      {
        provide: 'CACHE_MANAGER',
        useFactory: (adapter: any, cfg: CacheConfig) => {
          return new CacheManager(adapter, cfg);
        },
        inject: ['CACHE_ADAPTER', 'CACHE_CONFIG'],
      },
    ];
  }

  /**
   * Create providers for asynchronous registration
   */
  private static createAsyncProviders(options: TurboCacheModuleAsyncOptions): Provider[] {
    return [
      {
        provide: 'CACHE_CONFIG',
        useFactory: options.useFactory!,
        inject: options.inject || [],
      },
      {
        provide: 'CACHE_ADAPTER',
        useFactory: (config: CacheConfig) => {
          return createAdapter(config.stores[0]);
        },
        inject: ['CACHE_CONFIG'],
      },
      {
        provide: 'CACHE_MANAGER',
        useFactory: (adapter: any, config: CacheConfig) => {
          return new CacheManager(adapter, config);
        },
        inject: ['CACHE_ADAPTER', 'CACHE_CONFIG'],
      },
    ];
  }
}

/**
 * Decorator for injecting CacheManager
 * For now, this is a simplified version. In NestJS, you can also use:
 * @Inject('CACHE_MANAGER') from @nestjs/common
 *
 * @example
 * ```typescript
 * constructor(@InjectCache() private cache: CacheManager) {}
 * ```
 * @param _name - Store name (reserved for future multi-store support)
 */
export function InjectCache(_name: string = 'default'): ParameterDecorator {
  return (target: object, _propertyKey: string | symbol | undefined, parameterIndex: number) => {
    // Mark this parameter for injection with the CACHE_MANAGER token
    const existingTokens: any[] = Reflect.getMetadata('design:paramtypes', target) || [];
    const injectionTokens: any[] = Reflect.getMetadata('self:paramtypes', target) || [];
    
    injectionTokens[parameterIndex] = 'CACHE_MANAGER';
    Reflect.defineMetadata('self:paramtypes', injectionTokens, target);
  };
}
