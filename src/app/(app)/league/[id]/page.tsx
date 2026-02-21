import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Leaderboard from "@/components/leaderboard/Leaderboard";
import RecapCard from "@/components/recap/RecapCard";
import BanterFeed from "@/components/feed/BanterFeed";
import type { LeaderboardEntry, BanterEntry, GameweekRecapData } from "@/types/matchday";

async function getData(leagueId: string, userId: string) {
  const activeGw = await prisma.gameweek.findFirst({
    where: { status: { in: ["ACTIVE", "FINISHED"] } },
    orderBy: { number: "desc" },
  });

  const [league, recap] = await Promise.all([
    prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        members: {
          include: {
            user: {
              include: {
                gameweekSummaries: activeGw
                  ? { where: { gameweekId: activeGw.id } }
                  : false,
                boostChips: activeGw
                  ? { where: { gameweekId: activeGw.id, activatedAt: { not: null } } }
                  : false,
              },
            },
          },
        },
      },
    }),
    activeGw
      ? prisma.gameweekRecap.findUnique({
          where: { gameweekId_leagueId: { gameweekId: activeGw.id, leagueId } },
        })
      : null,
  ]);

  if (!league) return null;

  // Fetch recent finished predictions for the banter feed
  const banterPredictions = activeGw
    ? await prisma.prediction.findMany({
        where: {
          fixture: { gameweekId: activeGw.id },
          user: { leagueMemberships: { some: { leagueId } } },
          points: { not: null },
        },
        include: { fixture: true, user: { select: { id: true, name: true, image: true } } },
        orderBy: { updatedAt: "desc" },
        take: 30,
      })
    : [];

  return { league, recap, banterPredictions, activeGw };
}

export default async function LeaguePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const result = await getData(params.id, session!.user.id);
  if (!result) notFound();

  const { league, recap, banterPredictions, activeGw } = result;

  // Build leaderboard entries
  const entries: LeaderboardEntry[] = league.members
    .map((m) => {
      const summary = m.user.gameweekSummaries?.[0];
      const activeBoosts = (m.user.boostChips ?? []).map((b) => b.type) as LeaderboardEntry["activeBoosts"];
      return {
        userId: m.userId,
        username: m.user.name ?? m.user.email ?? "Unknown",
        avatarUrl: m.user.image ?? undefined,
        gameweekPoints: summary?.finalPoints ?? 0,
        seasonTotal: 0, // populated below
        rank: 0,        // set after sort
        previousRank: 0,
        activeBoosts,
      };
    })
    .sort((a, b) => b.gameweekPoints - a.gameweekPoints)
    .map((e, i) => ({ ...e, rank: i + 1, previousRank: i + 1 }));

  // Season totals
  const allSummaries = await prisma.userGameweekSummary.findMany({
    where: { userId: { in: league.members.map((m) => m.userId) } },
  });
  const seasonMap: Record<string, number> = {};
  for (const s of allSummaries) {
    seasonMap[s.userId] = (seasonMap[s.userId] ?? 0) + s.finalPoints;
  }
  for (const e of entries) e.seasonTotal = seasonMap[e.userId] ?? 0;

  // Banter feed
  const banterEntries: BanterEntry[] = banterPredictions.map((p) => ({
    id: p.id,
    username: p.user.name ?? "Unknown",
    avatarUrl: p.user.image ?? undefined,
    homeTeam: p.fixture.homeTeam,
    awayTeam: p.fixture.awayTeam,
    predicted: `${p.homeScore}–${p.awayScore}`,
    actual:
      p.fixture.homeScore !== null
        ? `${p.fixture.homeScore}–${p.fixture.awayScore}`
        : "–",
    points: p.points ?? 0,
    isExact:
      p.homeScore === p.fixture.homeScore && p.awayScore === p.fixture.awayScore,
    timestamp: p.updatedAt,
  }));

  const recapData: GameweekRecapData | null =
    recap && activeGw
      ? {
          content: recap.content,
          failed: recap.failed,
          gameweekNumber: activeGw.number,
          leagueName: league.name,
        }
      : null;

  return (
    <div className="space-y-6">
      <Leaderboard
        entries={entries}
        currentUserId={session!.user.id}
        leagueName={league.name}
        gameweekNumber={activeGw?.number ?? 0}
      />

      {recapData && <RecapCard recap={recapData} />}

      <BanterFeed entries={banterEntries} />
    </div>
  );
}
