import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";

/** GET /api/leagues — fetch leagues the current user belongs to */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const memberships = await prisma.leagueMember.findMany({
    where: { userId: session.user.id },
    include: {
      league: {
        include: { _count: { select: { members: true } } },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  return NextResponse.json(memberships.map((m) => ({
    id: m.league.id,
    name: m.league.name,
    code: m.league.code,
    memberCount: m.league._count.members,
    isOwner: m.league.ownerId === session.user.id,
  })));
}

/** POST /api/leagues — create a new league */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { name } = await request.json();
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json({ error: "name must be at least 2 characters" }, { status: 400 });
  }

  const code = randomBytes(4).toString("hex").toUpperCase(); // e.g. "A3F1B2C4"

  const league = await prisma.league.create({
    data: {
      name: name.trim(),
      code,
      ownerId: session.user.id,
      members: { create: { userId: session.user.id } },
    },
  });

  return NextResponse.json(league, { status: 201 });
}
