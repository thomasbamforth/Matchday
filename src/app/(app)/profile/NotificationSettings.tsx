"use client";

import { useFcm } from "@/hooks/useFcm";

export default function NotificationSettings() {
  const { permissionState, requestPermission } = useFcm();

  return (
    <section className="rounded-xl border border-white/10 p-4">
      <h2 className="mb-3 text-sm font-bold text-white">Push notifications</h2>

      <div className="flex items-center justify-between gap-4">
        <div>
          {permissionState === "granted" && (
            <>
              <p className="text-sm font-semibold text-neon-green">Enabled</p>
              <p className="mt-0.5 text-xs text-white/40">
                You&apos;ll receive goals, rival overtakes, and recap alerts.
              </p>
            </>
          )}
          {permissionState === "default" && (
            <>
              <p className="text-sm font-semibold text-white/60">Not enabled</p>
              <p className="mt-0.5 text-xs text-white/40">
                Turn on to get goals and recap alerts.
              </p>
            </>
          )}
          {permissionState === "denied" && (
            <>
              <p className="text-sm font-semibold text-hot-pink">Blocked</p>
              <p className="mt-0.5 text-xs text-white/40">
                Unblock notifications for this site in your browser settings.
              </p>
            </>
          )}
          {permissionState === "unsupported" && (
            <>
              <p className="text-sm font-semibold text-white/40">Not supported</p>
              <p className="mt-0.5 text-xs text-white/40">
                Your browser doesn&apos;t support push notifications.
              </p>
            </>
          )}
        </div>

        {permissionState === "default" && (
          <button
            onClick={requestPermission}
            className="shrink-0 rounded-lg bg-hot-pink px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
          >
            Enable
          </button>
        )}
      </div>
    </section>
  );
}
