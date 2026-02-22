"use client";

import { useState } from "react";
import ConfirmBanner from "@/components/ui/ConfirmBanner";
import type { BoostChipInfo, BoostType } from "@/types/matchday";
import type { FixtureOption } from "@/app/(app)/boosts/page";

interface BoostPanelProps {
  chips: BoostChipInfo[];
  currentGameweek: number;
  /** Called when the user confirms activation */
  onActivate: (slot: number, type: BoostType, fixtureId?: string) => Promise<void>;
  /** True during GW20+ — slot-1 chip is expired if unused */
  isSecondHalf: boolean;
  /** Upcoming fixtures for Underdog Boost fixture selection */
  upcomingFixtures?: FixtureOption[];
}

const BOOST_INFO: Record<BoostType, { name: string; icon: string; description: string }> = {
  DOUBLE_DOWN: {
    name: "Double Down",
    icon: "⚡",
    description: "Doubles your entire gameweek points total. Applied last.",
  },
  OUT_ON_THE_TOWN: {
    name: "Out on the Town",
    icon: "🔥",
    description: "Upgrades your Away Day Pick multiplier from 2× to 3×. No effect without an Away Day Pick.",
  },
  UNDERDOG_BOOST: {
    name: "Underdog Boost",
    icon: "⭐",
    description: "Activate on one fixture. If the underdog wins and your prediction is correct: 5 pts (exact) or 3 pts (result).",
  },
};

interface PendingActivation {
  slot: number;
  type: BoostType;
  fixtureId?: string; // set after fixture selection for UNDERDOG_BOOST
}

/**
 * Boost chip panel — displays the user's two seasonal chips and handles activation.
 *
 * Per CLAUDE.md §8:
 *  - "Double Down activation: gold shimmer sweeps across entire gameweek strip"
 *  - "Boost activation always shows a hot pink confirmation warning banner. Cannot be undone."
 *  - Expired chip slot renders greyed-out (§9.3)
 *
 * Underdog Boost flow (two steps):
 *  1. User selects UNDERDOG_BOOST → fixture picker is shown
 *  2. User selects a fixture → ConfirmBanner shown
 *  3. User confirms → onActivate called with fixtureId
 */
