/**
 * Electric-cyan pulsing dot — shown on LIVE fixtures.
 * Per CLAUDE.md §8: "Live score pulse" uses electric-cyan.
 */
export default function LivePulse() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-pulse-cyan rounded-full bg-electric-cyan opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-electric-cyan" />
      </span>
      <span className="text-[11px] font-bold uppercase tracking-widest text-electric-cyan">
        Live
      </span>
    </span>
  );
}
