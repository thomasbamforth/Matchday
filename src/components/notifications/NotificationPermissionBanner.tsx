"use client";

import { useEffect, useState } from "react";
import type { FcmPermissionState } from "@/hooks/useFcm";

const DISMISSED_KEY = "matchday_notif_dismissed";

interface NotificationPermissionBannerProps {
  permissionState: FcmPermissionState;
  onEnable: () => Promise<void>;
}

/**
 * Contextual prompt shown once to explain what push notifications the user
 * will receive, before asking the browser for permission.
 *
 * Dismissed state is stored in localStorage so the banner does not re-appear.
 * Never shown if permission is already granted or unsupported.
 */
export default function NotificationPermissionBanner({
  permissionState,
  onEnable,
}: NotificationPermissionBannerProps) {
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash
  const [enabling, setEnabling] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setDismissed(localStorage.getItem(DISMISSED_KEY) === "1");
    }
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  }

  async function handleEnable() {
    setEnabling(true);
    try {
      await onEnable();
    } finally {
      setEnabling(false);
      dismiss();
    }
  }

  if (permissionState !== "default" || dismissed) return null;

  return (
    <div className="animate-slide-down fixed left-0 right-0 top-0 z-50 mx-auto max-w-xl px-4 pt-3">
      <div className="rounded-xl border border-hot-pink/30 bg-aubergine/95 p-4 shadow-lg backdrop-blur-md">
        <div className="flex items-start gap-3">
          {/* Bell icon */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-hot-pink/15">
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
            <p className="text-sm font-bold text-white">Enable match alerts</p>
            <p className="mt-0.5 text-xs leading-relaxed text-white/50">
              Goals as they go in, rival overtakes, and your gameweek recap.
            </p>

            <div className="mt-3 flex gap-2">
              <button
                onClick={handleEnable}
                disabled={enabling}
                className="rounded-lg bg-hot-pink px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {enabling ? "Enabling…" : "Turn on"}
              </button>
              <button
                onClick={dismiss}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-white/40 hover:text-white/70"
              >
                Maybe later
              </button>
            </div>
          </div>

          {/* Close */}
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="shrink-0 text-white/30 hover:text-white/60"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
