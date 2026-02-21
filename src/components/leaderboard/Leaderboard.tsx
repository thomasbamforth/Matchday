"use client";

import { useEffect, useRef, useState } from "react";
import LeaderboardRow from "@/components/leaderboard/LeaderboardRow";
import RivalOvertakeToast from "@/components/leaderboard/RivalOvertakeToast";
import type { LeaderboardEntry } from "@/types/matchday";

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId: string;
  leagueName: string;
  gameweekNumber: number;
}

interface OvertakeEvent {
  rivalUsername: string;
  rivalAvatarUrl?: string;
}

/**
 * Full league standings.
 *
 * Per CLAUDE.md §8:
 *  - User's own row is pinned at the bottom, highlighted in deep aubergine
 *  - Rival overtake triggers a hot-pink notification banner
 */
export default function Leaderboard({
  entries,
  currentUserId,
  leagueName,
  gameweekNumber,
}: LeaderboardProps) {
  const prevEntries = useRef<LeaderboardEntry[]>([]);
  const [overtake, setOvertake] = useState<OvertakeEvent | null>(null);

  // Detect when a rival has overtaken the current user
  useEffect(() => {
    if (prevEntries.current.length === 0) {
      prevEntries.current = entries;
      return;
    }

    const currentUser = entries.find((e) => e.userId === currentUserId);
    const prevUser = prevEntries.current.find((e) => e.userId === currentUserId);

    if (currentUser && prevUser && currentUser.rank > prevUser.rank) {
      // Current user dropped — find who overtook them (now directly above)
      const rival = entries.find((e) => e.rank === currentUser.rank - 1);
      if (rival) {
        setOvertake({ rivalUsername: rival.username, rivalAvatarUrl: rival.avatarUrl });
      }
    }

    prevEntries.current = entries;
  }, [entries, currentUserId]);

  // Sort: others first, then pin current user at bottom
  const others = entries.filter((e) => e.userId !== currentUserId);
  const me = entries.find((e) => e.userId === currentUserId);

  return (
    <div className="relative">
      {overtake && (
        <RivalOvertakeToast
          rivalUsername={overtake.rivalUsername}
          rivalAvatarUrl={overtake.rivalAvatarUrl}
          onDismiss={() => setOvertake(null)}
        />
      )}

      <div className="mb-3 flex items-center justify-between px-1">
        <div>
          <h2 className="text-base font-bold text-white">{leagueName}</h2>
          <p className="text-xs text-white/40">Gameweek {gameweekNumber}</p>
        </div>
        <span className="text-xs text-white/40">{entries.length} members</span>
      </div>

      {/* Column headers */}
      <div className="mb-1 flex items-center gap-3 px-4 text-[10px] uppercase tracking-widest text-white/30">
        <span className="w-6 text-center">#</span>
        <span className="w-4" />
        <span className="w-8" />
        <span className="flex-1">Player</span>
        <span className="shrink-0 text-right">GW / Total</span>
      </div>

      {/* Scrollable list */}
      <div className="space-y-1 pb-20">
        {others.map((entry) => (
          <LeaderboardRow
            key={entry.userId}
            entry={entry}
            isCurrentUser={false}
          />
        ))}
      </div>

      {/* Current user row — pinned */}
      {me && (
        <LeaderboardRow key={me.userId} entry={me} isCurrentUser />
      )}
    </div>
  );
}
