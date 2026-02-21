"use client";

import { useEffect, useRef, useState } from "react";
import type { Fixture, UserPrediction } from "@/types/matchday";
import LivePulse from "@/components/fixtures/LivePulse";

interface FixtureCardProps {
  fixture: Fixture;
  prediction?: UserPrediction;
  isAwayDayPickFixture?: boolean;
  hasUnderdogBoost?: boolean;
  onTap?: () => void;
}

function formatKickoff(date: Date): string {
  return new Date(date).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

function outcomeLabel(prediction: UserPrediction, fixture: Fixture): string | null {
  if (fixture.status !== "FINISHED") return null;
  if (fixture.homeScore === null) return null;
  const exactMatch =
    prediction.homeScore === fixture.homeScore &&
    prediction.awayScore === fixture.awayScore;
  if (exactMatch) return "exact";
  const predResult =
    prediction.homeScore > prediction.awayScore
      ? "home"
      : prediction.homeScore < prediction.awayScore
      ? "away"
      : "draw";
  const actualResult =
    fixture.homeScore > (fixture.awayScore ?? 0)
      ? "home"
      : (fixture.homeScore ?? 0) < (fixture.awayScore ?? 0)
      ? "away"
      : "draw";
  if (predResult === actualResult) return "correct";
  return "wrong";
}

/**
 * Core fixture display card.
 *
 * Animations (CLAUDE.md §8):
 *  - Background flashes electric cyan on live score change
 *  - Neon-green trophy icon slides across on exact score confirmation
 *  - Hot pink fireworks glow when Away Day Pick wins
 */
export default function FixtureCard({
  fixture,
  prediction,
  isAwayDayPickFixture = false,
  hasUnderdogBoost = false,
  onTap,
}: FixtureCardProps) {
  const prevScore = useRef<{ h: number | null; a: number | null }>({
    h: fixture.homeScore,
    a: fixture.awayScore,
  });
  const [flashing, setFlashing] = useState(false);
  const [showTrophy, setShowTrophy] = useState(false);
  const [showFireworks, setShowFireworks] = useState(false);

  // Detect live score change → cyan flash
  useEffect(() => {
    const prev = prevScore.current;
    const scoreChanged =
      fixture.status === "LIVE" &&
      (prev.h !== fixture.homeScore || prev.a !== fixture.awayScore);

    if (scoreChanged) {
      setFlashing(true);
      setTimeout(() => setFlashing(false), 900);
    }
    prevScore.current = { h: fixture.homeScore, a: fixture.awayScore };
  }, [fixture.homeScore, fixture.awayScore, fixture.status]);

  // Trophy slide on exact score confirmed
  useEffect(() => {
    if (!prediction || fixture.status !== "FINISHED") return;
    const outcome = outcomeLabel(prediction, fixture);
    if (outcome === "exact") {
      setShowTrophy(true);
      setTimeout(() => setShowTrophy(false), 1700);
    }
  }, [fixture.status, prediction, fixture]);

  // Fireworks on Away Day Pick win
  useEffect(() => {
    if (!isAwayDayPickFixture || fixture.status !== "FINISHED") return;
    const awayWon =
      fixture.awayScore !== null &&
      fixture.homeScore !== null &&
      fixture.awayScore > fixture.homeScore;
    if (awayWon) {
      setShowFireworks(true);
      setTimeout(() => setShowFireworks(false), 900);
    }
  }, [fixture.status, isAwayDayPickFixture, fixture.homeScore, fixture.awayScore]);

  const outcome = prediction ? outcomeLabel(prediction, fixture) : null;
  const isPostponed = fixture.status === "POSTPONED";

  return (
    <button
      onClick={onTap}
      disabled={!onTap}
      className={[
        "relative w-full overflow-hidden rounded-xl border px-4 py-3 text-left transition-colors",
        flashing ? "animate-cyan-flash" : "",
        showFireworks ? "animate-fireworks" : "",
        isPostponed
          ? "border-white/10 opacity-50"
          : "border-white/10 hover:border-white/20 hover:bg-white/5",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Trophy slide overlay */}
      {showTrophy && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center animate-trophy-slide"
        >
          <span className="text-3xl text-neon-green">🏆</span>
        </div>
      )}

      {/* Header row: status + badges */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {fixture.status === "LIVE" && <LivePulse />}
          {fixture.status === "UPCOMING" && (
            <span className="text-xs text-white/50">{formatKickoff(fixture.kickoff)}</span>
          )}
          {fixture.status === "FINISHED" && (
            <span className="text-xs text-white/40">FT</span>
          )}
          {isPostponed && (
            <span className="text-xs font-bold uppercase text-hot-pink">Postponed</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {isAwayDayPickFixture && (
            <span className="rounded bg-hot-pink/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-hot-pink">
              Away Pick
            </span>
          )}
          {hasUnderdogBoost && (
            <span className="rounded bg-neon-green/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-neon-green">
              ⭐ Underdog
            </span>
          )}
        </div>
      </div>

      {/* Scoreline */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex-1 truncate text-sm font-semibold text-white">
          {fixture.homeTeam}
        </span>

        <div className="flex items-center gap-2 text-center">
          {fixture.status === "UPCOMING" ? (
            <span className="text-sm text-white/40">vs</span>
          ) : (
            <span className="min-w-[40px] text-center text-lg font-bold text-electric-cyan">
              {fixture.homeScore ?? "–"} – {fixture.awayScore ?? "–"}
            </span>
          )}
        </div>

        <span className="flex-1 truncate text-right text-sm font-semibold text-white">
          {fixture.awayTeam}
        </span>
      </div>

      {/* User prediction row */}
      {prediction && (
        <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2">
          <span className="text-xs text-white/50">
            Your prediction:{" "}
            <span className="font-mono text-white">
              {prediction.homeScore}–{prediction.awayScore}
            </span>
          </span>

          {prediction.points !== undefined && (
            <span
              className={[
                "text-sm font-bold",
                outcome === "exact"   ? "text-neon-green" : "",
                outcome === "correct" ? "text-electric-cyan" : "",
                outcome === "wrong"   ? "text-hot-pink" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {outcome === "exact" && "✓ "}
              {prediction.points} pt{prediction.points !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Tap-to-predict prompt when no prediction yet */}
      {!prediction && fixture.status === "UPCOMING" && onTap && (
        <div className="mt-2 border-t border-white/10 pt-2">
          <span className="text-xs text-hot-pink">Tap to predict →</span>
        </div>
      )}
    </button>
  );
}
