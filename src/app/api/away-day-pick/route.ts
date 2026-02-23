import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** POST /api/away-day-pick — set or replace the Away Day Pick for a gameweek */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { fixtureId, gameweekId } = await request.json();
  if (!fixtureId || !gameweekId) {
    return NextResponse.json({ error: "fixtureId and gameweekId required" }, { status: 400 });
  }

  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId } });
  if (!fixture) return NextResponse.json({ error: "Fixture not found" }, { status: 404 });

  if (fixture.postponed) {
    return NextResponse.json({ error: "Cannot pick a postponed fixture" }, { status: 409 });
  }

  // Lock at kickoff of the chosen fixture (§9.4)
  if (new Date() >= fixture.kickoff) {
    return NextResponse.json({ error: "Away Day Pick locked — match has kicked off" }, { status: 409 });
  }

  const pick = await prisma.awayDayPick.upsert({
    where: { userId_gameweekId: { userId: session.user.id, gameweekId } },
    create: {
      userId: session.user.id,
      gameweekId,
      fixtureId,
      team: fixture.awayTeam,
    },
    // voided: false — re-enables a previously voided (postponed) pick slot
    update: { fixtureId, team: fixture.awayTeam, voided: false },
  });

  return NextResponse.json(pick);
}

/** DELETE /api/away-day-pick — remove the Away Day Pick (before kickoff only) */
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { gameweekId } = await request.json();
  if (!gameweekId) return NextResponse.json({ error: "gameweekId required" }, { status: 400 });

  const existing = await prisma.awayDayPick.findUnique({
    where: { userId_gameweekId: { userId: session.user.id, gameweekId } },
    include: { fixture: true },
  });

  if (!existing) return NextResponse.json({ ok: true });
  if (new Date() >= existing.fixture.kickoff) {
    return NextResponse.json({ error: "Cannot remove — match has kicked off" }, { status: 409 });
  }

  await prisma.awayDayPick.delete({
    where: { userId_gameweekId: { userId: session.user.id, gameweekId } },
  });

  return NextResponse.json({ ok: true });
}
