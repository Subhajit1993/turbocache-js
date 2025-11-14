/**
 * TurboCache-JS
 * High-performance, intelligent caching library for TypeScript/NestJS microservices
 */

// Core exports
export * from './core/interfaces';
export * from './core/cache-manager';

// Decorators
export * from './decorators';

// Adapters
export * from './adapters';

// Modules (NestJS)
export * from './modules/turbocache.module';

// Factory
export { createAdapter } from './factory/adapter-factory';

// Utils
export * from './utils';
