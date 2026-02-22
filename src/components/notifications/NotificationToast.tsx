"use client";

import { useEffect } from "react";
import type { ForegroundMessage } from "@/hooks/useFcm";

const AUTO_DISMISS_MS = 4500;

interface NotificationToastProps {
  message: ForegroundMessage | null;
  onDismiss: () => void;
}

/**
 * In-app toast for foreground FCM messages (goal alerts, rival overtakes, etc.).
 * Slides in from the top, auto-dismisses after 4.5 s.
 * Per design system: slide-down animation, hot-pink accent.
 */
export default function NotificationToast({ message, onDismiss }: NotificationToastProps) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className="animate-slide-down fixed left-0 right-0 top-0 z-50 mx-auto max-w-xl px-4 pt-3 pointer-events-none">
      <div className="pointer-events-auto flex items-start gap-3 rounded-xl border border-hot-pink/40 bg-aubergine/95 p-4 shadow-lg backdrop-blur-md">
        {/* Hot-pink bell */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-hot-pink/15">
          <svg
            className="h-4 w-4 text-hot-pink"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 01-3.46 0" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">{message.title}</p>
          {message.body && (
            <p className="mt-0.5 text-xs text-white/60">{message.body}</p>
          )}
        </div>

        <button
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="shrink-0 text-white/30 hover:text-white/60"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
