"use client";

import { useEffect, useRef, useState } from "react";
import type { Fixture } from "@/types/matchday";

export type ConnectionState = "connecting" | "connected" | "disconnected";

interface ScoreUpdateEvent {
  fixtureId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: Fixture["status"];
}

export function useLiveScores(initialFixtures: Fixture[]): {
  fixtures: Fixture[];
  connectionState: ConnectionState;
} {
  const [fixtures, setFixtures] = useState<Fixture[]>(initialFixtures);
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  // Keep fixtures in sync if the server re-renders with new initial data
  const initialRef = useRef(initialFixtures);

  useEffect(() => {
    initialRef.current = initialFixtures;
    setFixtures(initialFixtures);
  }, [initialFixtures]);

  useEffect(() => {
    let es: EventSource;

    function connect() {
      setConnectionState("connecting");
      es = new EventSource("/api/scores/sse");

      es.addEventListener("open", () => {
        setConnectionState("connected");
      });

      es.addEventListener("score-update", (e: MessageEvent) => {
        const update = JSON.parse(e.data) as ScoreUpdateEvent;
        setFixtures((prev) =>
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
        setConnectionState("disconnected");
        // EventSource reconnects automatically; we track state via open/error events
      };
    }

    connect();

    return () => {
      es?.close();
    };
  }, []);

  return { fixtures, connectionState };
}
