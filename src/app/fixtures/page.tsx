import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { Fixture } from "@/types/matchday";
import FixturesList from "./FixturesList";
import BottomNav from "@/components/layout/BottomNav";
import Link from "next/link";

// DB reads need fresh data on every request — opt out of static rendering
export const dynamic = "force-dynamic";

async function getCurrentGameweek() {
  const fixturesFilter = { fixtures: { some: {} } } as const;

  // 1. Any ACTIVE gameweek (live matches right now)
  const active = await prisma.gameweek.findFirst({
    where: { status: "ACTIVE", ...fixturesFilter },
    include: { fixtures: { orderBy: { kickoff: "asc" } } },
  });
  if (active) return active;

  // 2. Date-aware detection: find the gameweek whose fixtures bracket "now".
  //    This handles stale statuses — even if the worker hasn't run, we show the
  //    correct matchday based on actual kickoff times.
  const now = new Date();
  const dateAware = await prisma.gameweek.findFirst({
    where: {
      ...fixturesFilter,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    include: { fixtures: { orderBy: { kickoff: "asc" } } },
  });
  if (dateAware) return dateAware;

  // 3. If between matchdays, show the nearest upcoming gameweek whose first
  //    fixture hasn't kicked off yet.
  const nextUpcoming = await prisma.gameweek.findFirst({
    where: {
      ...fixturesFilter,
      fixtures: { some: { kickoff: { gt: now } } },
    },
    orderBy: { number: "asc" },
    include: { fixtures: { orderBy: { kickoff: "asc" } } },
  });
  if (nextUpcoming) return nextUpcoming;

  // 4. Fallback: the most recently finished gameweek (all fixtures in the past).
  const lastFinished = await prisma.gameweek.findFirst({
    where: {
      ...fixturesFilter,
      fixtures: { some: { kickoff: { lt: now } } },
    },
    orderBy: { number: "desc" },
    include: { fixtures: { orderBy: { kickoff: "asc" } } },
  });
  return lastFinished;
}

export default async function FixturesPage() {
  const [gameweek, session] = await Promise.all([
    getCurrentGameweek(),
    getServerSession(authOptions),
  ]);

  const isSignedIn = !!session;
  const canPredict = gameweek && (gameweek.status === "ACTIVE" || gameweek.status === "UPCOMING");

  const fixtures: Fixture[] = (gameweek?.fixtures ?? []).map((f) => ({
    id: f.id,
    homeTeam: f.homeTeam,
    awayTeam: f.awayTeam,
    kickoff: f.kickoff,
    status: f.status as Fixture["status"],
    homeScore: f.homeScore,
    awayScore: f.awayScore,
    underdogSide: f.underdogSide as Fixture["underdogSide"],
  }));

  return (
    <div className={["min-h-screen bg-aubergine", isSignedIn ? "pb-20" : ""].join(" ").trim()}>
      <div className="mx-auto max-w-xl px-4 pb-8 pt-8">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-black text-white">
              {gameweek ? `Gameweek ${gameweek.seasonNumber || gameweek.number}` : "Fixtures"}
            </h1>
            {gameweek && (
              <p className="mt-0.5 text-sm capitalize text-white/40">
                {gameweek.status.toLowerCase()}
              </p>
            )}
          </div>
          <Link
            href="/schedule"
            className="mt-1 text-xs font-semibold text-hot-pink hover:text-hot-pink/80"
          >
            Full schedule →
          </Link>
        </div>

        {fixtures.length === 0 ? (
          <div className="rounded-xl border border-white/10 px-4 py-8 text-center">
            <p className="text-sm text-white/50">No fixtures available.</p>
          </div>
        ) : (
          <FixturesList initialFixtures={fixtures} />
        )}

        {/* Bottom CTA: different for signed-in vs anonymous */}
        {isSignedIn ? (
          canPredict && (
            <div className="mt-8 rounded-xl border border-hot-pink/20 bg-hot-pink/5 px-4 py-5 text-center">
              <p className="text-sm font-semibold text-white">
                Gameweek {gameweek!.seasonNumber || gameweek!.number} predictions are open
              </p>
              <Link
                href={`/gameweek/${gameweek!.id}`}
                className="mt-3 inline-block rounded-lg bg-hot-pink px-5 py-2 text-sm font-bold text-white"
              >
                Predict now →
              </Link>
            </div>
          )
        ) : (
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

      {/* BottomNav for signed-in users (replaces sign-in CTA) */}
      {isSignedIn && <BottomNav />}
    </div>
  );
}
