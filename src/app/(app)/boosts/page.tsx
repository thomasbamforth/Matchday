import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BoostsView from "./BoostsView";
import type { BoostChipInfo } from "@/types/matchday";

export interface FixtureOption {
  id: string;
  homeTeam: string;
  awayTeam: string;
  underdogSide: "home" | "away" | null;
  kickoff: string; // ISO string — safe to pass from server to client component
}

async function getData(userId: string) {
  const [chips, activeGw] = await Promise.all([
    prisma.boostChip.findMany({
      where: { userId },
      orderBy: { slot: "asc" },
    }),
    prisma.gameweek.findFirst({
      where: { status: { in: ["ACTIVE", "UPCOMING"] } },
      orderBy: { number: "asc" },
    }),
  ]);

  const hasAwayDayPick = activeGw
    ? !!(await prisma.awayDayPick.findFirst({
        where: { userId, gameweekId: activeGw.id, voided: false },
      }))
    : false;

  const upcomingFixtures: FixtureOption[] = activeGw
    ? (
        await prisma.fixture.findMany({
          where: { gameweekId: activeGw.id, status: "UPCOMING" },
          select: { id: true, homeTeam: true, awayTeam: true, underdogSide: true, kickoff: true },
          orderBy: { kickoff: "asc" },
        })
      ).map((f) => ({
        id: f.id,
        homeTeam: f.homeTeam,
        awayTeam: f.awayTeam,
        underdogSide: f.underdogSide as "home" | "away" | null,
        kickoff: f.kickoff.toISOString(),
      }))
    : [];

  return { chips, activeGw, upcomingFixtures, hasAwayDayPick };
}

export default async function BoostsPage() {
  const session = await getServerSession(authOptions);
  const { chips, activeGw, upcomingFixtures, hasAwayDayPick } = await getData(session!.user.id);

  // Build two chip slots — one per season half
  const slot1 = chips.find((c) => c.slot === 1);
  const slot2 = chips.find((c) => c.slot === 2);

  // Slot-1 is expired if: DB flag is set, OR we're in GW20+ and it was never activated.
  // The second condition handles users who never created a chip record — there's no DB row
  // to mark, so we derive expiry from the current gameweek instead (§5.3).
  const isAfterGw19 = (activeGw?.number ?? 0) > 19;
  const slot1Expired =
    (slot1?.expired ?? false) || (isAfterGw19 && !slot1?.activatedAt);

  const chipInfos: BoostChipInfo[] = [
    {
      slot: 1,
      type: (slot1?.type ?? null) as BoostChipInfo["type"],
      activated: !!slot1?.activatedAt,
      expired: slot1Expired,
      activatedGameweek: slot1?.gameweekId ?? undefined,
      activatedFixtureId: slot1?.fixtureId ?? undefined,
    },
    {
      slot: 2,
      type: (slot2?.type ?? null) as BoostChipInfo["type"],
      activated: !!slot2?.activatedAt,
      expired: slot2?.expired ?? false,
      activatedGameweek: slot2?.gameweekId ?? undefined,
      activatedFixtureId: slot2?.fixtureId ?? undefined,
    },
  ];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-black text-white">Boosts</h1>
        <p className="mt-1 text-sm text-white/50">
          You have 2 boost chips per season. Use them wisely.
        </p>
      </header>

      <BoostsView
        chips={chipInfos}
        currentGameweek={activeGw?.number ?? 1}
        gameweekId={activeGw?.id ?? 0}
        isSecondHalf={(activeGw?.number ?? 0) > 19}
        upcomingFixtures={upcomingFixtures}
        hasAwayDayPick={hasAwayDayPick}
      />
    </div>
  );
}
