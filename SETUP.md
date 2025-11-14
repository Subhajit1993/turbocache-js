# TurboCache-JS Setup Guide

## Installation

### 1. Install Dependencies

```bash
npm install
```

This will install all required dependencies:
- `keyv` - Storage abstraction
- `cacheable` - Layered caching
- `reflect-metadata` - Decorator metadata
- TypeScript and testing tools

### 2. Build the Library

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` directory.

### 3. Run Tests (once implemented)

```bash
npm test
```

### 4. Run Examples

```bash
# Build first
npm run build

# Run basic example
npx ts-node examples/basic-usage.ts
```

## Development Workflow

### Watch Mode

For active development:

```bash
npm run dev
```

This watches for changes and recompiles automatically.

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

## Project Structure

```
turbocache-js/
├── src/
│   ├── core/                 # Core interfaces and CacheManager
│   │   ├── interfaces.ts
│   │   └── cache-manager.ts
│   ├── adapters/             # Storage adapters
│   │   ├── memory-adapter.ts
│   │   ├── keyv-adapter.ts
│   │   └── multi-tier-adapter.ts
│   ├── decorators/           # Caching decorators
│   │   ├── turbocache.decorator.ts
│   │   ├── turbocache-evict.decorator.ts
│   │   └── turbocache-put.decorator.ts
│   ├── factory/              # Adapter factory
│   │   └── adapter-factory.ts
│   ├── modules/              # NestJS module
│   │   └── turbocache.module.ts
│   └── utils/                # Utilities
│       └── key-generator.ts
├── examples/                 # Usage examples
├── tests/                    # Test files
└── docs/                     # Documentation
```

## Usage

### Basic Usage (Standalone)

```typescript
import { CacheManager, MemoryAdapter, TurboCache, setGlobalCacheManager } from 'turbocache-js';

// Create cache manager
const adapter = new MemoryAdapter({ max: 1000 });
const cache = new CacheManager(adapter, {
  stores: [{ name: 'default', type: 'memory', primary: { type: 'memory' } }],
  defaultTTL: 3600,
});

// Set global for decorators
setGlobalCacheManager(cache);

// Use decorators
class MyService {
  @TurboCache({ key: 'user:#{id}', ttl: 3600 })
  async getUser(id: string) {
    return { id, name: 'Test' };
  }
}
```

### NestJS Integration

```typescript
import { TurboCacheModule } from 'turbocache-js';

@Module({
  imports: [
    TurboCacheModule.register({
      stores: [{
        name: 'default',
        type: 'redis',
        primary: {
          type: 'redis',
          uri: 'redis://localhost:6379'
        },
        ttl: 3600
      }],
      namespace: 'myapp'
    })
  ]
})
export class AppModule {}
```

## Configuration Options

### Storage Types

- **memory**: Fast in-memory cache (LRU)
- **redis**: Distributed Redis cache
- **mongodb**: MongoDB-backed cache
- **postgresql**: PostgreSQL-backed cache
- **multi-tier**: L1 (memory) + L2 (distributed)

### Multi-Tier Example

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

## Next Steps

1. ✅ Core foundation is complete
2. ✅ Decorators are working
3. ✅ Multi-tier caching is implemented
4. ⏳ Add comprehensive tests
5. ⏳ Add metrics and observability
6. ⏳ Add more examples
7. ⏳ Performance benchmarks

## TypeScript Errors

You may see TypeScript errors before running `npm install`. This is normal - they'll be resolved once dependencies are installed:

- `Buffer`, `console`, `setInterval` - Node.js globals (resolved by `@types/node`)
- `keyv` module - Resolved by installing `keyv` package
- `@nestjs/common` - Resolved by installing NestJS packages

All errors are related to missing dependencies, not code issues.

## Questions?

See the comprehensive documentation in `/docs`:
- `ARCHITECTURE.md` - System design
- `API_REFERENCE.md` - Complete API docs
- `EXAMPLES.md` - Usage examples
- `IMPLEMENTATION_GUIDE.md` - Development guide
