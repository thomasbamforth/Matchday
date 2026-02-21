"use client";

import { useEffect, useState } from "react";

interface RivalOvertakeToastProps {
  rivalUsername: string;
  rivalAvatarUrl?: string;
  /** Call when the toast should be dismissed */
  onDismiss: () => void;
  /** Auto-dismiss after ms (default 5000) */
  duration?: number;
}

/**
 * Notification banner that slides down when a rival overtakes the current user.
 *
 * Per CLAUDE.md §8:
 *  "Notification banner slides down with rival avatar + lightning bolt (hot pink)"
 */
export default function RivalOvertakeToast({
  rivalUsername,
  rivalAvatarUrl,
  onDismiss,
  duration = 5000,
}: RivalOvertakeToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300); // wait for fade before unmounting
    }, duration);
    return () => clearTimeout(t);
  }, [duration, onDismiss]);

  return (
    <div
      className={[
        "fixed left-0 right-0 top-0 z-50 mx-auto max-w-sm px-4 pt-4 transition-all duration-300",
        visible ? "translate-y-0 opacity-100 animate-slide-down" : "-translate-y-full opacity-0",
      ].join(" ")}
    >
      <div className="flex items-center gap-3 rounded-xl border border-hot-pink bg-aubergine px-4 py-3 shadow-lg shadow-black/50">
        {/* Avatar */}
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-hot-pink/50 bg-white/10">
          {rivalAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={rivalAvatarUrl} alt={rivalUsername} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-hot-pink">
              {rivalUsername.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">
            <span className="text-hot-pink">{rivalUsername}</span> just overtook you ⚡
          </p>
          <p className="text-xs text-white/50">They&apos;re above you on the table</p>
        </div>

        {/* Dismiss */}
        <button
          onClick={() => { setVisible(false); setTimeout(onDismiss, 300); }}
          className="shrink-0 text-white/40 hover:text-white"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
