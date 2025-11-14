import { ICacheAdapter, StoreConfig } from '../core/interfaces';
import { MemoryAdapter } from '../adapters/memory-adapter';
import { KeyvAdapter } from '../adapters/keyv-adapter';
import { MultiTierAdapter } from '../adapters/multi-tier-adapter';

/**
 * Create cache adapter based on configuration
 * This factory abstracts away the complexity of adapter selection
 * Consumers never need to know about Keyv, Cacheable, or internal implementations
 */
export function createAdapter(store: StoreConfig): ICacheAdapter {
  if (store.type === 'multi-tier') {
    return createMultiTierAdapter(store);
  }

  return createSingleTierAdapter(store);
}

/**
 * Create single-tier adapter
 */
function createSingleTierAdapter(store: StoreConfig): ICacheAdapter {
  const backend = store.primary;

  if (!backend) {
    throw new Error(`Store "${store.name}" missing primary backend configuration`);
  }

  switch (backend.type) {
    case 'memory':
      return new MemoryAdapter(backend.options || {});

    case 'redis':
      // Internally uses Keyv - consumers don't need to know
      return new KeyvAdapter({
        uri: backend.uri,
        namespace: store.name,
        ttl: (backend.ttl || store.ttl || 3600) * 1000, // Convert to ms
        ...backend.options,
      });

    case 'mongodb':
      // Internally uses Keyv with MongoDB store
      return new KeyvAdapter({
        uri: backend.uri,
        namespace: store.name,
        ttl: (backend.ttl || store.ttl || 3600) * 1000,
        ...backend.options,
      });

    case 'postgresql':
      // Internally uses Keyv with PostgreSQL store
      return new KeyvAdapter({
        uri: backend.uri,
        namespace: store.name,
        ttl: (backend.ttl || store.ttl || 3600) * 1000,
        ...backend.options,
      });

    default:
      throw new Error(`Unsupported storage type: ${backend.type}`);
  }
}

/**
 * Create multi-tier adapter (L1 + L2)
 */
function createMultiTierAdapter(store: StoreConfig): ICacheAdapter {
  if (!store.primary || !store.secondary) {
    throw new Error('Multi-tier cache requires both primary and secondary backends');
  }

  // Create L1 (fast local cache)
  const l1 = createSingleTierAdapter({
    name: `${store.name}-l1`,
    type: store.primary.type as any,
    primary: store.primary,
    ttl: store.primary.ttl,
  });

  // Create L2 (distributed cache)
  const l2 = createSingleTierAdapter({
    name: `${store.name}-l2`,
    type: store.secondary.type as any,
    primary: store.secondary,
    ttl: store.secondary.ttl,
  });

  return new MultiTierAdapter({
    l1,
    l2,
    l1TTL: store.primary.ttl || 300,
    l2TTL: store.secondary.ttl || 3600,
  });
}
