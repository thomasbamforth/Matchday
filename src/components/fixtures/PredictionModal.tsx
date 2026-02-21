"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import type { Fixture, UserPrediction } from "@/types/matchday";

interface PredictionModalProps {
  fixture: Fixture;
  currentPrediction?: UserPrediction;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (homeScore: number, awayScore: number) => Promise<void>;
  /** True when this fixture is the user's Away Day Pick for the gameweek */
  isAwayDayPickEligible?: boolean;
  isAwayDayPickActive?: boolean;
  onToggleAwayDayPick?: () => void;
  /** True when Away Day Pick is locked (another pick already active) */
  awayDayPickLocked?: boolean;
}

/**
 * Slide-up prediction modal.
 *
 * Per CLAUDE.md §8:
 *  - "Team nicknames displayed in hot pink at the top of prediction modals."
 *  - Score inputs, Away Day Pick toggle.
 */
export default function PredictionModal({
  fixture,
  currentPrediction,
  isOpen,
  onClose,
  onSubmit,
  isAwayDayPickEligible = false,
  isAwayDayPickActive = false,
  onToggleAwayDayPick,
  awayDayPickLocked = false,
}: PredictionModalProps) {
  const [home, setHome] = useState(currentPrediction?.homeScore ?? 0);
  const [away, setAway] = useState(currentPrediction?.awayScore ?? 0);
  const [submitting, setSubmitting] = useState(false);

  const isPastKickoff = new Date() >= new Date(fixture.kickoff);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isPastKickoff) return;
    setSubmitting(true);
    try {
      await onSubmit(home, away);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  function clamp(val: number) {
    return Math.max(0, Math.min(20, val));
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {/* Team nicknames in hot pink */}
      <div className="mb-5 text-center">
        <p className="text-xs uppercase tracking-widest text-white/40">Prediction</p>
        <h2 className="mt-1 text-lg font-bold">
          <span className="text-hot-pink">{fixture.homeTeam}</span>
          <span className="mx-2 text-white/40">vs</span>
          <span className="text-hot-pink">{fixture.awayTeam}</span>
        </h2>
        <p className="mt-1 text-xs text-white/50">
          {isPastKickoff
            ? "Predictions locked — match has started"
            : `Kicks off ${new Date(fixture.kickoff).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}`}
        </p>
      </div>

      {isPastKickoff ? (
        <p className="text-center text-sm text-white/50">
          Predictions are locked once a match kicks off.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Score inputs */}
          <div className="flex items-center justify-center gap-4">
            {/* Home */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-white/50 truncate max-w-[80px] text-center">
                {fixture.homeTeam}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setHome((v) => clamp(v - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10"
                >
                  –
                </button>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={home}
                  onChange={(e) => setHome(clamp(Number(e.target.value)))}
                  className="score-input w-12 rounded-lg bg-white/10 py-2 text-center text-2xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-hot-pink"
                />
                <button
                  type="button"
                  onClick={() => setHome((v) => clamp(v + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10"
                >
                  +
                </button>
              </div>
            </div>

            <span className="mt-4 text-2xl font-bold text-white/30">–</span>

            {/* Away */}
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-white/50 truncate max-w-[80px] text-center">
                {fixture.awayTeam}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAway((v) => clamp(v - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10"
                >
                  –
                </button>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={away}
                  onChange={(e) => setAway(clamp(Number(e.target.value)))}
                  className="score-input w-12 rounded-lg bg-white/10 py-2 text-center text-2xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-hot-pink"
                />
                <button
                  type="button"
                  onClick={() => setAway((v) => clamp(v + 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Away Day Pick toggle */}
          {isAwayDayPickEligible && (
            <div className="rounded-xl border border-hot-pink/30 bg-hot-pink/10 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">Away Day Pick</p>
                  <p className="text-xs text-white/50">
                    {isAwayDayPickActive
                      ? "Active — doubles points if away wins"
                      : "Pick {fixture.awayTeam} to win for a 2× bonus"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onToggleAwayDayPick}
                  disabled={awayDayPickLocked && !isAwayDayPickActive}
                  className={[
                    "relative h-6 w-11 rounded-full transition-colors",
                    isAwayDayPickActive ? "bg-hot-pink" : "bg-white/20",
                    awayDayPickLocked && !isAwayDayPickActive
                      ? "cursor-not-allowed opacity-40"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span
                    className={[
                      "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                      isAwayDayPickActive ? "translate-x-5" : "translate-x-0.5",
                    ].join(" ")}
                  />
                </button>
              </div>
              {awayDayPickLocked && !isAwayDayPickActive && (
                <p className="mt-1 text-xs text-hot-pink">
                  Away Day Pick already used on another fixture this gameweek.
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-hot-pink px-4 py-3 text-base font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {submitting
              ? "Saving…"
              : currentPrediction
              ? "Update prediction"
              : "Save prediction"}
          </button>
        </form>
      )}
    </Modal>
  );
}
