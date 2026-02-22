import type { BoostType } from "@/types/matchday";

interface BoostChipBadgeProps {
  type: BoostType;
  /** Dimmed when used or expired */
  dimmed?: boolean;
  size?: "sm" | "md";
}

const BOOST_META: Record<BoostType, { label: string; title: string }> = {
  DOUBLE_DOWN:     { label: "DD", title: "Double Down"     },
  OUT_ON_THE_TOWN: { label: "OT", title: "Out on the Town" },
  UNDERDOG_BOOST:  { label: "UB", title: "Underdog Boost"  },
};

/**
 * Small chip shown next to usernames on the leaderboard when a boost is active.
 * Per CLAUDE.md §8: "Active boosts visible to all league members as a small chip icon."
 */
export default function BoostChipBadge({
  type,
  dimmed = false,
  size = "sm",
}: BoostChipBadgeProps) {
  const meta = BOOST_META[type];
  const sizeClass = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1";

  return (
    <span
      title={meta.title}
      className={[
        "inline-flex items-center gap-0.5 rounded font-bold tracking-tight",
        "border border-hot-pink/60 bg-hot-pink/10 text-hot-pink",
        sizeClass,
        dimmed ? "opacity-30 grayscale" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {meta.label}
    </span>
  );
}
