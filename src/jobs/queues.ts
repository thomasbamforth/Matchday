/**
 * BullMQ queue definitions.
 * Queues are created once and shared across the app.
 * Workers are registered separately in src/jobs/workers/.
 */

import { Queue } from "bullmq";

// BullMQ bundles its own ioredis — passing an IORedis instance from the top-level
// package causes a structural type conflict. Instead pass a plain options object;
// BullMQ will create its own IORedis instance using its bundled copy.
function parseRedisConnection(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 6379,
    ...(u.password && { password: decodeURIComponent(u.password) }),
    maxRetriesPerRequest: null as null, // required by BullMQ
  };
}

const connection = parseRedisConnection(
  process.env.REDIS_URL ?? "redis://localhost:6379"
);

// ---------------------------------------------------------------------------
// Job data types
// ---------------------------------------------------------------------------

export interface FixtureSyncJobData {
  gameweekNumber: number;
  season: number;
  force?: boolean; // skip active-window check
}

export interface ScoreUpdateJobData {
  fixtureId: string;
  gameweekId: number;
}

export interface AiRecapJobData {
  gameweekId: number;
  leagueId: string;
}

export interface UnderdogLockJobData {
  fixtureId: string;    // DB fixture ID
  externalId: string;   // API-Football fixture ID (used for Odds API lookup)
  homeTeam: string;     // nickname — for logging
  awayTeam: string;     // nickname — for logging
  kickoff: string;      // ISO string
}

// ---------------------------------------------------------------------------
// Queues
// ---------------------------------------------------------------------------

export const fixtureSyncQueue = new Queue<FixtureSyncJobData>("fixture-sync", {
  connection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const scoreUpdateQueue = new Queue<ScoreUpdateJobData>("score-update", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const aiRecapQueue = new Queue<AiRecapJobData>("ai-recap", {
  connection,
  defaultJobOptions: {
    // 3 retries with exponential backoff as specified in CLAUDE.md §9.9
    attempts: 3,
    backoff: { type: "exponential", delay: 10000 },
    removeOnComplete: 50,
    removeOnFail: 200,
  },
});

export const underdogLockQueue = new Queue<UnderdogLockJobData>("underdog-lock", {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export { connection as bullmqConnection };
