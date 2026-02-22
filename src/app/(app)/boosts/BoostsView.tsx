"use client";

import { useState } from "react";
import BoostPanel from "@/components/boosts/BoostPanel";
import type { BoostChipInfo, BoostType } from "@/types/matchday";
import type { FixtureOption } from "./page";

interface BoostsViewProps {
  chips: BoostChipInfo[];
  currentGameweek: number;
  gameweekId: number;
  isSecondHalf: boolean;
  upcomingFixtures: FixtureOption[];
}

export default function BoostsView({
  chips,
  currentGameweek,
  gameweekId,
  isSecondHalf,
  upcomingFixtures,
}: BoostsViewProps) {
  const [localChips, setLocalChips] = useState(chips);
  const [error, setError] = useState("");

  async function handleActivate(slot: number, type: BoostType, fixtureId?: string) {
    setError("");
    const res = await fetch("/api/boosts/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slot, type, gameweekId, fixtureId }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Activation failed");
      throw new Error(d.error);
    }
    setLocalChips((prev) =>
      prev.map((c) =>
        c.slot === slot
          ? { ...c, type, activated: true, activatedGameweek: currentGameweek, activatedFixtureId: fixtureId }
          : c
      )
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg bg-hot-pink/20 px-3 py-2 text-sm text-hot-pink">{error}</p>
      )}

      <BoostPanel
        chips={localChips}
        currentGameweek={currentGameweek}
        onActivate={handleActivate}
        isSecondHalf={isSecondHalf}
        upcomingFixtures={upcomingFixtures}
      />

      {/* Rules reminder */}
      <div className="rounded-xl border border-white/10 px-4 py-4 space-y-2 text-xs text-white/40">
        <p>⚡ <strong className="text-white/60">Double Down</strong> — doubles your entire gameweek total. Applied last.</p>
        <p>🔥 <strong className="text-white/60">Out on the Town</strong> — upgrades your Away Day Pick from 2× to 3×. No effect without an Away Day Pick.</p>
        <p>⭐ <strong className="text-white/60">Underdog Boost</strong> — pick one fixture. If the underdog wins and your prediction is correct: 5 pts (exact) or 3 pts (result).</p>
        <p className="pt-1 text-hot-pink/70">Boost #1 must be used by GW19 or it expires. Boost #2 is available from GW20 onwards.</p>
      </div>
    </div>
  );
}
