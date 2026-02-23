import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Leaderboard from "@/components/leaderboard/Leaderboard";
import type { LeaderboardEntry, BoostType } from "@/types/matchday";

async function getData(userId: string) {
  const activeGw = await prisma.gameweek.findFirst({
    where: { status: { in: ["ACTIVE", "FINISHED"] } },
    orderBy: { number: "desc" },
  });

  const [allUsers, allSummaries, boostChips] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, email: true, image: true },
    }),
    prisma.userGameweekSummary.findMany({
      select: { userId: true, gameweekId: true, finalPoints: true },
    }),
    activeGw
      ? prisma.boostChip.findMany({
          where: { gameweekId: activeGw.id, activatedAt: { not: null } },
          select: { userId: true, type: true },
        })
      : Promise.resolve([]),
  ]);

  // Season totals + current GW points per user
  const seasonMap: Record<string, number> = {};
  const gwMap: Record<string, number> = {};
  for (const s of allSummaries) {
    seasonMap[s.userId] = (seasonMap[s.userId] ?? 0) + s.finalPoints;
    if (activeGw && s.gameweekId === activeGw.id) {
      gwMap[s.userId] = s.finalPoints;
    }
  }

  // Active boosts per user this gameweek
  const boostMap: Record<string, BoostType[]> = {};
  for (const b of boostChips) {
    (boostMap[b.userId] ??= []).push(b.type as BoostType);
  }

  // Build and sort entries: season total (primary), GW points (tiebreak)
  const entries: LeaderboardEntry[] = allUsers
    .map((u) => ({
      userId: u.id,
      username: u.name ?? u.email ?? "Unknown",
      avatarUrl: u.image ?? undefined,
      gameweekPoints: gwMap[u.id] ?? 0,
      seasonTotal: seasonMap[u.id] ?? 0,
      rank: 0,
      previousRank: 0,
      activeBoosts: boostMap[u.id] ?? [],
    }))
    .sort((a, b) => b.seasonTotal - a.seasonTotal || b.gameweekPoints - a.gameweekPoints)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  // Previous rank = rank by season total before this gameweek's contribution
  const prevRanked = [...entries]
    .map((e) => ({ userId: e.userId, prevTotal: e.seasonTotal - e.gameweekPoints }))
    .sort((a, b) => b.prevTotal - a.prevTotal);
  const prevRankMap: Record<string, number> = {};
  prevRanked.forEach((e, i) => { prevRankMap[e.userId] = i + 1; });
  for (const e of entries) e.previousRank = prevRankMap[e.userId] ?? e.rank;

  return { entries, activeGw };
}

export default async function GlobalLeaderboardPage() {
  const session = await getServerSession(authOptions);
  const { entries, activeGw } = await getData(session!.user.id);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-black text-white">Global Rankings</h1>
        <p className="mt-1 text-sm text-white/50">
          All players, ranked by season total.
          {activeGw && (
            <> Showing GW{activeGw.number} points too.</>
          )}
        </p>
      </header>

      <Leaderboard
        entries={entries}
        currentUserId={session!.user.id}
        leagueName="Global Rankings"
        gameweekNumber={activeGw?.number ?? 0}
      />
    </div>
  );
}
