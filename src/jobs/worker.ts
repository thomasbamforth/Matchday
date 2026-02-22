/**
 * Worker entry point.
 *
 * Run with:   npm run workers
 * In dev:     npm run workers:dev
 *
 * This process registers all BullMQ workers and the repeatable scheduler.
 * It is separate from the Next.js server so it can be deployed independently
 * on Railway/Render as a background worker service.
 */

import { startFixtureSyncWorker } from "@/jobs/workers/fixtureSync";
import { startScoreUpdateWorker } from "@/jobs/workers/scoreUpdate";
import { startAiRecapWorker } from "@/jobs/workers/aiRecap";
import { startUnderdogLockWorker } from "@/jobs/workers/underdogLock";
import { startScheduler } from "@/jobs/scheduler";

async function main(): Promise<void> {
  const season = Number(process.env.CURRENT_SEASON ?? new Date().getFullYear());
  const gameweekNumber = Number(process.env.CURRENT_GAMEWEEK ?? 1);

  console.log(`[workers] Starting — season ${season}, gameweek ${gameweekNumber}`);

  startFixtureSyncWorker();
  startScoreUpdateWorker();
  startAiRecapWorker();
  startUnderdogLockWorker();

  await startScheduler(gameweekNumber, season);

  console.log("[workers] All workers registered and running");
}

main().catch((err) => {
  console.error("[workers] Fatal error:", err);
  process.exit(1);
});
