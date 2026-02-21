/**
 * BullMQ queue definitions.
 * Queues are created once and shared across the app.
 * Workers are registered separately in src/jobs/workers/.
 */

import { Queue } from "bullmq";
import IORedis from "ioredis";

if (!process.env.REDIS_URL) {
  throw new Error("REDIS_URL environment variable is not set");
}

// BullMQ requires its own Redis connection (not shared with pub/sub)
const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null, // required by BullMQ
});

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

export { connection as bullmqConnection };
