import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET /api/predictions?gameweekId=X — fetch the current user's predictions for a GW */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const gameweekId = Number(request.nextUrl.searchParams.get("gameweekId"));
  if (!gameweekId) return NextResponse.json({ error: "gameweekId required" }, { status: 400 });

  const predictions = await prisma.prediction.findMany({
    where: { userId: session.user.id, fixture: { gameweekId } },
    select: { fixtureId: true, homeScore: true, awayScore: true, points: true },
  });

  return NextResponse.json(predictions);
}

/** POST /api/predictions — create or update a prediction */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { fixtureId, homeScore, awayScore } = await request.json();
  if (fixtureId == null || homeScore == null || awayScore == null) {
    return NextResponse.json({ error: "fixtureId, homeScore, awayScore required" }, { status: 400 });
  }

  // Enforce kickoff lock
  const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId } });
  if (!fixture) return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
  if (new Date() >= fixture.kickoff) {
    return NextResponse.json({ error: "Predictions locked — match has kicked off" }, { status: 409 });
  }

  const prediction = await prisma.prediction.upsert({
    where: { userId_fixtureId: { userId: session.user.id, fixtureId } },
    create: { userId: session.user.id, fixtureId, homeScore, awayScore },
    update: { homeScore, awayScore },
  });

  return NextResponse.json(prediction);
}
