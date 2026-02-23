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
import { getTeamPositions } from "@/lib/clients/apiFootball";
import { prisma } from "@/lib/prisma";

/**
 * Derives the API-Football season year from a kickoff date.
 * The Premier League season starts in August, so Aug–Dec belongs to that
 * calendar year and Jan–Jul belongs to the previous year's season.
 * e.g. kickoff in Jan 2026 → season 2025 (the 2025/26 season).
 */
function seasonFromKickoff(kickoffIso: string): number {
  const d = new Date(kickoffIso);
  return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
}

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

  // Fetch current league standings for the table-position fallback (§5.3).
  // Failures are non-fatal: 0/0 positions still pass through to getUnderdogSide,
  // which will then find no underdog — a safe conservative outcome.
  let homePosition = 0;
  let awayPosition = 0;
  try {
    const season = seasonFromKickoff(job.data.kickoff);
    const positions = await getTeamPositions(season);
    homePosition = positions[homeTeam] ?? 0;
    awayPosition = positions[awayTeam] ?? 0;
    job.log(`Standings: ${homeTeam}=${homePosition}, ${awayTeam}=${awayPosition} (season ${season})`);
  } catch (err) {
    console.warn("[underdog-lock] Failed to fetch standings for fallback:", (err as Error).message);
  }

  // Determine underdog — Odds API primary, table-position fallback
  const result = await getUnderdogSide(homeTeam, awayTeam, externalId, homePosition, awayPosition);

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
