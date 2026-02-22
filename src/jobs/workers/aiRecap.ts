/**
 * ai-recap worker.
 *
 * Triggered after all fixtures in a gameweek are FINISHED.
 * Generates a per-league recap using GPT-4o.
 *
 * Retry policy: 3 attempts with exponential backoff (set on the queue).
 * If all retries fail, BullMQ marks the job as failed and the recap card
 * displays RECAP_FALLBACK (surfaced via the failed flag on GameweekRecap).
 */

import { Worker, type Job } from "bullmq";
import { bullmqConnection, type AiRecapJobData } from "@/jobs/queues";
import { prisma } from "@/lib/prisma";
import {
  generateRecap,
  RECAP_FALLBACK,
  type RecapPayload,
  type RecapMember,
} from "@/lib/clients/openaiClient";
import { sendRecapReady } from "@/lib/notifications";

// ---------------------------------------------------------------------------
// Build the recap payload from the DB
// ---------------------------------------------------------------------------

async function buildPayload(
  gameweekId: number,
  leagueId: string
): Promise<RecapPayload> {
  const [gameweek, league] = await Promise.all([
    prisma.gameweek.findUniqueOrThrow({ where: { id: gameweekId } }),
    prisma.league.findUniqueOrThrow({
      where: { id: leagueId },
      include: {
        members: {
          include: {
            user: {
              include: {
                predictions: {
                  where: { fixture: { gameweekId } },
                  include: { fixture: true },
                },
                awayDayPicks: { where: { gameweekId } },
                gameweekSummaries: { where: { gameweekId } },
              },
            },
          },
        },
      },
    }),
  ]);

  // Rank members by finalPoints descending this gameweek
  const ranked = league.members
    .map((m) => ({
      member: m,
      finalPoints: m.user.gameweekSummaries[0]?.finalPoints ?? 0,
    }))
    .sort((a, b) => b.finalPoints - a.finalPoints);

  // We also need season totals and previous rank — derive from all summaries
  const allSummaries = await prisma.userGameweekSummary.findMany({
    where: {
      userId: { in: league.members.map((m) => m.userId) },
    },
  });

  const seasonTotals: Record<string, number> = {};
  for (const s of allSummaries) {
    seasonTotals[s.userId] = (seasonTotals[s.userId] ?? 0) + s.finalPoints;
  }

  const members: RecapMember[] = ranked.map(({ member, finalPoints }, i) => {
    const user = member.user;
    const pick = user.awayDayPicks[0];

    return {
      username: user.name ?? user.email ?? "Unknown",
      predictions: user.predictions.map((p) => ({
        home: p.fixture.homeTeam,
        away: p.fixture.awayTeam,
        predicted: `${p.homeScore}-${p.awayScore}`,
        actual:
          p.fixture.homeScore !== null
            ? `${p.fixture.homeScore}-${p.fixture.awayScore}`
            : "TBD",
        points: p.points ?? 0,
      })),
      gameweek_points: finalPoints,
      season_total: seasonTotals[user.id] ?? 0,
      previous_rank: i + 1, // simplified — a full impl would track previous GW ranks
      current_rank: i + 1,
      ...(pick && {
        away_day_pick: { team: pick.team, won: pick.won ?? false },
      }),
    };
  });

  return {
    gameweek: gameweek.number,
    league_name: league.name,
    members,
  };
}

// ---------------------------------------------------------------------------
// Worker processor
// ---------------------------------------------------------------------------

async function process(job: Job<AiRecapJobData>): Promise<void> {
  const { gameweekId, leagueId } = job.data;

  // Check if a recap already succeeded for this gameweek/league
  const existing = await prisma.gameweekRecap.findUnique({
    where: { gameweekId_leagueId: { gameweekId, leagueId } },
  });
  if (existing && !existing.failed) {
    job.log("Recap already generated — skipping");
    return;
  }

  const payload = await buildPayload(gameweekId, leagueId);
  const content = await generateRecap(payload); // throws on failure → BullMQ retries

  await prisma.gameweekRecap.upsert({
    where: { gameweekId_leagueId: { gameweekId, leagueId } },
    create: { gameweekId, leagueId, content, failed: false },
    update: { content, failed: false },
  });

  // Notify all league members that the recap is ready
  const [members, gameweek] = await Promise.all([
    prisma.leagueMember.findMany({
      where: { leagueId },
      select: { userId: true },
    }),
    prisma.gameweek.findUnique({
      where: { id: gameweekId },
      select: { number: true },
    }),
  ]);

  if (gameweek) {
    sendRecapReady(
      members.map((m) => m.userId),
      gameweek.number,
      leagueId
    ).catch((err) => console.warn("[ai-recap] sendRecapReady failed:", err));
  }
}

// ---------------------------------------------------------------------------
// Failure handler — called after all retries exhausted
// ---------------------------------------------------------------------------

async function onExhausted(
  gameweekId: number,
  leagueId: string
): Promise<void> {
  await prisma.gameweekRecap.upsert({
    where: { gameweekId_leagueId: { gameweekId, leagueId } },
    create: { gameweekId, leagueId, content: RECAP_FALLBACK, failed: true },
    update: { content: RECAP_FALLBACK, failed: true },
  });
}

// ---------------------------------------------------------------------------
// Worker registration
// ---------------------------------------------------------------------------

export function startAiRecapWorker(): Worker {
  const worker = new Worker<AiRecapJobData>("ai-recap", process, {
    connection: bullmqConnection,
    concurrency: 2,
  });

  worker.on("failed", async (job, err) => {
    console.error(`[ai-recap] Job ${job?.id} failed:`, err.message);
    // Only write fallback after ALL retries are exhausted
    const attemptsMade = job?.attemptsMade ?? 0;
    const maxAttempts = job?.opts.attempts ?? 3;
    if (job && attemptsMade >= maxAttempts) {
      await onExhausted(job.data.gameweekId, job.data.leagueId);
    }
  });

  return worker;
}
