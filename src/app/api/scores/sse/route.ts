/**
 * Server-Sent Events endpoint — WebSocket fallback.
 *
 * Clients connect here when WebSocket is unavailable.
 * Each connection creates a dedicated Redis subscriber that listens on
 * SCORE_UPDATE_CHANNEL and forwards messages as SSE events.
 *
 * The connection stays open until the client disconnects (AbortSignal fires).
 */

import { NextRequest } from "next/server";
import IORedis from "ioredis";
import { SCORE_UPDATE_CHANNEL } from "@/lib/redisKeys";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // ioredis requires Node.js runtime

export async function GET(request: NextRequest): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Dedicated subscriber per SSE connection
      const subscriber = new IORedis(process.env.REDIS_URL!, {
        maxRetriesPerRequest: null,
      });

      // Send an initial heartbeat so the client knows the connection is alive
      controller.enqueue(encoder.encode(": heartbeat\n\n"));

      subscriber.subscribe(SCORE_UPDATE_CHANNEL, (err) => {
        if (err) {
          console.error("[sse] Subscribe error:", err);
          controller.close();
          subscriber.quit();
        }
      });

      subscriber.on("message", (_channel: string, message: string) => {
        controller.enqueue(
          encoder.encode(`event: score-update\ndata: ${message}\n\n`)
        );
      });

      // Keep-alive ping every 30s to prevent proxy timeouts
      const pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(pingInterval);
        }
      }, 30_000);

      // Clean up when the client disconnects
      request.signal.addEventListener("abort", () => {
        clearInterval(pingInterval);
        subscriber.unsubscribe().then(() => subscriber.quit());
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // disable Nginx buffering
    },
  });
}
