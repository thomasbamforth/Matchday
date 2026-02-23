import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import GameweekView from "./GameweekView";
import type { Fixture, UserPrediction } from "@/types/matchday";

async function getData(gameweekId: number, userId: string) {
  const [gameweek, predictions, awayDayPick, underdogBoost, prevGw, nextGw] = await Promise.all([
    prisma.gameweek.findUnique({
      where: { id: gameweekId },
      include: { fixtures: { orderBy: { kickoff: "asc" } } },
    }),
    prisma.prediction.findMany({
      where: { userId, fixture: { gameweekId } },
      select: { fixtureId: true, homeScore: true, awayScore: true, points: true },
    }),
    prisma.awayDayPick.findUnique({
      where: { userId_gameweekId: { userId, gameweekId } },
    }),
    prisma.boostChip.findFirst({
      where: { userId, type: "UNDERDOG_BOOST", gameweekId, activatedAt: { not: null } },
      select: { fixtureId: true },
    }),
    prisma.gameweek.findUnique({
      where: { id: gameweekId - 1 },
      select: { id: true, number: true, seasonNumber: true },
    }),
    prisma.gameweek.findUnique({
      where: { id: gameweekId + 1 },
      select: { id: true, number: true, seasonNumber: true },
    }),
  ]);

  return { gameweek, predictions, awayDayPick, underdogBoost, prevGw, nextGw };
}

export default async function GameweekPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const gameweekId = Number(params.id);
  if (isNaN(gameweekId)) notFound();

  const { gameweek, predictions, awayDayPick, underdogBoost, prevGw, nextGw } =
    await getData(gameweekId, session!.user.id);
  if (!gameweek) notFound();

  const fixtures: Fixture[] = gameweek.fixtures.map((f) => ({
    id: f.id,
    homeTeam: f.homeTeam,
    awayTeam: f.awayTeam,
    kickoff: f.kickoff,
    status: f.status as Fixture["status"],
    homeScore: f.homeScore,
    awayScore: f.awayScore,
    underdogSide: f.underdogSide as Fixture["underdogSide"],
  }));

  const predMap: Record<string, UserPrediction> = {};
  for (const p of predictions) {
    predMap[p.fixtureId] = {
      homeScore: p.homeScore,
      awayScore: p.awayScore,
      points: p.points ?? undefined,
    };
  }

  return (
    <div className="space-y-4">
      <header>
        {/* Gameweek navigator */}
        <div className="mb-1 flex items-center justify-between">
          {prevGw ? (
            <Link
              href={`/gameweek/${prevGw.id}`}
              className="text-sm font-semibold text-hot-pink"
            >
              ← GW{prevGw.seasonNumber || prevGw.number}
            </Link>
          ) : (
            <span />
          )}

          <Link href="/gameweeks" className="text-xs text-white/30 hover:text-white/60">
            All weeks
          </Link>

          {nextGw ? (
            <Link
              href={`/gameweek/${nextGw.id}`}
              className="text-sm font-semibold text-hot-pink"
            >
              GW{nextGw.seasonNumber || nextGw.number} →
            </Link>
          ) : (
            <span />
          )}
        </div>

        <h1 className="text-2xl font-black text-white">Gameweek {gameweek.seasonNumber || gameweek.number}</h1>
        <p className="text-sm text-white/50 capitalize">{gameweek.status.toLowerCase()}</p>
      </header>

      <GameweekView
        gameweekId={gameweek.id}
        fixtures={fixtures}
        initialPredictions={predMap}
        awayDayPickFixtureId={awayDayPick?.fixtureId ?? null}
        underdogBoostFixtureId={underdogBoost?.fixtureId ?? null}
      />
    </div>
  );
}
