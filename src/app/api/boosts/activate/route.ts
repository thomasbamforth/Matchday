import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { BoostType } from "@prisma/client";

const VALID_TYPES: BoostType[] = ["DOUBLE_DOWN", "OUT_ON_THE_TOWN", "UNDERDOG_BOOST"];
const GW19_CUTOFF = 19; // Boost #1 must be used by end of GW19 (§5.3)

/**
 * POST /api/boosts/activate
 * Body: { slot: 1|2, type: BoostType, gameweekId: number, fixtureId?: string }
 *
 * Enforces:
 *  - Slot 1 cannot be used after GW19 (expired)
 *  - Slot 2 cannot be used before GW20
 *  - Cannot activate an already-activated or expired chip
 *  - UNDERDOG_BOOST requires fixtureId before kickoff
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { slot, type, gameweekId, fixtureId } = await request.json();

  if (!slot || !type || !gameweekId) {
    return NextResponse.json({ error: "slot, type, gameweekId required" }, { status: 400 });
  }
  if (!VALID_TYPES.includes(type as BoostType)) {
    return NextResponse.json({ error: "Invalid boost type" }, { status: 400 });
  }

  const gameweek = await prisma.gameweek.findUnique({ where: { id: gameweekId } });
  if (!gameweek) return NextResponse.json({ error: "Gameweek not found" }, { status: 404 });

  // Slot timing rules (§5.3)
  if (slot === 1 && gameweek.number > GW19_CUTOFF) {
    return NextResponse.json({ error: "Boost #1 expired — must be used by GW19" }, { status: 409 });
  }
  if (slot === 2 && gameweek.number <= GW19_CUTOFF) {
    return NextResponse.json({ error: "Boost #2 cannot be used until GW20" }, { status: 409 });
  }

  // Find or create the chip for this slot
  const existing = await prisma.boostChip.findFirst({
    where: { userId: session.user.id, slot },
  });

  if (existing?.activatedAt) {
    return NextResponse.json({ error: "Boost already activated — cannot be undone" }, { status: 409 });
  }
  if (existing?.expired) {
    return NextResponse.json({ error: "Boost expired" }, { status: 409 });
  }

  // UNDERDOG_BOOST requires a fixture before kickoff
  if (type === "UNDERDOG_BOOST") {
    if (!fixtureId) return NextResponse.json({ error: "fixtureId required for Underdog Boost" }, { status: 400 });
    const fixture = await prisma.fixture.findUnique({ where: { id: fixtureId } });
    if (!fixture) return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
    if (new Date() >= fixture.kickoff) {
      return NextResponse.json({ error: "Underdog Boost must be activated before kickoff" }, { status: 409 });
    }
  }

  const chip = existing
    ? await prisma.boostChip.update({
        where: { id: existing.id },
        data: {
          type: type as BoostType,
          gameweekId,
          fixtureId: fixtureId ?? null,
          activatedAt: new Date(),
        },
      })
    : await prisma.boostChip.create({
        data: {
          userId: session.user.id,
          slot,
          type: type as BoostType,
          gameweekId,
          fixtureId: fixtureId ?? null,
          activatedAt: new Date(),
        },
      });

  return NextResponse.json(chip);
}
