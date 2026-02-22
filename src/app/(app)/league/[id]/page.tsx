import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Leaderboard from "@/components/leaderboard/Leaderboard";
import RecapCard from "@/components/recap/RecapCard";
import RecapPending from "@/components/recap/RecapPending";
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
                  : undefined,
                boostChips: activeGw
                  ? { where: { gameweekId: activeGw.id, activatedAt: { not: null } } }
                  : undefined,
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

  // Auth guard — current user must be a member
  const isMember = league.members.some((m) => m.userId === userId);
  if (!isMember) return null;

  // Season totals for all members
  const memberIds = league.members.map((m) => m.userId);
  const [allSummaries, banterPredictions] = await Promise.all([
    prisma.userGameweekSummary.findMany({
      where: { userId: { in: memberIds } },
    }),
    activeGw
      ? prisma.prediction.findMany({
          where: {
            fixture: { gameweekId: activeGw.id },
            user: { leagueMemberships: { some: { leagueId } } },
            points: { not: null },
          },
          include: { fixture: true, user: { select: { id: true, name: true, image: true } } },
          orderBy: { updatedAt: "desc" },
          take: 30,
        })
      : Promise.resolve([]),
  ]);

  return { league, recap, banterPredictions, activeGw, allSummaries };
}

export default async function LeaguePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const result = await getData(params.id, session!.user.id);
  if (!result) notFound();

  const { league, recap, banterPredictions, activeGw, allSummaries } = result;

  // Season totals map
  const seasonMap: Record<string, number> = {};
  for (const s of allSummaries) {
    seasonMap[s.userId] = (seasonMap[s.userId] ?? 0) + s.finalPoints;
  }

  // Build leaderboard entries sorted by current GW points (primary), season total (tiebreak)
  const entries: LeaderboardEntry[] = league.members
    .map((m) => {
      const summary = m.user.gameweekSummaries?.[0];
      const activeBoosts = (m.user.boostChips ?? []).map((b) => b.type) as LeaderboardEntry["activeBoosts"];
      const seasonTotal = seasonMap[m.userId] ?? 0;
      const gameweekPoints = summary?.finalPoints ?? 0;
      return {
        userId: m.userId,
        username: m.user.name ?? m.user.email ?? "Unknown",
        avatarUrl: m.user.image ?? undefined,
        gameweekPoints,
        seasonTotal,
        rank: 0,
        previousRank: 0,
        activeBoosts,
      };
    })
    .sort((a, b) => b.gameweekPoints - a.gameweekPoints || b.seasonTotal - a.seasonTotal)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  // Previous rank = rank based on season total BEFORE this gameweek's points.
  // (season total already includes the current GW, so subtract it.)
  const prevRanked = [...entries]
    .map((e) => ({ userId: e.userId, prevTotal: e.seasonTotal - e.gameweekPoints }))
    .sort((a, b) => b.prevTotal - a.prevTotal);
  const prevRankMap: Record<string, number> = {};
  prevRanked.forEach((e, i) => { prevRankMap[e.userId] = i + 1; });
  for (const e of entries) e.previousRank = prevRankMap[e.userId] ?? e.rank;

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

  // Recap section: show card if ready, pending placeholder if not yet generated
  let recapSection: ReactNode = null;
  if (activeGw) {
    if (recapData) {
      recapSection = <RecapCard recap={recapData} />;
    } else if (activeGw.status === "FINISHED") {
      // GW finished but AI job hasn't written the recap yet (short race window)
      recapSection = (
        <RecapPending
          gameweekNumber={activeGw.number}
          leagueName={league.name}
          generating
        />
      );
    } else {
      // GW still active — matches in progress
      recapSection = (
        <RecapPending
          gameweekNumber={activeGw.number}
          leagueName={league.name}
        />
      );
    }
  }

  return (
    <div className="space-y-6">
      <Leaderboard
        entries={entries}
        currentUserId={session!.user.id}
        leagueName={league.name}
        gameweekNumber={activeGw?.number ?? 0}
        inviteCode={league.code}
      />

      {recapSection}

      <BanterFeed entries={banterEntries} />
    </div>
  );
}
