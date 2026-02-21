import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** POST /api/leagues/join — join a league by invite code */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { code } = await request.json();
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const league = await prisma.league.findUnique({ where: { code: code.toUpperCase() } });
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });

  const existing = await prisma.leagueMember.findUnique({
    where: { leagueId_userId: { leagueId: league.id, userId: session.user.id } },
  });
  if (existing) return NextResponse.json({ error: "Already a member" }, { status: 409 });

  await prisma.leagueMember.create({
    data: { leagueId: league.id, userId: session.user.id },
  });

  return NextResponse.json({ id: league.id, name: league.name });
}
