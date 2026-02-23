"use client";

import { useEffect, useRef } from "react";
import useSWR from "swr";
import Leaderboard from "@/components/leaderboard/Leaderboard";
import type { LeaderboardEntry } from "@/types/matchday";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface LeaderboardLiveProps {
  initialEntries: LeaderboardEntry[];
  leagueId: string;
  currentUserId: string;
  leagueName: string;
  gameweekNumber: number;
  inviteCode?: string;
}

/**
 * Wraps <Leaderboard> with live data.
 *
 * SWR provides the latest leaderboard from /api/leagues/[id]/leaderboard.
 * An SSE subscription to /api/scores/sse fires mutate() on every score change
 * so ranks update the moment the score-update worker writes new summaries.
 * The RivalOvertakeToast inside <Leaderboard> fires when entries change and
 * the current user's rank has worsened.
 */
export default function LeaderboardLive({
  initialEntries,
  leagueId,
  currentUserId,
  leagueName,
  gameweekNumber,
  inviteCode,
}: LeaderboardLiveProps) {
  const { data: entries, mutate } = useSWR<LeaderboardEntry[]>(
    `/api/leagues/${leagueId}/leaderboard`,
    fetcher,
    { fallbackData: initialEntries, revalidateOnFocus: false }
  );

  // Keep mutate stable across renders so the effect closure doesn't stale
  const mutateRef = useRef(mutate);
  mutateRef.current = mutate;

  // Subscribe to SSE score updates — revalidate leaderboard on every message
  useEffect(() => {
    const es = new EventSource("/api/scores/sse");
    es.onmessage = () => {
      mutateRef.current();
    };
    return () => es.close();
  }, []); // intentionally empty — one SSE connection per mount

  return (
    <Leaderboard
      entries={entries ?? initialEntries}
      currentUserId={currentUserId}
      leagueName={leagueName}
      gameweekNumber={gameweekNumber}
      inviteCode={inviteCode}
    />
  );
}
