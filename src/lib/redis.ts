import Redis from "ioredis";

function requireRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL environment variable is not set");
  return url;
}

/**
 * General-purpose Redis client for cache reads/writes.
 * Lazily initialised — safe to import without REDIS_URL set at module load time.
 * Not suitable for pub/sub subscribe — use createSubscriber() for that.
 */
const globalForRedis = globalThis as unknown as { redis: Redis };

export function getRedis(): Redis {
  if (globalForRedis.redis) return globalForRedis.redis;
  const client = new Redis(requireRedisUrl(), {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
  if (process.env.NODE_ENV !== "production") globalForRedis.redis = client;
  return client;
}

/** Convenience proxy — call-sites can use `redis.get(...)` as before. */
export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    return (getRedis() as never)[prop];
  },
});

/**
 * Creates a dedicated subscriber connection.
 * Redis subscribe mode blocks the connection for other commands,
 * so each subscriber must be its own client instance.
 */
export function createSubscriber(): Redis {
  return new Redis(requireRedisUrl(), {
    maxRetriesPerRequest: null, // retry forever for long-lived subscriber
  });
}

/**
 * Creates a dedicated publisher connection.
 * Separated from the main redis client to avoid connection contention.
 */
export function createPublisher(): Redis {
  return new Redis(requireRedisUrl(), {
    maxRetriesPerRequest: 3,
  });
}
