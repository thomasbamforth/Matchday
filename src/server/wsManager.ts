import type { WebSocket } from "ws";

/**
 * Tracks all active WebSocket connections.
 * Used by the pub/sub listener to broadcast score updates.
 */

const clients = new Set<WebSocket>();

export function registerClient(ws: WebSocket): void {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
  ws.on("error", () => clients.delete(ws));
}

export function broadcast(message: string): void {
  for (const client of clients) {
    if (client.readyState === 1 /* OPEN */) {
      client.send(message);
    }
  }
}

export function clientCount(): number {
  return clients.size;
}
