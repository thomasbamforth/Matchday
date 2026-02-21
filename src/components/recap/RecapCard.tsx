"use client";

import { useEffect, useRef, useState } from "react";
import type { GameweekRecapData } from "@/types/matchday";

interface RecapCardProps {
  recap: GameweekRecapData;
}

const TYPEWRITER_SPEED_MS = 18;

/**
 * AI recap card with newspaper-unfold then typewriter reveal.
 *
 * Per CLAUDE.md §8:
 *  "AI recap delivery: crumpled newspaper unfolding → typewriter effect on aubergine background"
 */
export default function RecapCard({ recap }: RecapCardProps) {
  const [unfolded, setUnfolded] = useState(false);
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Unfold first, then start typewriter
  useEffect(() => {
    const unfoldTimer = setTimeout(() => {
      setUnfolded(true);
    }, 200);

    return () => clearTimeout(unfoldTimer);
  }, []);

  useEffect(() => {
    if (!unfolded) return;

    const text = recap.failed
      ? "The oracle is silent this week. Results were recorded, points distributed, dignity lost in the usual places."
      : recap.content;

    indexRef.current = 0;
    setDisplayed("");

    // Short delay before typing starts (let unfold animation finish)
    const startTimer = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        indexRef.current += 1;
        setDisplayed(text.slice(0, indexRef.current));

        if (indexRef.current >= text.length && intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      }, TYPEWRITER_SPEED_MS);
    }, 400);

    return () => {
      clearTimeout(startTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [unfolded, recap.content, recap.failed]);

  return (
    <div
      className={[
        "origin-center rounded-xl border border-white/10 bg-aubergine p-5",
        unfolded ? "animate-unfold" : "scale-[0.05] opacity-0 rotate-[-6deg]",
      ].join(" ")}
    >
      {/* Header */}
      <div className="mb-4 border-b border-white/10 pb-3">
        <p className="text-[10px] uppercase tracking-widest text-white/30">
          {recap.leagueName}
        </p>
        <h2 className="mt-0.5 font-bold text-white">
          Gameweek {recap.gameweekNumber} Recap
        </h2>
        {recap.failed && (
          <span className="mt-1 inline-block rounded bg-hot-pink/20 px-2 py-0.5 text-[10px] font-bold uppercase text-hot-pink">
            Generation failed
          </span>
        )}
      </div>

      {/* Typewriter text */}
      <div className="font-mono text-sm leading-relaxed text-white/90 whitespace-pre-wrap">
        {displayed}
        {/* Blinking cursor while typing */}
        {displayed.length < (recap.failed ? 120 : recap.content.length) && (
          <span className="animate-blink ml-0.5 inline-block w-0.5 h-[1em] bg-hot-pink align-middle" />
        )}
      </div>
    </div>
  );
}
