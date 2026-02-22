"use client";

import { useEffect, useState } from "react";
import FixtureCard from "@/components/fixtures/FixtureCard";
import PredictionModal from "@/components/fixtures/PredictionModal";
import type { Fixture, UserPrediction } from "@/types/matchday";

// Shape emitted by the backend pub/sub listener over SSE
interface ScoreUpdateEvent {
  fixtureId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: Fixture["status"];
}

interface GameweekViewProps {
  gameweekId: number;
  fixtures: Fixture[];
  initialPredictions: Record<string, UserPrediction>;
  awayDayPickFixtureId: string | null;
}

export default function GameweekView({
  gameweekId,
  fixtures,
  initialPredictions,
  awayDayPickFixtureId,
}: GameweekViewProps) {
  const [liveFixtures, setLiveFixtures] = useState<Fixture[]>(fixtures);
  const [predictions, setPredictions] = useState(initialPredictions);
  const [selectedFixture, setSelectedFixture] = useState<Fixture | null>(null);
  const [awayPickId, setAwayPickId] = useState(awayDayPickFixtureId);

  // Subscribe to real-time score updates via SSE (WebSocket fallback)
  useEffect(() => {
    const es = new EventSource("/api/scores/sse");

    es.addEventListener("score-update", (e: MessageEvent) => {
      const update = JSON.parse(e.data) as ScoreUpdateEvent;
      setLiveFixtures((prev) =>
        prev.map((f) =>
          f.id === update.fixtureId
            ? {
                ...f,
                homeScore: update.homeScore,
                awayScore: update.awayScore,
                status: update.status,
              }
            : f
        )
      );
    });

    es.onerror = () => {
      // EventSource reconnects automatically; no action needed
    };

    return () => es.close();
  }, []);

  async function savePrediction(homeScore: number, awayScore: number) {
    if (!selectedFixture) return;
    const res = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fixtureId: selectedFixture.id, homeScore, awayScore }),
    });
    if (!res.ok) throw new Error("Failed to save prediction");
    setPredictions((prev) => ({
      ...prev,
      [selectedFixture.id]: { homeScore, awayScore },
    }));
  }

  async function toggleAwayDayPick() {
    if (!selectedFixture) return;
    if (awayPickId === selectedFixture.id) {
      // Remove
      await fetch("/api/away-day-pick", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameweekId }),
      });
      setAwayPickId(null);
    } else {
      // Set
      const res = await fetch("/api/away-day-pick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtureId: selectedFixture.id, gameweekId }),
      });
      if (!res.ok) return;
      setAwayPickId(selectedFixture.id);
    }
  }

  const upcoming  = liveFixtures.filter((f) => f.status === "UPCOMING");
  const live      = liveFixtures.filter((f) => f.status === "LIVE");
  const finished  = liveFixtures.filter((f) => f.status === "FINISHED");
  const postponed = liveFixtures.filter((f) => f.status === "POSTPONED");

  const sections = [
    { label: "Live",      items: live },
    { label: "Upcoming",  items: upcoming },
    { label: "Finished",  items: finished },
    { label: "Postponed", items: postponed },
  ].filter((s) => s.items.length > 0);

  return (
    <>
      <div className="space-y-6">
        {sections.map((section) => (
          <section key={section.label}>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-white/40">
              {section.label}
            </h2>
            <div className="space-y-2">
              {section.items.map((fixture) => (
                <FixtureCard
                  key={fixture.id}
                  fixture={fixture}
                  prediction={predictions[fixture.id]}
                  isAwayDayPickFixture={awayPickId === fixture.id}
                  onTap={
                    fixture.status === "UPCOMING"
                      ? () => setSelectedFixture(fixture)
                      : undefined
                  }
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {selectedFixture && (
        <PredictionModal
          fixture={selectedFixture}
          currentPrediction={predictions[selectedFixture.id]}
          isOpen
          onClose={() => setSelectedFixture(null)}
          onSubmit={savePrediction}
          isAwayDayPickEligible={selectedFixture.status === "UPCOMING"}
          isAwayDayPickActive={awayPickId === selectedFixture.id}
          onToggleAwayDayPick={toggleAwayDayPick}
          awayDayPickLocked={!!awayPickId && awayPickId !== selectedFixture.id}
        />
      )}
    </>
  );
}
