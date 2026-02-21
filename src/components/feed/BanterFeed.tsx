"use client";

import { useEffect, useRef, useState } from "react";
import type { BanterEntry } from "@/types/matchday";

interface BanterFeedProps {
  entries: BanterEntry[];
}

const CONFETTI_COLORS = [
  "#FF2D7A", // hot-pink
  "#00E5FF", // electric-cyan
  "#39FF14", // neon-green
  "#FFD700", // gold
  "#FFFFFF", // white
];

interface ConfettiPiece {
  id: number;
  color: string;
  left: string;
  delay: string;
  duration: string;
  rotation: string;
}

function makeConfetti(count = 18): ConfettiPiece[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: `${Math.random() * 90 + 5}%`,
    delay: `${Math.random() * 0.4}s`,
    duration: `${0.9 + Math.random() * 0.5}s`,
    rotation: `${Math.random() * 360}deg`,
  }));
}

interface FeedRowProps {
  entry: BanterEntry;
}

function FeedRow({ entry }: FeedRowProps) {
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const triggered = useRef(false);

  // Fire confetti once on mount for exact scores
  useEffect(() => {
    if (entry.isExact && !triggered.current) {
      triggered.current = true;
      setConfetti(makeConfetti());
      setTimeout(() => setConfetti([]), 1500);
    }
  }, [entry.isExact]);

  const pointsColor =
    entry.points >= 3
      ? "text-neon-green"
      : entry.points === 1
      ? "text-electric-cyan"
      : "text-hot-pink";

  return (
    <div className="relative flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/5">
      {/* Confetti burst */}
      {confetti.map((piece) => (
        <span
          key={piece.id}
          aria-hidden="true"
          className="confetti-piece pointer-events-none"
          style={{
            left: piece.left,
            top: "50%",
            backgroundColor: piece.color,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
            transform: `rotate(${piece.rotation})`,
          }}
        />
      ))}

      {/* Avatar */}
      <div className="mt-0.5 h-7 w-7 shrink-0 overflow-hidden rounded-full bg-white/10">
        {entry.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={entry.avatarUrl} alt={entry.username} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-white/60">
            {entry.username.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="text-sm font-semibold text-white">{entry.username}</span>
          <span className="text-xs text-white/40">predicted</span>
          <span className="font-mono text-xs text-white">
            {entry.homeTeam} {entry.predicted} {entry.awayTeam}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-xs text-white/40">
            Result: <span className="text-white">{entry.actual}</span>
          </span>
          {entry.isExact && (
            <span className="text-xs font-bold text-neon-green">✓ Exact!</span>
          )}
        </div>
      </div>

      {/* Points */}
      <span className={["shrink-0 text-sm font-bold tabular-nums", pointsColor].join(" ")}>
        {entry.points > 0 ? `+${entry.points}` : "0"} pt{entry.points !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

/**
 * Scrolling banter feed showing recent predictions and outcomes.
 * Exact-score entries trigger confetti. Per CLAUDE.md §8.
 */
export default function BanterFeed({ entries }: BanterFeedProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 px-4 py-8 text-center">
        <p className="text-sm text-white/40">Predictions will appear here once matches kick off.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10">
      <div className="border-b border-white/10 px-4 py-2.5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">
          Banter Feed
        </h3>
      </div>
      <div className="divide-y divide-white/5 p-1">
        {entries.map((entry) => (
          <FeedRow key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
