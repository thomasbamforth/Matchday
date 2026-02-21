"use client";

interface ConfirmBannerProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Loading state while the confirmation is being processed */
  loading?: boolean;
}

/**
 * Hot-pink warning banner for irreversible actions (boost activation).
 * Per CLAUDE.md §8: "Boost activation always shows a hot pink confirmation
 * warning banner. Cannot be undone."
 */
export default function ConfirmBanner({
  message,
  onConfirm,
  onCancel,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  loading = false,
}: ConfirmBannerProps) {
  return (
    <div className="rounded-xl border border-hot-pink bg-hot-pink/15 p-4">
      <p className="text-sm font-medium text-white">{message}</p>
      <p className="mt-1 text-xs text-hot-pink">This cannot be undone.</p>

      <div className="mt-4 flex gap-3">
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 rounded-lg bg-hot-pink px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Activating…" : confirmLabel}
        </button>
        <button
          onClick={onCancel}
          disabled={loading}
          className="flex-1 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white transition-opacity hover:bg-white/5 disabled:opacity-50"
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
