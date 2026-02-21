/**
 * Redis pub/sub listener.
 *
 * Subscribes to the SCORE_UPDATE_CHANNEL and broadcasts incoming messages
 * to all connected WebSocket clients via wsManager.
 *
 * Run once at server startup. The subscriber connection is long-lived.
 */

import { createSubscriber } from "@/lib/redis";
import { SCORE_UPDATE_CHANNEL } from "@/lib/redisKeys";
import { broadcast } from "@/server/wsManager";

export interface ScoreUpdateMessage {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "UPCOMING" | "LIVE" | "FINISHED" | "POSTPONED";
}

export function startPubSubListener(): void {
  const subscriber = createSubscriber();

  subscriber.subscribe(SCORE_UPDATE_CHANNEL, (err) => {
    if (err) {
      console.error("[pubsub] Failed to subscribe to score updates:", err);
      return;
    }
    console.log(`[pubsub] Subscribed to ${SCORE_UPDATE_CHANNEL}`);
  });

  subscriber.on("message", (channel, message) => {
    if (channel !== SCORE_UPDATE_CHANNEL) return;
    broadcast(message);
  });

  subscriber.on("error", (err) => {
    console.error("[pubsub] Redis subscriber error:", err);
  });
}
