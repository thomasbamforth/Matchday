"use client";

import type { ConnectionState } from "@/hooks/useLiveScores";

export default function ConnectionStatus({ state }: { state: ConnectionState }) {
  if (state === "connected") return null;

  return (
    <div className="flex items-center gap-2 rounded-xl border border-hot-pink/30 bg-hot-pink/10 px-4 py-2.5">
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-hot-pink opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-hot-pink/70" />
      </span>
      <p className="text-xs font-semibold text-hot-pink">
        {state === "connecting" ? "Connecting to live scores…" : "Reconnecting to live scores…"}
      </p>
    </div>
  );
}
