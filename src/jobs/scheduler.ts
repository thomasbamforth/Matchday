/**
 * BullMQ scheduler.
 *
 * Registers the repeatable fixture-sync job that runs every 60 seconds.
 * The worker itself decides whether to do a full sync or skip based on
 * whether we're inside an active match window.
 *
 * Call startScheduler() once at server startup.
 */

import { fixtureSyncQueue } from "@/jobs/queues";

const POLL_INTERVAL_MS = 60_000; // 60s

export async function startScheduler(
  gameweekNumber: number,
  season: number
): Promise<void> {
  // Clear any stale repeatable jobs before registering a fresh one
  const repeatableJobs = await fixtureSyncQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await fixtureSyncQueue.removeRepeatableByKey(job.key);
  }

  await fixtureSyncQueue.add(
    "fixture-sync" as string,
    { gameweekNumber, season },
    {
      repeat: { every: POLL_INTERVAL_MS },
      jobId: `fixture-sync-gw${gameweekNumber}`, // stable ID prevents duplicates
    }
  );

  console.log(
    `[scheduler] fixture-sync registered — GW${gameweekNumber}, every ${POLL_INTERVAL_MS / 1000}s`
  );
}
