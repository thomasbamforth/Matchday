"use client";

import type { Fixture } from "@/types/matchday";
import { useLiveScores } from "@/hooks/useLiveScores";
import FixtureCard from "@/components/fixtures/FixtureCard";
import ConnectionStatus from "@/components/fixtures/ConnectionStatus";
import LivePulse from "@/components/fixtures/LivePulse";

interface Props {
  initialFixtures: Fixture[];
}

function SectionHeader({ label, live }: { label: string; live?: boolean }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      {live && <LivePulse />}
      <h2
        className={[
          "text-xs font-bold uppercase tracking-widest",
          live ? "text-electric-cyan" : "text-white/40",
        ].join(" ")}
      >
        {label}
      </h2>
    </div>
  );
}

export default function FixturesList({ initialFixtures }: Props) {
  const { fixtures, connectionState } = useLiveScores(initialFixtures);

  const live      = fixtures.filter((f) => f.status === "LIVE");
  const upcoming  = fixtures.filter((f) => f.status === "UPCOMING");
  const finished  = fixtures.filter((f) => f.status === "FINISHED");
  const postponed = fixtures.filter((f) => f.status === "POSTPONED");

  return (
    <div className="space-y-6">
      <ConnectionStatus state={connectionState} />

      {live.length > 0 && (
        <section>
          <SectionHeader label="Live" live />
          <div className="space-y-2">
            {live.map((f) => (
              <FixtureCard key={f.id} fixture={f} />
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <SectionHeader label="Upcoming" />
          <div className="space-y-2">
            {upcoming.map((f) => (
              <FixtureCard key={f.id} fixture={f} />
            ))}
          </div>
        </section>
      )}

      {finished.length > 0 && (
        <section>
          <SectionHeader label="Results" />
          <div className="space-y-2">
            {finished.map((f) => (
              <FixtureCard key={f.id} fixture={f} />
            ))}
          </div>
        </section>
      )}

      {postponed.length > 0 && (
        <section>
          <SectionHeader label="Postponed" />
          <div className="space-y-2">
            {postponed.map((f) => (
              <FixtureCard key={f.id} fixture={f} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
