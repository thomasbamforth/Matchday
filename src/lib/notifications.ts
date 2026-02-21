/**
 * High-level notification helpers.
 * Called from BullMQ workers when significant events occur.
 *
 * All copy intentionally avoids "Premier League" and uses fan nicknames
 * (nicknames are already applied before this layer is reached).
 */

import { sendToUser, sendToUsers } from "@/lib/clients/fcm";

// ---------------------------------------------------------------------------
// Goal alert — sent to every user who predicted on the updated fixture
// ---------------------------------------------------------------------------

export async function sendGoalAlerts(
  userIds: string[],
  homeTeam: string,
  awayTeam: string,
  homeScore: number,
  awayScore: number,
  fixtureId: string
): Promise<void> {
  await sendToUsers(userIds, {
    title: "⚽ Goal!",
    body: `${homeTeam} ${homeScore}–${awayScore} ${awayTeam}`,
    link: `/gameweek/live`,
    data: { fixtureId, type: "GOAL" },
  });
}

// ---------------------------------------------------------------------------
// Away Day Pick win — sent to the single user whose pick just paid out
// ---------------------------------------------------------------------------

export async function sendAwayDayPickWin(
  userId: string,
  team: string,
  leagueId: string
): Promise<void> {
  await sendToUser(userId, {
    title: "🎉 Away Day Pick pays off!",
    body: `${team} won — your points are doubled.`,
    link: `/league/${leagueId}`,
    data: { type: "AWAY_DAY_WIN" },
  });
}

// ---------------------------------------------------------------------------
// Rival overtake — sent when another user moves above the current user
// ---------------------------------------------------------------------------

export async function sendRivalOvertake(
  userId: string,
  rivalUsername: string,
  leagueId: string
): Promise<void> {
  await sendToUser(userId, {
    title: "⚡ You've been overtaken",
    body: `${rivalUsername} just moved above you on the table.`,
    link: `/league/${leagueId}`,
    data: { type: "RIVAL_OVERTAKE", leagueId },
  });
}

// ---------------------------------------------------------------------------
// Recap ready — sent to all league members when the GW recap is published
// ---------------------------------------------------------------------------

export async function sendRecapReady(
  userIds: string[],
  gameweekNumber: number,
  leagueId: string
): Promise<void> {
  await sendToUsers(userIds, {
    title: "📰 Gameweek recap is out",
    body: `GW${gameweekNumber} — see how you and your league got on.`,
    link: `/league/${leagueId}`,
    data: { type: "RECAP_READY", leagueId },
  });
}
