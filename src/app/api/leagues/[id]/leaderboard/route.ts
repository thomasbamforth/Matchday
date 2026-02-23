import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { LeaderboardEntry } from "@/types/matchday";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const leagueId = params.id;

  const activeGw = await prisma.gameweek.findFirst({
    where: { status: { in: ["ACTIVE", "FINISHED"] } },
    orderBy: { number: "desc" },
  });

  const league = await prisma.league.findUnique({
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
  });

  if (!league) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isMember = league.members.some((m) => m.userId === session.user.id);
  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const memberIds = league.members.map((m) => m.userId);
  const allSummaries = await prisma.userGameweekSummary.findMany({
    where: { userId: { in: memberIds } },
  });

  const seasonMap: Record<string, number> = {};
  for (const s of allSummaries) {
    seasonMap[s.userId] = (seasonMap[s.userId] ?? 0) + s.finalPoints;
  }

  const entries: LeaderboardEntry[] = league.members
    .map((m) => {
      const summary = m.user.gameweekSummaries?.[0];
      const activeBoosts = (m.user.boostChips ?? []).map(
        (b) => b.type
      ) as LeaderboardEntry["activeBoosts"];
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

  const prevRanked = [...entries]
    .map((e) => ({ userId: e.userId, prevTotal: e.seasonTotal - e.gameweekPoints }))
    .sort((a, b) => b.prevTotal - a.prevTotal);
  const prevRankMap: Record<string, number> = {};
  prevRanked.forEach((e, i) => { prevRankMap[e.userId] = i + 1; });
  for (const e of entries) e.previousRank = prevRankMap[e.userId] ?? e.rank;

  return NextResponse.json(entries);
}
