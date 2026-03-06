import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import BottomNav from "@/components/layout/BottomNav";

export const dynamic = "force-dynamic";

/**
 * Derive the current API-Football season from a date.
 * Aug–Dec = current year, Jan–Jul = previous year.
 */
function currentSeason(): number {
  const now = new Date();
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

/**
 * Determine which gameweek is "current" based on fixture dates.
 * Returns the seasonNumber (1-38) of the current gameweek, or null.
 */
function detectCurrentGameweek(
  gameweeks: { seasonNumber: number; startDate: Date | null; endDate: Date | null; fixtures: { kickoff: Date }[] }[]
): number | null {
  const now = Date.now();

  // 1. GW whose date range spans now
  for (const gw of gameweeks) {
    if (gw.startDate && gw.endDate) {
      const start = gw.startDate.getTime() - 24 * 60 * 60 * 1000; // 1 day buffer before
      const end = gw.endDate.getTime() + 3 * 60 * 60 * 1000;       // 3h buffer after last KO
      if (now >= start && now <= end) return gw.seasonNumber;
    }
  }

  // 2. Next upcoming GW (first one with fixtures in the future)
  const upcoming = gameweeks
    .filter((gw) => gw.fixtures.some((f) => f.kickoff.getTime() > now))
    .sort((a, b) => a.seasonNumber - b.seasonNumber);
  if (upcoming.length > 0) return upcoming[0].seasonNumber;

  // 3. Most recent GW
  const past = gameweeks
    .filter((gw) => gw.fixtures.every((f) => f.kickoff.getTime() < now))
    .sort((a, b) => b.seasonNumber - a.seasonNumber);
  if (past.length > 0) return past[0].seasonNumber;

  return null;
}

export default async function SchedulePage() {
  const session = await getServerSession(authOptions);
  const isSignedIn = !!session;
  const season = currentSeason();

  const gameweeks = await prisma.gameweek.findMany({
    where: { season },
    orderBy: { seasonNumber: "asc" },
    include: {
      fixtures: {
        orderBy: { kickoff: "asc" },
        select: {
          id: true,
          homeTeam: true,
          awayTeam: true,
          kickoff: true,
          status: true,
          homeScore: true,
          awayScore: true,
        },
      },
    },
  });

  const currentGw = detectCurrentGameweek(
    gameweeks.map((gw) => ({
      seasonNumber: gw.seasonNumber,
      startDate: gw.startDate,
      endDate: gw.endDate,
      fixtures: gw.fixtures,
    }))
  );

  const seasonLabel = `${season}/${(season + 1).toString().slice(-2)}`;

  return (
    <div className={["min-h-screen bg-aubergine", isSignedIn ? "pb-20" : ""].join(" ").trim()}>
      <div className="mx-auto max-w-xl px-4 pb-8 pt-8">
        <header className="mb-6">
          <h1 className="text-2xl font-black text-white">Season Schedule</h1>
          <p className="mt-0.5 text-sm text-white/40">{seasonLabel} — All 38 gameweeks</p>
        </header>

        {gameweeks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/20 px-4 py-8 text-center">
            <p className="text-sm text-white/40">
              No fixtures synced yet. Run a sync to pull the schedule.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {gameweeks.map((gw) => {
              const isCurrent = gw.seasonNumber === currentGw;
              const allFinished = gw.fixtures.every((f) => f.status === "FINISHED");
              const anyLive = gw.fixtures.some((f) => f.status === "LIVE");
              const hasResults = gw.fixtures.some((f) => f.homeScore !== null);

              return (
                <section
                  key={gw.id}
                  id={`gw-${gw.seasonNumber}`}
                  className={[
                    "rounded-xl border px-4 py-4",
                    isCurrent
                      ? "border-electric-cyan/40 bg-electric-cyan/5"
                      : allFinished
                        ? "border-white/10 bg-white/[0.02]"
                        : "border-white/10",
                  ].join(" ")}
                >
                  {/* GW Header */}
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-white">
                        Gameweek {gw.seasonNumber}
                      </h2>
                      {isCurrent && (
                        <span className="rounded-full bg-electric-cyan/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-electric-cyan">
                          Current
                        </span>
                      )}
                      {anyLive && (
                        <span className="rounded-full bg-electric-cyan/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-electric-cyan">
                          Live
                        </span>
                      )}
                    </div>
                    {isSignedIn && (
                      <Link
                        href={`/gameweek/${gw.id}`}
                        className="text-xs font-semibold text-hot-pink hover:text-hot-pink/80"
                      >
                        {allFinished ? "Review" : "Predict"} →
                      </Link>
                    )}
                  </div>

                  {/* Fixture rows */}
                  <div className="space-y-1.5">
                    {gw.fixtures.map((f) => {
                      const isFinished = f.status === "FINISHED";
                      const isLive = f.status === "LIVE";
                      const isPostponed = f.status === "POSTPONED";
                      const kickoff = new Date(f.kickoff);

                      return (
                        <div
                          key={f.id}
                          className={[
                            "flex items-center justify-between rounded-lg px-3 py-2 text-xs",
                            isLive ? "bg-electric-cyan/10" : "bg-white/[0.03]",
                          ].join(" ")}
                        >
                          {/* Home team */}
                          <span className="w-[110px] truncate text-right font-medium text-white">
                            {f.homeTeam}
                          </span>

                          {/* Score or kickoff time */}
                          <span className="mx-2 min-w-[48px] text-center">
                            {isPostponed ? (
                              <span className="text-hot-pink font-semibold">PP</span>
                            ) : hasResults && (isFinished || isLive) ? (
                              <span className={isLive ? "font-bold text-electric-cyan" : "font-semibold text-white"}>
                                {f.homeScore} - {f.awayScore}
                              </span>
                            ) : (
                              <span className="text-white/40">
                                {kickoff.toLocaleTimeString("en-GB", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  hour12: false,
                                  timeZone: "Europe/London",
                                })}
                              </span>
                            )}
                          </span>

                          {/* Away team */}
                          <span className="w-[110px] truncate font-medium text-white">
                            {f.awayTeam}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Date range */}
                  {gw.startDate && (
                    <p className="mt-2 text-[10px] text-white/25">
                      {new Date(gw.startDate).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        timeZone: "Europe/London",
                      })}
                      {gw.endDate && gw.endDate.getTime() !== gw.startDate.getTime() && (
                        <>
                          {" — "}
                          {new Date(gw.endDate).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            timeZone: "Europe/London",
                          })}
                        </>
                      )}
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {/* Sign-in CTA for anonymous users */}
        {!isSignedIn && (
          <div className="mt-8 rounded-xl border border-hot-pink/20 bg-hot-pink/5 px-4 py-5 text-center">
            <p className="text-sm font-semibold text-white">Want to predict the scores?</p>
            <p className="mt-0.5 text-xs text-white/50">
              Sign in to make predictions, earn points and compete with friends.
            </p>
            <Link
              href="/auth/signin"
              className="mt-3 inline-block rounded-lg bg-hot-pink px-5 py-2 text-sm font-bold text-white"
            >
              Sign in to predict →
            </Link>
          </div>
        )}

        <p className="mt-6 text-center text-[10px] text-white/20">
          Fixtures via community data
        </p>
      </div>

      {isSignedIn && <BottomNav />}
    </div>
  );
}
