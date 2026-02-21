import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import BoostsView from "./BoostsView";
import type { BoostChipInfo } from "@/types/matchday";

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
  return { chips, activeGw };
}

export default async function BoostsPage() {
  const session = await getServerSession(authOptions);
  const { chips, activeGw } = await getData(session!.user.id);

  // Build two chip slots — one per season half
  const slot1 = chips.find((c) => c.slot === 1);
  const slot2 = chips.find((c) => c.slot === 2);

  const chipInfos: BoostChipInfo[] = [
    {
      slot: 1,
      type: (slot1?.type ?? null) as BoostChipInfo["type"],
      activated: !!slot1?.activatedAt,
      expired: slot1?.expired ?? false,
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
      />
    </div>
  );
}
