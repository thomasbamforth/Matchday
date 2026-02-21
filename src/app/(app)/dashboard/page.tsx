import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import FixtureCard from "@/components/fixtures/FixtureCard";
import type { Fixture } from "@/types/matchday";

async function getData(userId: string) {
  // Active gameweek, or next upcoming one
  const gameweek = await prisma.gameweek.findFirst({
    where: { status: { in: ["ACTIVE", "UPCOMING"] } },
    orderBy: { number: "asc" },
    include: {
      fixtures: {
        orderBy: { kickoff: "asc" },
        take: 3, // preview — first 3 fixtures
      },
    },
  });

  const leagues = await prisma.leagueMember.findMany({
    where: { userId },
    include: { league: { select: { id: true, name: true } } },
    take: 5,
  });

  const predictions = gameweek
    ? await prisma.prediction.findMany({
        where: { userId, fixture: { gameweekId: gameweek.id } },
        select: { fixtureId: true, homeScore: true, awayScore: true, points: true },
      })
    : [];

  return { gameweek, leagues, predictions };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const { gameweek, leagues, predictions } = await getData(session!.user.id);

  const predMap = new Map(predictions.map((p) => [p.fixtureId, p]));

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-black text-white">
          Hey, {session!.user.name?.split(" ")[0] ?? "Gaffer"} 👋
        </h1>
        {gameweek ? (
          <p className="mt-0.5 text-sm text-white/50">Gameweek {gameweek.number}</p>
        ) : (
          <p className="mt-0.5 text-sm text-white/50">No active gameweek</p>
        )}
      </div>

      {/* Upcoming fixtures preview */}
      {gameweek && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white/40">
              Fixtures
            </h2>
            <Link
              href={`/gameweek/${gameweek.id}`}
              className="text-xs font-semibold text-hot-pink"
            >
              All {gameweek.fixtures.length > 3 ? `(+${gameweek.fixtures.length - 3} more)` : ""}
            </Link>
          </div>
          <div className="space-y-2">
            {gameweek.fixtures.map((f) => {
              const pred = predMap.get(f.id);
              const fixture: Fixture = {
                id: f.id,
                homeTeam: f.homeTeam,
                awayTeam: f.awayTeam,
                kickoff: f.kickoff,
                status: f.status as Fixture["status"],
                homeScore: f.homeScore,
                awayScore: f.awayScore,
                underdogSide: f.underdogSide as Fixture["underdogSide"],
              };
              return (
                <Link key={f.id} href={`/gameweek/${gameweek.id}`}>
                  <FixtureCard
                    fixture={fixture}
                    prediction={pred ? { homeScore: pred.homeScore, awayScore: pred.awayScore, points: pred.points ?? undefined } : undefined}
                  />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Leagues */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white/40">
            Your Leagues
          </h2>
          <Link href="/leagues" className="text-xs font-semibold text-hot-pink">
            Manage
          </Link>
        </div>

        {leagues.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/20 px-4 py-6 text-center">
            <p className="text-sm text-white/50">No leagues yet.</p>
            <Link
              href="/leagues"
              className="mt-2 inline-block text-sm font-semibold text-hot-pink"
            >
              Create or join one →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {leagues.map((m) => (
              <Link
                key={m.league.id}
                href={`/league/${m.league.id}`}
                className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 hover:bg-white/5"
              >
                <span className="text-sm font-semibold text-white">{m.league.name}</span>
                <span className="text-xs text-hot-pink">View →</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
