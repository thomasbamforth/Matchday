"use client";

import { useState } from "react";
import ConfirmBanner from "@/components/ui/ConfirmBanner";
import type { BoostChipInfo, BoostType } from "@/types/matchday";
import type { FixtureOption } from "@/app/(app)/boosts/page";

interface BoostPanelProps {
  chips: BoostChipInfo[];
  currentGameweek: number;
  onActivate: (slot: number, type: BoostType, fixtureId?: string) => Promise<void>;
  /** True during GW20+ — slot-1 chip is expired if unused; slot-2 is now available */
  isSecondHalf: boolean;
  /** Whether the user has an active Away Day Pick this gameweek */
  hasAwayDayPick: boolean;
  upcomingFixtures?: FixtureOption[];
}

// ---------------------------------------------------------------------------
// SVG icons (no emojis per CLAUDE.md)
// ---------------------------------------------------------------------------

function IconZap({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconTarget({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function IconStar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconLock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Boost metadata
// ---------------------------------------------------------------------------

const BOOST_INFO: Record<BoostType, { name: string; Icon: React.FC<{ className?: string }>; description: string }> = {
  DOUBLE_DOWN: {
    name: "Double Down",
    Icon: IconZap,
    description: "Doubles your entire gameweek points total. Applied last.",
  },
  OUT_ON_THE_TOWN: {
    name: "Out on the Town",
    Icon: IconTarget,
    description: "Upgrades your Away Day Pick multiplier from 2× to 3×. No effect without an Away Day Pick.",
  },
  UNDERDOG_BOOST: {
    name: "Underdog Boost",
    Icon: IconStar,
    description: "Activate on one fixture. If the underdog wins and your prediction is correct: 5 pts (exact) or 3 pts (result).",
  },
};

const BOOST_TYPES: BoostType[] = ["DOUBLE_DOWN", "OUT_ON_THE_TOWN", "UNDERDOG_BOOST"];

interface PendingActivation {
  slot: number;
  type: BoostType;
  fixtureId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Displays the user's two seasonal boost chips and handles the activation flow.
 *
 * Per CLAUDE.md §8:
 *  - Boost activation: hot-pink ConfirmBanner ("Cannot be undone")
 *  - Double Down: gold shimmer sweeps the panel
 *  - Expired slot: greyed-out, no action available
 *
 * Per CLAUDE.md §9:
 *  - Slot-2 locked before GW20
 *  - Out on the Town with no Away Day Pick → warning in confirm step
 */
export default function BoostPanel({
  chips,
  currentGameweek,
  onActivate,
  isSecondHalf,
  hasAwayDayPick,
  upcomingFixtures = [],
}: BoostPanelProps) {
  const [pending, setPending] = useState<PendingActivation | null>(null);
  const [activating, setActivating] = useState(false);
  const [shimmer, setShimmer] = useState(false);

  const needsFixtureSelection =
    pending?.type === "UNDERDOG_BOOST" && !pending.fixtureId;

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

  const pendingFixture = pending?.fixtureId
    ? upcomingFixtures.find((f) => f.id === pending.fixtureId)
    : null;

  // Build the confirmation message, including OOT warning (§9.1)
  function confirmMessage(): string {
    if (!pending) return "";
    const base =
      pending.type === "UNDERDOG_BOOST" && pendingFixture
        ? `Activate Underdog Boost on ${pendingFixture.homeTeam} vs ${pendingFixture.awayTeam} for GW${currentGameweek}?`
        : `Activate ${BOOST_INFO[pending.type].name} for GW${currentGameweek}?`;

    if (pending.type === "OUT_ON_THE_TOWN" && !hasAwayDayPick) {
      return `${base}\n\nWarning: you have no Away Day Pick this gameweek — Out on the Town will have zero effect.`;
    }
    return base;
  }

  return (
    <div
      className={[
        "relative rounded-xl border border-white/10 p-4",
        shimmer ? "animate-gold-shimmer gold-shimmer-bg" : "",
      ].join(" ")}
    >
      <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-white/50">
        Your Boosts
      </h3>

      <div className="space-y-3">
        {chips.map((chip) => {
          const isSlot1Expired = chip.slot === 1 && isSecondHalf && !chip.activated;
          const isSlot2Locked  = chip.slot === 2 && !isSecondHalf && !chip.activated;
          const isUsed    = chip.activated;
          const isExpired = chip.expired || isSlot1Expired;

          return (
            <div
              key={chip.slot}
              className={[
                "rounded-lg border p-3 transition-opacity",
                isExpired || isUsed || isSlot2Locked
                  ? "border-white/5 opacity-40"
                  : "border-white/15",
              ].join(" ")}
            >
              {/* ---- Expired (never activated) ---- */}
              {isExpired && !isUsed && (
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <IconLock className="h-4 w-4 text-white/40" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/50">Slot {chip.slot} — Expired</p>
                    <p className="text-xs text-white/30">Boost #1 must be used by GW19.</p>
                  </div>
                </div>
              )}

              {/* ---- Slot 2 locked before GW20 ---- */}
              {isSlot2Locked && (
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
                    <IconLock className="h-4 w-4 text-white/40" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/50">Slot 2 — Locked</p>
                    <p className="text-xs text-white/30">Available from GW20 onwards.</p>
                  </div>
                </div>
              )}

              {/* ---- Chip has a type (selected or used) ---- */}
              {!isExpired && !isSlot2Locked && chip.type && (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className={[
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                      isUsed ? "bg-white/10" : "bg-hot-pink/15",
                    ].join(" ")}>
                      {(() => {
                        const { Icon } = BOOST_INFO[chip.type];
                        return <Icon className={["h-4 w-4", isUsed ? "text-white/30" : "text-hot-pink"].join(" ")} />;
                      })()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {BOOST_INFO[chip.type].name}
                      </p>
                      <p className="text-xs text-white/40">
                        {isUsed
                          ? `Used — GW${chip.activatedGameweek ?? currentGameweek}`
                          : BOOST_INFO[chip.type].description}
                      </p>
                    </div>
                  </div>

                  {!isUsed && (
                    <button
                      onClick={() => setPending({ slot: chip.slot, type: chip.type! })}
                      className="shrink-0 rounded-lg bg-hot-pink px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
                    >
                      Activate
                    </button>
                  )}

                  {isUsed && (
                    <span className="shrink-0 text-xs font-semibold text-neon-green">Used</span>
                  )}
                </div>
              )}

              {/* ---- Slot available — user picks boost type ---- */}
              {!isExpired && !isSlot2Locked && !chip.type && (
                <div>
                  <p className="mb-2 text-xs text-white/50">
                    Slot {chip.slot}
                    {chip.slot === 1 ? " — must use by GW19" : " — GW20+"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {BOOST_TYPES.map((bt) => {
                      const { Icon, name } = BOOST_INFO[bt];
                      return (
                        <button
                          key={bt}
                          onClick={() => setPending({ slot: chip.slot, type: bt })}
                          className="flex items-center gap-1.5 rounded-lg border border-hot-pink/40 bg-hot-pink/10 px-2.5 py-1.5 text-xs font-semibold text-hot-pink hover:bg-hot-pink/20"
                        >
                          <Icon className="h-3 w-3" />
                          {name}
                        </button>
                      );
                    })}
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
              Pick a fixture for your Underdog Boost
            </p>
            <button
              onClick={() => setPending(null)}
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
                      setPending((prev) => (prev ? { ...prev, fixtureId: f.id } : prev))
                    }
                    className="w-full rounded-lg border border-white/10 px-3 py-2.5 text-left transition-colors hover:border-neon-green/40 hover:bg-neon-green/5"
                  >
                    <p className="text-sm text-white">
                      {f.homeTeam}{" "}
                      <span className="text-white/40">vs</span>{" "}
                      {f.awayTeam}
                    </p>
                    {underdogTeam ? (
                      <p className="mt-0.5 text-xs text-neon-green">
                        {underdogTeam} is the underdog
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

      {/* Step 3 — Confirmation (with OOT warning if no Away Day Pick) */}
      {readyToConfirm && pending && (
        <div className="mt-4 space-y-2">
          {pending.type === "OUT_ON_THE_TOWN" && !hasAwayDayPick && (
            <div className="rounded-lg border border-hot-pink/30 bg-hot-pink/10 px-3 py-2">
              <p className="text-xs font-semibold text-hot-pink">
                No Away Day Pick set this gameweek
              </p>
              <p className="text-xs text-white/50">
                Out on the Town has zero effect without an Away Day Pick. You can still activate
                it — but it will do nothing this gameweek.
              </p>
            </div>
          )}
          <ConfirmBanner
            message={confirmMessage()}
            onConfirm={confirmActivation}
            onCancel={() => setPending(null)}
            loading={activating}
          />
        </div>
      )}
    </div>
  );
}
