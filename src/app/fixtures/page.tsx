import { prisma } from "@/lib/prisma";
import type { Fixture } from "@/types/matchday";
import FixturesList from "./FixturesList";
import Link from "next/link";

// DB reads need fresh data on every request — opt out of static rendering
export const dynamic = "force-dynamic";

async function getCurrentGameweek() {
  // Try ACTIVE first, then earliest UPCOMING, then most recent FINISHED
  const gameweek =
    (await prisma.gameweek.findFirst({
      where: { status: { in: ["ACTIVE", "UPCOMING"] } },
      orderBy: { number: "asc" },
      include: { fixtures: { orderBy: { kickoff: "asc" } } },
    })) ??
    (await prisma.gameweek.findFirst({
      where: { status: "FINISHED" },
      orderBy: { number: "desc" },
      include: { fixtures: { orderBy: { kickoff: "asc" } } },
    }));

  return gameweek;
}

export default async function FixturesPage() {
  const gameweek = await getCurrentGameweek();

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
    <div className="min-h-screen bg-aubergine">
      <div className="mx-auto max-w-xl px-4 pb-16 pt-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-white">
            {gameweek ? `Gameweek ${gameweek.number}` : "Fixtures"}
          </h1>
          {gameweek && (
            <p className="mt-0.5 text-sm capitalize text-white/40">
              {gameweek.status.toLowerCase()}
            </p>
          )}
        </div>

        {fixtures.length === 0 ? (
          <div className="rounded-xl border border-white/10 px-4 py-8 text-center">
            <p className="text-sm text-white/50">No fixtures available.</p>
          </div>
        ) : (
          <FixturesList initialFixtures={fixtures} />
        )}

        {/* Sign-in CTA */}
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

        <p className="mt-6 text-center text-[10px] text-white/20">
          Fixtures via community data
        </p>
      </div>
    </div>
  );
}
