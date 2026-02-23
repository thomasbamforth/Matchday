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
 *
 * Notifications fired here (per CLAUDE.md §9):
 *   - Away Day Pick win: when the away team wins a fixture with active picks
 *   - Rival overtake: when a user's league rank worsens after summary recalculation
 */

import { Worker, type Job } from "bullmq";
import { bullmqConnection, scoreUpdateQueue, aiRecapQueue, type ScoreUpdateJobData } from "@/jobs/queues";
import { prisma } from "@/lib/prisma";
import {
  scoreFixture,
  scoreGameweek,
  type FixtureInput,
} from "@/lib/scoring";
import { sendAwayDayPickWin, sendRivalOvertake } from "@/lib/notifications";

// ---------------------------------------------------------------------------
// Per-fixture base score (Underdog Boost only — no gameweek-level boosts)
// ---------------------------------------------------------------------------

async function updatePredictionPoints(fixtureId: string): Promise<void> {
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
// Away Day Pick win notification
// ---------------------------------------------------------------------------

async function notifyAwayDayPickWins(fixtureId: string): Promise<void> {
  const fixture = await prisma.fixture.findUnique({
    where: { id: fixtureId },
    select: { homeScore: true, awayScore: true, awayTeam: true },
  });
  if (!fixture || fixture.homeScore === null || fixture.awayScore === null) return;

  const awayWon = fixture.awayScore > fixture.homeScore;
  if (!awayWon) return;

  const picks = await prisma.awayDayPick.findMany({
    where: { fixtureId, voided: false },
    select: { userId: true },
  });
  if (picks.length === 0) return;

  await Promise.all(
    picks.map(async ({ userId }) => {
      // Use the first league as the deep-link destination
      const membership = await prisma.leagueMember.findFirst({
        where: { userId },
        select: { leagueId: true },
        orderBy: { joinedAt: "asc" },
      });
      if (!membership) return;
      return sendAwayDayPickWin(userId, fixture.awayTeam, membership.leagueId).catch((err) =>
        console.warn("[score-update] Away Day Pick win notification failed:", err)
      );
    })
  );
}

// ---------------------------------------------------------------------------
// Full gameweek score per user (all boosts)
// ---------------------------------------------------------------------------

async function calculateGameweekSummary(userId: string, gameweekId: number): Promise<void> {
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

  const hasDoubleDown    = boostChips.some((b) => b.type === "DOUBLE_DOWN");
  const hasOutOnTheTown  = boostChips.some((b) => b.type === "OUT_ON_THE_TOWN");
  const underdogChip     = boostChips.find((b) => b.type === "UNDERDOG_BOOST");

  const fixtureInputs: FixtureInput[] = predictions
    .filter((p) => p.fixture.homeScore !== null && p.fixture.awayScore !== null)
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

  const rawPoints = fixtureInputs.reduce(
    (sum, f) => sum + scoreFixture(f, { outOnTheTown: false }),
    0
  );

  await prisma.userGameweekSummary.upsert({
    where: { userId_gameweekId: { userId, gameweekId } },
    create: { userId, gameweekId, rawPoints, finalPoints },
    update: { rawPoints, finalPoints },
  });

  // Persist Away Day Pick outcome — used by the AI recap payload (§7).
  // Falls back to a direct fixture query if the user has no prediction on
  // that match (rare but possible).
  if (awayDayPick && !awayDayPick.voided) {
    const f =
      predictions.find((p) => p.fixtureId === awayDayPick.fixtureId)?.fixture ??
      await prisma.fixture.findUnique({
        where: { id: awayDayPick.fixtureId },
        select: { homeScore: true, awayScore: true },
      });
    if (f && f.homeScore !== null && f.awayScore !== null) {
      const won = f.awayScore > f.homeScore;
      if (awayDayPick.won !== won) {
        await prisma.awayDayPick.update({
          where: { id: awayDayPick.id },
          data: { won },
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// GW19 boost expiry — slot-1 chips unused after GW19 are permanently expired
// ---------------------------------------------------------------------------

async function expireSlot1Chips(): Promise<void> {
  const result = await prisma.boostChip.updateMany({
    where: { slot: 1, activatedAt: null, expired: false },
    data: { expired: true },
  });
  console.log(
    `[score-update] GW19 finished — expired ${result.count} unused slot-1 boost chip(s)`
  );
}

// ---------------------------------------------------------------------------
// Rival overtake detection
// ---------------------------------------------------------------------------

type LeagueMemberRow = { leagueId: string; userId: string; user: { name: string | null } };

export function computeRanksPerLeague(
  members: LeagueMemberRow[],
  pointsMap: Record<string, number>
): Record<string, Record<string, number>> {
  // Group member IDs by league
  const byLeague: Record<string, string[]> = {};
  for (const m of members) {
    (byLeague[m.leagueId] ??= []).push(m.userId);
  }

  const ranks: Record<string, Record<string, number>> = {};
  for (const [leagueId, memberIds] of Object.entries(byLeague)) {
    const sorted = [...memberIds].sort(
      (a, b) => (pointsMap[b] ?? 0) - (pointsMap[a] ?? 0)
    );
    ranks[leagueId] = Object.fromEntries(sorted.map((uid, i) => [uid, i + 1]));
  }
  return ranks;
}

async function detectAndSendRivalOvertakes(
  affectedUserIds: string[],
  gameweekId: number,
  preRanks: Record<string, Record<string, number>>,
  allMembers: LeagueMemberRow[]
): Promise<void> {
  const allMemberIds = [...new Set(allMembers.map((m) => m.userId))];

  const postSummaries = await prisma.userGameweekSummary.findMany({
    where: { gameweekId, userId: { in: allMemberIds } },
    select: { userId: true, finalPoints: true },
  });
  const postPointsMap: Record<string, number> = {};
  for (const s of postSummaries) postPointsMap[s.userId] = s.finalPoints;

  const postRanks = computeRanksPerLeague(allMembers, postPointsMap);

  const nameMap: Record<string, string> = {};
  for (const m of allMembers) nameMap[m.userId] = m.user.name ?? "Someone";

  const byLeague: Record<string, string[]> = {};
  for (const m of allMembers) (byLeague[m.leagueId] ??= []).push(m.userId);

  const notifications: Promise<void>[] = [];

  for (const userId of affectedUserIds) {
    for (const [leagueId, memberIds] of Object.entries(byLeague)) {
      if (!memberIds.includes(userId)) continue;

      const preRank  = preRanks[leagueId]?.[userId];
      const postRank = postRanks[leagueId]?.[userId];
      if (!preRank || !postRank || postRank <= preRank) continue; // rank same or improved

      // Overtaker: was ranked below this user before, now ranked above
      const overtakers = memberIds.filter((uid) => {
        if (uid === userId) return false;
        const pre  = preRanks[leagueId]?.[uid]  ?? 999;
        const post = postRanks[leagueId]?.[uid] ?? 999;
        return pre > preRank && post < postRank;
      });

      for (const overtakerId of overtakers) {
        notifications.push(
          sendRivalOvertake(userId, nameMap[overtakerId], leagueId).catch((err) =>
            console.warn("[score-update] Rival overtake notification failed:", err)
          )
        );
      }
    }
  }

  await Promise.all(notifications);
}

// ---------------------------------------------------------------------------
// Worker processor
// ---------------------------------------------------------------------------

async function process(job: Job<ScoreUpdateJobData>): Promise<void> {
  const { fixtureId, gameweekId } = job.data;

  // Step 1: base prediction points for this fixture
  await updatePredictionPoints(fixtureId);

  // Step 2: Away Day Pick win notifications (fire-and-forget; must not block scoring)
  notifyAwayDayPickWins(fixtureId).catch((err) =>
    console.warn("[score-update] notifyAwayDayPickWins error:", err)
  );

  // Step 3: find all users who predicted in this gameweek
  const userIds = await prisma.prediction
    .findMany({
      where: { fixture: { gameweekId } },
      select: { userId: true },
      distinct: ["userId"],
    })
    .then((rows) => rows.map((r) => r.userId));

  // Step 4: gather all league members for affected users (needed for rank tracking)
  const allMembers = await prisma.leagueMember.findMany({
    where: { userId: { in: userIds } },
    select: { leagueId: true, userId: true, user: { select: { name: true } } },
  });
  const allMemberIds = [...new Set(allMembers.map((m) => m.userId))];

  // Step 5: capture pre-update league ranks
  const preSummaries = await prisma.userGameweekSummary.findMany({
    where: { gameweekId, userId: { in: allMemberIds } },
    select: { userId: true, finalPoints: true },
  });
  const prePointsMap: Record<string, number> = {};
  for (const s of preSummaries) prePointsMap[s.userId] = s.finalPoints;
  const preRanks = computeRanksPerLeague(allMembers, prePointsMap);

  // Step 6: recalculate GW summaries for all users
  await Promise.all(userIds.map((uid) => calculateGameweekSummary(uid, gameweekId)));

  // Step 7: detect and send rival overtake notifications
  await detectAndSendRivalOvertakes(userIds, gameweekId, preRanks, allMembers);

  // Step 8: check if all non-postponed fixtures in the gameweek are FINISHED
  const unfinished = await prisma.fixture.count({
    where: {
      gameweekId,
      postponed: false,
      status: { notIn: ["FINISHED"] },
    },
  });

  if (unfinished > 0) return; // more fixtures still running

  // Step 9: mark gameweek FINISHED
  const finishedGw = await prisma.gameweek.update({
    where: { id: gameweekId },
    data: { status: "FINISHED" },
  });

  // Expire all unused slot-1 boost chips after GW19 ends (§5.3)
  if (finishedGw.number === 19) {
    await expireSlot1Chips();
  }

  // Step 10: enqueue ai-recap for every league with at least one predictor this GW
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
