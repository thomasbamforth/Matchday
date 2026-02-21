"use client";

import { useEffect, useRef, useState } from "react";
import BoostChipBadge from "@/components/ui/BoostChipBadge";
import type { LeaderboardEntry } from "@/types/matchday";

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
}

type Movement = "up" | "down" | "none";

/**
 * Single leaderboard row with rank-movement animation.
 *
 * Per CLAUDE.md §8:
 *  - Up: smooth counter, neon green
 *  - Down: smooth counter, hot pink
 *  - User's own row pinned + highlighted in deep aubergine
 *  - Active boosts shown as chip icons next to username
 */
export default function LeaderboardRow({ entry, isCurrentUser }: LeaderboardRowProps) {
  const prevRank = useRef(entry.rank);
  const [movement, setMovement] = useState<Movement>("none");
  const animTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const diff = prevRank.current - entry.rank; // positive = moved up
    if (diff > 0) setMovement("up");
    else if (diff < 0) setMovement("down");
    else setMovement("none");

    prevRank.current = entry.rank;

    if (animTimeout.current) clearTimeout(animTimeout.current);
    animTimeout.current = setTimeout(() => setMovement("none"), 700);

    return () => {
      if (animTimeout.current) clearTimeout(animTimeout.current);
    };
  }, [entry.rank]);

  const rankDiff = entry.previousRank - entry.rank;

  return (
    <div
      className={[
        "flex items-center gap-3 rounded-xl px-4 py-3 transition-colors",
        isCurrentUser
          ? "sticky bottom-0 border border-white/20 bg-aubergine shadow-lg shadow-black/40"
          : "border border-transparent hover:bg-white/5",
      ].join(" ")}
    >
      {/* Rank */}
      <div className="w-6 shrink-0 text-center">
        <span
          className={[
            "text-base font-bold tabular-nums",
            movement === "up"   ? "animate-rank-up text-neon-green"  : "",
            movement === "down" ? "animate-rank-down text-hot-pink"  : "",
            movement === "none" ? "text-white/60" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {entry.rank}
        </span>
      </div>

      {/* Movement arrow */}
      <div className="w-4 shrink-0 text-xs">
        {rankDiff > 0 && <span className="text-neon-green">▲</span>}
        {rankDiff < 0 && <span className="text-hot-pink">▼</span>}
        {rankDiff === 0 && <span className="text-white/20">–</span>}
      </div>

      {/* Avatar */}
      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/10">
        {entry.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.avatarUrl} alt={entry.username} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-white/60">
            {entry.username.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      {/* Username + boosts */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-white">
            {entry.username}
          </span>
          {entry.activeBoosts.map((type) => (
            <BoostChipBadge key={type} type={type} size="sm" />
          ))}
        </div>
      </div>

      {/* Points */}
      <div className="shrink-0 text-right">
        <p className="text-base font-bold tabular-nums text-white">
          {entry.gameweekPoints}
        </p>
        <p className="text-[11px] tabular-nums text-white/40">{entry.seasonTotal} total</p>
      </div>
    </div>
  );
}
