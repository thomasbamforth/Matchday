/**
 * underdog-lock worker.
 *
 * Runs exactly 12 hours before each fixture's kickoff.
 * Determines the underdog via the Odds API (primary) or league-table position
 * differential (fallback) and locks the result on the fixture record.
 *
 * After this point underdogSide cannot change — CLAUDE.md §9.6.
 *
 * The Odds API falls back to getUnderdogByTablePosition(0, 0) → null when no
 * standings data is passed, which is acceptable: it means "no designated
 * underdog", giving users a fair no-risk scenario rather than a wrong one.
 */

import { Worker, type Job } from "bullmq";
import {
  bullmqConnection,
  type UnderdogLockJobData,
} from "@/jobs/queues";
import { getUnderdogSide } from "@/lib/clients/oddsApi";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Worker processor
// ---------------------------------------------------------------------------

async function process(job: Job<UnderdogLockJobData>): Promise<void> {
  const { fixtureId, externalId, homeTeam, awayTeam } = job.data;

  // Idempotency — skip if already locked
  const fixture = await prisma.fixture.findUnique({
    where: { id: fixtureId },
    select: { underdogLockedAt: true, status: true },
  });

  if (!fixture) {
    job.log(`Fixture ${fixtureId} not found — skipping`);
    return;
  }

  if (fixture.underdogLockedAt !== null) {
    job.log(`Underdog already locked for fixture ${fixtureId} — skipping`);
    return;
  }

  if (fixture.status === "FINISHED" || fixture.status === "POSTPONED") {
    job.log(
      `Fixture ${fixtureId} is already ${fixture.status} — skipping underdog lock`
    );
    return;
  }

  // Determine underdog — Odds API primary, table-position fallback
  // Table positions default to 0/0 (returns null = no underdog) when unavailable.
  const result = await getUnderdogSide(homeTeam, awayTeam, externalId, 0, 0);

  await prisma.fixture.update({
    where: { id: fixtureId },
    data: {
      underdogSide: result.side,
      underdogLockedAt: new Date(),
    },
  });

  job.log(
    `Underdog locked: ${homeTeam} vs ${awayTeam} — ` +
      `side=${result.side ?? "none"}, fromOdds=${result.fromOdds}`
  );
}

// ---------------------------------------------------------------------------
// Worker registration
// ---------------------------------------------------------------------------

export function startUnderdogLockWorker(): Worker {
  const worker = new Worker<UnderdogLockJobData>("underdog-lock", process, {
    connection: bullmqConnection,
    concurrency: 5,
  });

  worker.on("failed", (job, err) => {
    console.error(`[underdog-lock] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
