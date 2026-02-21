/**
 * Custom Next.js server with WebSocket support.
 *
 * Replaces `next dev` / `next start`. Attaches a ws.Server to the same HTTP
 * server that Next.js uses, then starts the Redis pub/sub listener that
 * broadcasts score updates to all connected WebSocket clients.
 *
 * Usage:
 *   dev:   npm run dev      (tsx watch server.ts)
 *   prod:  npm run start    (NODE_ENV=production tsx server.ts)
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer } from "ws";
import { registerClient } from "./src/server/wsManager";
import { startPubSubListener } from "./src/server/pubsubListener";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    handle(req, res, parsedUrl);
  });

  // Attach WebSocket server to the same HTTP server
  const wss = new WebSocketServer({ server: httpServer });

  wss.on("connection", (ws, req) => {
    const ip = req.socket.remoteAddress ?? "unknown";
    console.log(`[ws] Client connected from ${ip}`);
    registerClient(ws);
  });

  wss.on("error", (err) => {
    console.error("[ws] Server error:", err);
  });

  // Start Redis pub/sub → WebSocket broadcast pipeline
  startPubSubListener();

  httpServer.listen(port, () => {
    console.log(`[server] Listening on http://localhost:${port}`);
    console.log(`[server] WebSocket ready on ws://localhost:${port}`);
    console.log(`[server] Mode: ${dev ? "development" : "production"}`);
  });
});
