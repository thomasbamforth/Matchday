/**
 * fixture-sync worker.
 *
 * Polling behaviour per CLAUDE.md §6:
 *  - Every 60s during active match windows (45 min before first KO → 15 min after final whistle)
 *  - Once per day outside active windows
 *
 * On score changes, publishes to Redis pub/sub so connected clients get instant updates.
 */

import { Worker, type Job } from "bullmq";
import {
  bullmqConnection,
  scoreUpdateQueue,
  underdogLockQueue,
  type FixtureSyncJobData,
} from "@/jobs/queues";
import { getFixturesByGameweek } from "@/lib/clients/apiFootball";
import { redis, createPublisher } from "@/lib/redis";
import { LAST_DAILY_SYNC_KEY, SCORE_UPDATE_CHANNEL } from "@/lib/redisKeys";
import { prisma } from "@/lib/prisma";
import { sendGoalAlerts } from "@/lib/notifications";
import type { ScoreUpdateMessage } from "@/server/pubsubListener";

const DAILY_SYNC_INTERVAL_MS = 23 * 60 * 60 * 1000; // 23h (slight buffer)
const ACTIVE_WINDOW_PRE_KO_MS = 45 * 60 * 1000;     // 45 min before first KO
const ACTIVE_WINDOW_POST_FINAL_MS = 120 * 60 * 1000; // 120 min after last KO

const publisher = createPublisher();

// ---------------------------------------------------------------------------
// Active window detection
// ---------------------------------------------------------------------------

function isInActiveWindow(kickoffs: Date[]): boolean {
  if (kickoffs.length === 0) return false;
  const now = Date.now();
  const times = kickoffs.map((d) => d.getTime());
  const windowStart = Math.min(...times) - ACTIVE_WINDOW_PRE_KO_MS;
  const windowEnd = Math.max(...times) + ACTIVE_WINDOW_POST_FINAL_MS;
  return now >= windowStart && now <= windowEnd;
}

// ---------------------------------------------------------------------------
// Worker processor
// ---------------------------------------------------------------------------

async function process(job: Job<FixtureSyncJobData>): Promise<void> {
  const { gameweekNumber, season, force } = job.data;

  // Auto-create the Gameweek record if it hasn't been seeded yet.
  // Schema uses gameweek number as both id and number (no auto-increment).
  const gameweek = await prisma.gameweek.upsert({
    where: { number: gameweekNumber },
    create: { id: gameweekNumber, number: gameweekNumber, status: "UPCOMING" },
    update: {},
    include: { fixtures: { select: { kickoff: true } } },
  });

  const kickoffs = gameweek.fixtures.map((f) => f.kickoff);
  const inWindow = force || isInActiveWindow(kickoffs);

  if (!inWindow) {
    const lastSync = await redis.get(LAST_DAILY_SYNC_KEY);
    if (lastSync && Date.now() - Number(lastSync) < DAILY_SYNC_INTERVAL_MS) {
      job.log("Skipping — not in active window and daily sync is recent");
      return;
    }
  }

  const fixtures = await getFixturesByGameweek(gameweekNumber, season);

  for (const apiFixture of fixtures) {
    const existing = await prisma.fixture.findUnique({
      where: { externalId: apiFixture.externalId },
    });

    const updated = await prisma.fixture.upsert({
      where: { externalId: apiFixture.externalId },
      create: {
        externalId: apiFixture.externalId,
        gameweekId: gameweek!.id,
        homeTeam: apiFixture.homeTeam,
        awayTeam: apiFixture.awayTeam,
        kickoff: apiFixture.kickoff,
        status: apiFixture.status,
        homeScore: apiFixture.homeScore,
        awayScore: apiFixture.awayScore,
        postponed: apiFixture.status === "POSTPONED",
      },
      update: {
        status: apiFixture.status,
        homeScore: apiFixture.homeScore,
        awayScore: apiFixture.awayScore,
        postponed: apiFixture.status === "POSTPONED",
      },
    });

    // Publish score update if the score changed
    const scoreChanged =
      existing?.homeScore !== apiFixture.homeScore ||
      existing?.awayScore !== apiFixture.awayScore ||
      existing?.status !== apiFixture.status;

    if (scoreChanged) {
      const msg: ScoreUpdateMessage = {
        fixtureId: updated.id,
        homeTeam: updated.homeTeam,
        awayTeam: updated.awayTeam,
        homeScore: updated.homeScore,
        awayScore: updated.awayScore,
        status: updated.status as ScoreUpdateMessage["status"],
      };
      await publisher.publish(SCORE_UPDATE_CHANNEL, JSON.stringify(msg));
    }

    // Send goal alert push notifications when the actual score changes
    // (not just a status transition like UPCOMING→LIVE or LIVE→FINISHED)
    const goalScored =
      existing?.homeScore !== apiFixture.homeScore ||
      existing?.awayScore !== apiFixture.awayScore;

    if (goalScored && apiFixture.homeScore !== null && apiFixture.awayScore !== null) {
      const predictorIds = await prisma.prediction
        .findMany({ where: { fixtureId: updated.id }, select: { userId: true } })
        .then((rows) => rows.map((r) => r.userId));

      sendGoalAlerts(
        predictorIds,
        updated.homeTeam,
        updated.awayTeam,
        apiFixture.homeScore,
        apiFixture.awayScore,
        updated.id,
      ).catch((err) => console.warn("[fixture-sync] Goal alert failed:", err));
    }

    // Enqueue score-update job when a fixture transitions to FINISHED
    if (apiFixture.status === "FINISHED" && existing?.status !== "FINISHED") {
      await scoreUpdateQueue.add("score-update" as string, {
        fixtureId: updated.id,
        gameweekId: gameweek.id,
      });
    }

    // Schedule underdog-lock job for new upcoming fixtures (12h before kickoff).
    // jobId is stable so re-runs don't create duplicates.
    if (!existing && apiFixture.status === "UPCOMING") {
      const lockAt =
        apiFixture.kickoff.getTime() - 12 * 60 * 60 * 1000;
      const delay = lockAt - Date.now();

      if (delay > 0) {
        await underdogLockQueue.add(
          "underdog-lock" as string,
          {
            fixtureId: updated.id,
            externalId: apiFixture.externalId,
            homeTeam: apiFixture.homeTeam,
            awayTeam: apiFixture.awayTeam,
            kickoff: apiFixture.kickoff.toISOString(),
          },
          {
            delay,
            jobId: `underdog-lock-${apiFixture.externalId}`,
          }
        );
      }
    }
  }

  await redis.set(LAST_DAILY_SYNC_KEY, String(Date.now()));
}

// ---------------------------------------------------------------------------
// Worker registration
// ---------------------------------------------------------------------------

export function startFixtureSyncWorker(): Worker {
  const worker = new Worker<FixtureSyncJobData>("fixture-sync", process, {
    connection: bullmqConnection,
    concurrency: 1, // serialise — avoid simultaneous API calls
  });

  worker.on("failed", (job, err) => {
    console.error(`[fixture-sync] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
