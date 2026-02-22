import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SignOutButton from "./SignOutButton";
import NotificationSettings from "./NotificationSettings";

async function getStats(userId: string) {
  const [summaries, scoredPredictions, leagueCount] = await Promise.all([
    // Season point totals
    prisma.userGameweekSummary.findMany({
      where: { userId },
      select: { finalPoints: true },
    }),
    // All predictions for finished fixtures — used to compute exact count
    prisma.prediction.findMany({
      where: { userId, fixture: { status: "FINISHED" } },
      select: {
        homeScore: true,
        awayScore: true,
        fixture: { select: { homeScore: true, awayScore: true } },
      },
    }),
    // Number of leagues the user belongs to
    prisma.leagueMember.count({ where: { userId } }),
  ]);

  const totalPoints   = summaries.reduce((sum, s) => sum + s.finalPoints, 0);
  const totalPredictions = scoredPredictions.length;
  const exactScores   = scoredPredictions.filter(
    (p) =>
      p.homeScore === p.fixture.homeScore &&
      p.awayScore === p.fixture.awayScore
  ).length;
  const gameweeksPlayed = summaries.length;

  return { totalPoints, totalPredictions, exactScores, gameweeksPlayed, leagueCount };
}

// ---------------------------------------------------------------------------
// Stat tile
// ---------------------------------------------------------------------------

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-white/10 px-3 py-4">
      <span className="text-2xl font-black tabular-nums text-white">{value}</span>
      <span className="mt-1 text-center text-[11px] leading-tight text-white/40">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  const user    = session!.user;

  const { totalPoints, totalPredictions, exactScores, gameweeksPlayed, leagueCount } =
    await getStats(user.id);

  const initials = (user.name ?? user.email ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="space-y-6">
      {/* ---- Avatar + name ---- */}
      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-white/10">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name ?? "Avatar"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-black text-white/60">
              {initials}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <h1 className="truncate text-2xl font-black text-white">
            {user.name ?? "Gaffer"}
          </h1>
          {user.email && (
            <p className="truncate text-sm text-white/40">{user.email}</p>
          )}
        </div>
      </div>

      {/* ---- Season stats ---- */}
      <section>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-white/40">
          Season
        </h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="Total points"    value={totalPoints} />
          <StatTile label="Gameweeks"       value={gameweeksPlayed} />
          <StatTile label="Predictions"     value={totalPredictions} />
          <StatTile label="Exact scores"    value={exactScores} />
        </div>
        {leagueCount > 0 && (
          <p className="mt-2 text-center text-xs text-white/30">
            Competing in {leagueCount} league{leagueCount !== 1 ? "s" : ""}
          </p>
        )}
      </section>

      {/* ---- Notification settings ---- */}
      <NotificationSettings />

      {/* ---- Sign out ---- */}
      <section>
        <SignOutButton />
      </section>

      <p className="pb-2 text-center text-[11px] text-white/20">
        Matchday · Built for fun · No official PL branding
      </p>
    </div>
  );
}
