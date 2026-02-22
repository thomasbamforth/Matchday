/**
 * score-update worker.
 *
 * Triggered when a fixture transitions to FINISHED.
 *
 * For each user who predicted on the fixture:
 *   1. Calculate and store the base Prediction.points (exact/correct_result/wrong,
 *      with Underdog Boost applied if active on this fixture and underdog won)
 *   2. When all fixtures in the gameweek are FINISHED, calculate full gameweek
 *      scores (Away Day Pick multiplier + Double Down) and store UserGameweekSummary
 *   3. If that was the last fixture in the gameweek, enqueue ai-recap jobs for
 *      every league the affected users belong to
 */

import { Worker, type Job } from "bullmq";
import { bullmqConnection, scoreUpdateQueue, aiRecapQueue, type ScoreUpdateJobData } from "@/jobs/queues";
import { prisma } from "@/lib/prisma";
import {
  scoreFixture,
  scoreGameweek,
  type FixtureInput,
} from "@/lib/scoring";

// ---------------------------------------------------------------------------
// Per-fixture base score (Underdog Boost only — no gameweek-level boosts)
// ---------------------------------------------------------------------------

async function updatePredictionPoints(
  fixtureId: string
): Promise<void> {
  const fixture = await prisma.fixture.findUniqueOrThrow({
    where: { id: fixtureId },
    include: {
      predictions: { include: { user: true } },
      boostChips: true,
    },
  });

  if (fixture.homeScore === null || fixture.awayScore === null) return;

  const result = { home: fixture.homeScore, away: fixture.awayScore };

  for (const prediction of fixture.predictions) {
    const underdogChip = fixture.boostChips.find(
      (b) =>
        b.type === "UNDERDOG_BOOST" &&
        b.userId === prediction.userId &&
        b.fixtureId === fixtureId &&
        b.activatedAt !== null
    );

    const input: FixtureInput = {
      prediction: { home: prediction.homeScore, away: prediction.awayScore },
      result,
      isAwayDayPickFixture: false, // base score only — Away Day Pick handled in GW summary
      isUnderdogBoostFixture: !!underdogChip,
      underdogSide: fixture.underdogSide as "home" | "away" | null,
    };

    const baseScore = scoreFixture(input, { outOnTheTown: false });

    await prisma.prediction.update({
      where: { id: prediction.id },
      data: { points: baseScore },
    });
  }
}

// ---------------------------------------------------------------------------
// Full gameweek score per user (all boosts)
// ---------------------------------------------------------------------------

async function calculateGameweekSummary(
  userId: string,
  gameweekId: number
): Promise<void> {
  const [predictions, awayDayPick, boostChips] = await Promise.all([
    prisma.prediction.findMany({
      where: { userId, fixture: { gameweekId } },
      include: { fixture: true },
    }),
    prisma.awayDayPick.findUnique({
      where: { userId_gameweekId: { userId, gameweekId } },
    }),
    prisma.boostChip.findMany({
      where: { userId, gameweekId, activatedAt: { not: null } },
    }),
  ]);

  const hasDoubleDown = boostChips.some((b) => b.type === "DOUBLE_DOWN");
  const hasOutOnTheTown = boostChips.some((b) => b.type === "OUT_ON_THE_TOWN");
  const underdogChip = boostChips.find((b) => b.type === "UNDERDOG_BOOST");

  const fixtureInputs: FixtureInput[] = predictions
    .filter(
      (p) => p.fixture.homeScore !== null && p.fixture.awayScore !== null
    )
    .map((p) => ({
      prediction: { home: p.homeScore, away: p.awayScore },
      result: { home: p.fixture.homeScore!, away: p.fixture.awayScore! },
      isAwayDayPickFixture: awayDayPick?.fixtureId === p.fixtureId && !awayDayPick.voided,
      isUnderdogBoostFixture: underdogChip?.fixtureId === p.fixtureId,
      underdogSide: p.fixture.underdogSide as "home" | "away" | null,
    }));

  const finalPoints = scoreGameweek(fixtureInputs, {
    doubleDown: hasDoubleDown,
    outOnTheTown: hasOutOnTheTown,
  });

  // rawPoints = sum without gameweek-level multipliers
  const rawPoints = fixtureInputs.reduce(
    (sum, f) => sum + scoreFixture(f, { outOnTheTown: false }),
    0
  );

  await prisma.userGameweekSummary.upsert({
    where: { userId_gameweekId: { userId, gameweekId } },
    create: { userId, gameweekId, rawPoints, finalPoints },
    update: { rawPoints, finalPoints },
  });
}

// ---------------------------------------------------------------------------
// Worker processor
// ---------------------------------------------------------------------------

async function process(job: Job<ScoreUpdateJobData>): Promise<void> {
  const { fixtureId, gameweekId } = job.data;

  // Step 1: base prediction points for this fixture
  await updatePredictionPoints(fixtureId);

  // Step 2: find all users who predicted in this gameweek and update their summary
  const userIds = await prisma.prediction
    .findMany({
      where: { fixture: { gameweekId } },
      select: { userId: true },
      distinct: ["userId"],
    })
    .then((rows) => rows.map((r) => r.userId));

  await Promise.all(
    userIds.map((uid) => calculateGameweekSummary(uid, gameweekId))
  );

  // Step 3: check if all non-postponed fixtures in the gameweek are FINISHED
  const unfinished = await prisma.fixture.count({
    where: {
      gameweekId,
      postponed: false,
      status: { notIn: ["FINISHED"] },
    },
  });

  if (unfinished > 0) return; // more fixtures still running

  // Step 4: mark gameweek FINISHED
  await prisma.gameweek.update({
    where: { id: gameweekId },
    data: { status: "FINISHED" },
  });

  // Step 5: enqueue ai-recap for every league that has at least one member in this GW
  const leagues = await prisma.league.findMany({
    where: {
      members: {
        some: {
          user: { predictions: { some: { fixture: { gameweekId } } } },
        },
      },
    },
    select: { id: true },
  });

  await Promise.all(
    leagues.map((l) =>
      aiRecapQueue.add("ai-recap" as string, { gameweekId, leagueId: l.id })
    )
  );
}

// ---------------------------------------------------------------------------
// Worker registration
// ---------------------------------------------------------------------------

export function startScoreUpdateWorker(): Worker {
  const worker = new Worker<ScoreUpdateJobData>("score-update", process, {
    connection: bullmqConnection,
    concurrency: 5,
  });

  worker.on("failed", (job, err) => {
    console.error(`[score-update] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
