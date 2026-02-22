interface RecapPendingProps {
  gameweekNumber: number;
  leagueName: string;
  /** true = gameweek finished but the AI job hasn't written the recap yet */
  generating?: boolean;
}

/**
 * Placeholder shown while the AI recap hasn't arrived yet.
 * Two modes:
 *  - default  → gameweek still in progress ("Recap dropping at full time")
 *  - generating → gameweek finished, BullMQ job is running ("Generating recap…")
 */
export default function RecapPending({
  gameweekNumber,
  leagueName,
  generating = false,
}: RecapPendingProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-aubergine p-5">
      {/* Header — mirrors RecapCard layout */}
      <div className="mb-4 border-b border-white/10 pb-3">
        <p className="text-[10px] uppercase tracking-widest text-white/30">
          {leagueName}
        </p>
        <h2 className="mt-0.5 font-bold text-white">
          Gameweek {gameweekNumber} Recap
        </h2>
      </div>

      {/* Newspaper icon */}
      <div className="mb-4 flex justify-center">
        <svg
          className="h-10 w-10 text-white/20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 4h16v16H4z" />
          <path d="M4 9h16" />
          <path d="M8 4v5" />
          <path d="M8 13h8" />
          <path d="M8 17h5" />
        </svg>
      </div>

      {generating ? (
        <>
          {/* Animated skeleton lines to suggest typewriter text arriving */}
          <div className="space-y-2">
            {[100, 85, 92, 60].map((w, i) => (
              <div
                key={i}
                className="h-2.5 animate-pulse rounded-full bg-white/10"
                style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }}
              />
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-white/30">
            The pundit is typing…
          </p>
        </>
      ) : (
        <p className="text-center text-sm text-white/40">
          Recap dropping at full time.
          <span className="mt-1 block text-xs text-white/25">
            The pundit is watching. Quietly judging.
          </span>
        </p>
      )}
    </div>
  );
}
