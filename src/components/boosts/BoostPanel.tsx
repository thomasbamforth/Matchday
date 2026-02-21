"use client";

import { useState } from "react";
import ConfirmBanner from "@/components/ui/ConfirmBanner";
import type { BoostChipInfo, BoostType } from "@/types/matchday";

interface BoostPanelProps {
  chips: BoostChipInfo[];
  currentGameweek: number;
  /** Called when the user confirms activation */
  onActivate: (slot: number, type: BoostType) => Promise<void>;
  /** True during GW20+ — slot-1 chip is expired if unused */
  isSecondHalf: boolean;
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
}

/**
 * Boost chip panel — displays the user's two seasonal chips and handles activation.
 *
 * Per CLAUDE.md §8:
 *  - "Double Down activation: gold shimmer sweeps across entire gameweek strip"
 *  - "Boost activation always shows a hot pink confirmation warning banner. Cannot be undone."
 *  - Expired chip slot renders greyed-out (§9.3)
 */
export default function BoostPanel({
  chips,
  currentGameweek,
  onActivate,
  isSecondHalf,
}: BoostPanelProps) {
  const [pending, setPending] = useState<PendingActivation | null>(null);
  const [activating, setActivating] = useState(false);
  const [shimmer, setShimmer] = useState(false);

  async function confirmActivation() {
    if (!pending) return;
    setActivating(true);
    try {
      await onActivate(pending.slot, pending.type);
      if (pending.type === "DOUBLE_DOWN") {
        setShimmer(true);
        setTimeout(() => setShimmer(false), 1500);
      }
    } finally {
      setActivating(false);
      setPending(null);
    }
  }

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

      {/* Confirmation banner */}
      {pending && (
        <div className="mt-4">
          <ConfirmBanner
            message={`Activate ${BOOST_INFO[pending.type].name} for GW${currentGameweek}?`}
            onConfirm={confirmActivation}
            onCancel={() => setPending(null)}
            loading={activating}
          />
        </div>
      )}
    </div>
  );
}
