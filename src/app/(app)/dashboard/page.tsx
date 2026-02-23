import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import FixtureCard from "@/components/fixtures/FixtureCard";
import type { Fixture } from "@/types/matchday";

async function getData(userId: string) {
  // Active or next upcoming gameweek — include preview fixtures + total count
  const gameweek = await prisma.gameweek.findFirst({
    where: { status: { in: ["ACTIVE", "UPCOMING"] } },
    orderBy: { number: "asc" },
    include: {
      fixtures: { orderBy: { kickoff: "asc" }, take: 3 },
      _count: { select: { fixtures: true } },
    },
  });

  const [leagues, predictions, boostChips] = await Promise.all([
    prisma.leagueMember.findMany({
      where: { userId },
      include: { league: { select: { id: true, name: true } } },
      take: 5,
    }),
    gameweek
      ? prisma.prediction.findMany({
          where: { userId, fixture: { gameweekId: gameweek.id } },
          select: { fixtureId: true, homeScore: true, awayScore: true, points: true },
        })
      : Promise.resolve([]),
    prisma.boostChip.findMany({
      where: { userId },
      select: { slot: true, activatedAt: true, expired: true },
    }),
  ]);

  // Per-league GW rank — single batch query for all members across all leagues
  const leagueRanks: Record<string, { rank: number; total: number }> = {};

  if (gameweek && leagues.length > 0) {
    const leagueIds = leagues.map((m) => m.league.id);
    const allMembers = await prisma.leagueMember.findMany({
      where: { leagueId: { in: leagueIds } },
      select: { leagueId: true, userId: true },
    });

    const allMemberIds = [...new Set(allMembers.map((m) => m.userId))];
    const gwSummaries = await prisma.userGameweekSummary.findMany({
      where: { gameweekId: gameweek.id, userId: { in: allMemberIds } },
      select: { userId: true, finalPoints: true },
    });

    const pointsMap: Record<string, number> = {};
    for (const s of gwSummaries) pointsMap[s.userId] = s.finalPoints;
    const myPoints = pointsMap[userId] ?? 0;

    for (const m of leagues) {
      const members = allMembers.filter((lm) => lm.leagueId === m.league.id);
      const above = members.filter((lm) => (pointsMap[lm.userId] ?? 0) > myPoints).length;
      leagueRanks[m.league.id] = { rank: above + 1, total: members.length };
    }
  }

  return { gameweek, leagues, predictions, boostChips, leagueRanks };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const { gameweek, leagues, predictions, boostChips, leagueRanks } = await getData(
    session!.user.id
  );

  const predMap = new Map(predictions.map((p) => [p.fixtureId, p]));

  const totalFixtures = gameweek?._count.fixtures ?? 0;
  const predictedCount = predictions.length;
  const progressPct = totalFixtures > 0 ? Math.round((predictedCount / totalFixtures) * 100) : 0;

  // Count unused, non-expired boost chips available this season
  const availableBoosts = boostChips.filter((c) => !c.activatedAt && !c.expired).length;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-black text-white">
          Hey, {session!.user.name?.split(" ")[0] ?? "Gaffer"}
        </h1>
        {gameweek ? (
          <p className="mt-0.5 text-sm text-white/50">Gameweek {gameweek.number}</p>
        ) : (
          <p className="mt-0.5 text-sm text-white/50">No active gameweek</p>
        )}
      </div>

      {/* Prediction progress */}
      {gameweek && totalFixtures > 0 && (
        <div className="rounded-xl border border-white/10 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-white/60">Predictions</span>
            <span className={[
              "text-xs font-bold tabular-nums",
              predictedCount === totalFixtures ? "text-neon-green" : "text-hot-pink",
            ].join(" ")}>
              {predictedCount} / {totalFixtures}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={[
                "h-full rounded-full transition-all",
                predictedCount === totalFixtures ? "bg-neon-green" : "bg-hot-pink",
              ].join(" ")}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {predictedCount < totalFixtures && (
            <Link
              href={`/gameweek/${gameweek.id}`}
              className="mt-2 block text-xs text-hot-pink"
            >
              {totalFixtures - predictedCount} fixture{totalFixtures - predictedCount !== 1 ? "s" : ""} still to predict →
            </Link>
          )}
        </div>
      )}

      {/* Boost nudge */}
      {availableBoosts > 0 && (
        <Link
          href="/boosts"
          className="flex items-center justify-between rounded-xl border border-gold/30 bg-gold/5 px-4 py-3"
        >
          <div>
            <p className="text-sm font-semibold text-gold">
              {availableBoosts} boost chip{availableBoosts !== 1 ? "s" : ""} available
            </p>
            <p className="text-xs text-white/50">Activate before your window closes</p>
          </div>
          <span className="text-xs text-gold">Boosts →</span>
        </Link>
      )}

      {/* Fixture preview */}
      {gameweek && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-widest text-white/40">
              Fixtures
            </h2>
            <div className="flex items-center gap-3">
              <Link href="/gameweeks" className="text-xs text-white/30 hover:text-white/60">
                Past weeks
              </Link>
              <Link href="/fixtures" className="text-xs text-white/30 hover:text-white/60">
                Fixtures
              </Link>
              <Link
                href={`/gameweek/${gameweek.id}`}
                className="text-xs font-semibold text-hot-pink"
              >
                {totalFixtures > 3 ? `All (+${totalFixtures - 3} more)` : "All"}
              </Link>
            </div>
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
                    prediction={
                      pred
                        ? { homeScore: pred.homeScore, awayScore: pred.awayScore, points: pred.points ?? undefined }
                        : undefined
                    }
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
            {leagues.map((m) => {
              const rankInfo = leagueRanks[m.league.id];
              return (
                <Link
                  key={m.league.id}
                  href={`/league/${m.league.id}`}
                  className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 hover:bg-white/5"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">{m.league.name}</p>
                    {rankInfo && (
                      <p className="mt-0.5 text-xs text-white/40">
                        {rankInfo.total > 1 ? (
                          <>
                            <span className={rankInfo.rank === 1 ? "text-neon-green font-semibold" : "text-white/60"}>
                              {rankInfo.rank}{rankSuffix(rankInfo.rank)}
                            </span>
                            {" of "}
                            {rankInfo.total}
                          </>
                        ) : (
                          "1 member"
                        )}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-hot-pink">View →</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function rankSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}
