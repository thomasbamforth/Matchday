import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getData(userId: string) {
  const [gameweeks, summaries] = await Promise.all([
    prisma.gameweek.findMany({
      orderBy: { number: "desc" },
      select: {
        id: true,
        number: true,
        status: true,
        _count: { select: { fixtures: true } },
      },
    }),
    prisma.userGameweekSummary.findMany({
      where: { userId },
      select: { gameweekId: true, finalPoints: true },
    }),
  ]);

  const pointsMap: Record<number, number> = {};
  for (const s of summaries) pointsMap[s.gameweekId] = s.finalPoints;

  return { gameweeks, pointsMap };
}

const STATUS_LABEL: Record<string, string> = {
  FINISHED: "Finished",
  ACTIVE:   "Live",
  UPCOMING: "Upcoming",
};

const STATUS_COLOR: Record<string, string> = {
  FINISHED: "text-white/40",
  ACTIVE:   "text-electric-cyan font-semibold",
  UPCOMING: "text-white/40",
};

export default async function GameweeksPage() {
  const session = await getServerSession(authOptions);
  const { gameweeks, pointsMap } = await getData(session!.user.id);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-black text-white">All Gameweeks</h1>
        <p className="mt-1 text-sm text-white/50">
          {gameweeks.length} gameweek{gameweeks.length !== 1 ? "s" : ""} in the database
        </p>
      </header>

      {gameweeks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/20 px-4 py-8 text-center">
          <p className="text-sm text-white/40">
            No gameweeks yet — the worker will create them on first sync.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {gameweeks.map((gw) => {
            const pts = pointsMap[gw.id];
            const isActive = gw.status === "ACTIVE";

            return (
              <Link
                key={gw.id}
                href={`/gameweek/${gw.id}`}
                className={[
                  "flex items-center justify-between rounded-xl border px-4 py-3 hover:bg-white/5",
                  isActive
                    ? "border-electric-cyan/30 bg-electric-cyan/5"
                    : "border-white/10",
                ].join(" ")}
              >
                <div>
                  <p className="text-sm font-semibold text-white">
                    Gameweek {gw.number}
                  </p>
                  <p className={["mt-0.5 text-xs", STATUS_COLOR[gw.status]].join(" ")}>
                    {STATUS_LABEL[gw.status]} · {gw._count.fixtures} fixture{gw._count.fixtures !== 1 ? "s" : ""}
                  </p>
                </div>

                <div className="text-right">
                  {pts !== undefined ? (
                    <p className="text-sm font-bold text-neon-green">{pts} pts</p>
                  ) : gw.status === "UPCOMING" ? (
                    <p className="text-xs text-white/30">No predictions yet</p>
                  ) : null}
                  <p className="text-xs text-hot-pink">View →</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