export default function BoostPanel({
  chips,
  currentGameweek,
  onActivate,
  isSecondHalf,
  upcomingFixtures = [],
}: BoostPanelProps) {
  const [pending, setPending] = useState<PendingActivation | null>(null);
  const [activating, setActivating] = useState(false);
  const [shimmer, setShimmer] = useState(false);

  // True when UNDERDOG_BOOST is selected but fixture not yet chosen
  const needsFixtureSelection =
    pending?.type === "UNDERDOG_BOOST" && !pending.fixtureId;

  // True when ready to show the ConfirmBanner
  const readyToConfirm =
    pending !== null &&
    (pending.type !== "UNDERDOG_BOOST" || !!pending.fixtureId);

  async function confirmActivation() {
    if (!pending) return;
    setActivating(true);
    try {
      await onActivate(pending.slot, pending.type, pending.fixtureId);
      if (pending.type === "DOUBLE_DOWN") {
        setShimmer(true);
        setTimeout(() => setShimmer(false), 1500);
      }
    } finally {
      setActivating(false);
      setPending(null);
    }
  }

  function cancelPending() {
    setPending(null);
  }

  const pendingFixture = pending?.fixtureId
    ? upcomingFixtures.find((f) => f.id === pending.fixtureId)
    : null;

  return (
    <div className={["relative rounded-xl border border-white/10 p-4", shimmer ? "animate-gold-shimmer gold-shimmer-bg" : ""].join(" ")}>
      <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-white/50">
        Your Boosts
      </h3>

      <div className="space-y-3">
        {chips.map((chip) => {
          const isSlot1Expired = chip.slot === 1 && isSecondHalf && !chip.activated;
          const isUsed = chip.activated;
          const isExpired = chip.expired || isSlot1Expired;
          const type = chip.type;

          return (
            <div
              key={chip.slot}
              className={[
                "rounded-lg border p-3 transition-opacity",
                isExpired || isUsed
                  ? "border-white/5 opacity-30"
                  : "border-white/15",
              ].join(" ")}
            >
              {isExpired && !isUsed ? (
                <div className="flex items-center gap-2">
                  <span className="text-lg grayscale">🚫</span>
                  <div>
                    <p className="text-sm font-semibold text-white/50">
                      Slot {chip.slot} — Expired
                    </p>
                    <p className="text-xs text-white/30">
                      Boost #1 must be used by GW19.
                    </p>
                  </div>
                </div>
              ) : type ? (
                // Chip has been assigned a type
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{BOOST_INFO[type].icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {BOOST_INFO[type].name}
                      </p>
                      <p className="text-xs text-white/40">
                        {isUsed
                          ? `Used — GW${chip.activatedGameweek ?? currentGameweek}`
                          : BOOST_INFO[type].description}
                      </p>
                    </div>
                  </div>

                  {!isUsed && !isExpired && (
                    <button
                      onClick={() => setPending({ slot: chip.slot, type })}
                      className="shrink-0 rounded-lg bg-hot-pink px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                    >
                      Activate
                    </button>
                  )}

                  {isUsed && (
                    <span className="shrink-0 text-xs text-neon-green">✓ Used</span>
                  )}
                </div>
              ) : (
                // Slot available — user picks which boost to apply
                <div>
                  <p className="mb-2 text-xs text-white/50">
                    Slot {chip.slot}{chip.slot === 1 ? " (must use by GW19)" : " (GW20+)"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(["DOUBLE_DOWN", "OUT_ON_THE_TOWN", "UNDERDOG_BOOST"] as BoostType[]).map(
                      (bt) => (
                        <button
                          key={bt}
                          onClick={() => setPending({ slot: chip.slot, type: bt })}
                          className="rounded-lg border border-hot-pink/40 bg-hot-pink/10 px-2.5 py-1.5 text-xs font-semibold text-hot-pink hover:bg-hot-pink/20"
                        >
                          {BOOST_INFO[bt].icon} {BOOST_INFO[bt].name}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Step 2 — Underdog Boost fixture picker */}
      {needsFixtureSelection && (
        <div className="mt-4 rounded-xl border border-neon-green/20 bg-neon-green/5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">
              ⭐ Pick a fixture for your Underdog Boost
            </p>
            <button
              onClick={cancelPending}
              className="text-xs text-white/40 hover:text-white"
            >
              Cancel
            </button>
          </div>

          {upcomingFixtures.length === 0 ? (
            <p className="text-xs text-white/50">
              No upcoming fixtures available yet. Check back closer to the gameweek.
            </p>
          ) : (
            <div className="space-y-2">
              {upcomingFixtures.map((f) => {
                const underdogTeam =
                  f.underdogSide === "home"
                    ? f.homeTeam
                    : f.underdogSide === "away"
                    ? f.awayTeam
                    : null;

                return (
                  <button
                    key={f.id}
                    onClick={() =>
                      setPending((prev) => prev ? { ...prev, fixtureId: f.id } : prev)
                    }
                    className="w-full rounded-lg border border-white/10 px-3 py-2.5 text-left hover:border-neon-green/40 hover:bg-neon-green/5 transition-colors"
                  >
                    <p className="text-sm text-white">
                      {f.homeTeam}{" "}
                      <span className="text-white/40">vs</span>{" "}
                      {f.awayTeam}
                    </p>
                    {underdogTeam ? (
                      <p className="mt-0.5 text-xs text-neon-green">
                        ⭐ {underdogTeam} is the underdog
                      </p>
                    ) : (
                      <p className="mt-0.5 text-xs text-white/30">
                        Underdog not yet designated
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Step 3 — Confirmation banner */}
      {readyToConfirm && pending && (
        <div className="mt-4">
          <ConfirmBanner
            message={
              pending.type === "UNDERDOG_BOOST" && pendingFixture
                ? `Activate Underdog Boost on ${pendingFixture.homeTeam} vs ${pendingFixture.awayTeam} for GW${currentGameweek}? Cannot be undone.`
                : `Activate ${BOOST_INFO[pending.type].name} for GW${currentGameweek}? Cannot be undone.`
            }
            onConfirm={confirmActivation}
            onCancel={cancelPending}
            loading={activating}
          />
        </div>
      )}
    </div>
  );
}
