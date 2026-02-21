import Redis from "ioredis";

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL environment variable is not set");
}

/**
 * General-purpose Redis client for cache reads/writes.
 * Not suitable for pub/sub subscribe — use createSubscriber() for that.
 */
const globalForRedis = globalThis as unknown as { redis: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

/**
 * Creates a dedicated subscriber connection.
 * Redis subscribe mode blocks the connection for other commands,
 * so each subscriber must be its own client instance.
 */
export function createSubscriber(): Redis {
  return new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: null, // retry forever for long-lived subscriber
  });
}

/**
 * Creates a dedicated publisher connection.
 * Separated from the main redis client to avoid connection contention.
 */
export function createPublisher(): Redis {
  return new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: 3,
  });
}
