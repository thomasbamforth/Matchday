import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import GameweekView from "./GameweekView";
import type { Fixture, UserPrediction } from "@/types/matchday";

async function getData(gameweekId: number, userId: string) {
  const [gameweek, predictions, awayDayPick, underdogBoost] = await Promise.all([
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
  ]);

  return { gameweek, predictions, awayDayPick, underdogBoost };
}

export default async function GameweekPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const gameweekId = Number(params.id);
  if (isNaN(gameweekId)) notFound();

  const { gameweek, predictions, awayDayPick, underdogBoost } = await getData(gameweekId, session!.user.id);
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
        <h1 className="text-2xl font-black text-white">Gameweek {gameweek.number}</h1>
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
