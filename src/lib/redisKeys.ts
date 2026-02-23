/**
 * Centralised Redis key and channel naming.
 * All Redis keys/channels must go through these helpers — no magic strings.
 */

// Cache keys
export const FIXTURE_CACHE_KEY = (gameweekNumber: number) =>
  `matchday:fixtures:gw${gameweekNumber}`;

export const ODDS_CACHE_KEY = (fixtureId: string) =>
  `matchday:odds:${fixtureId}`;

export const LAST_DAILY_SYNC_KEY = "matchday:sync:lastDaily";

// Pub/sub channels
/** Published whenever a fixture score changes. Payload: ScoreUpdateMessage JSON. */
export const SCORE_UPDATE_CHANNEL = "matchday:scores";

// TTLs (seconds)
export const FIXTURE_CACHE_TTL = 55;       // just under the 60s polling interval
export const ODDS_CACHE_TTL = 3600;        // odds don't change second-to-second
export const STANDINGS_CACHE_TTL = 6 * 3600; // 6h — standings change per match day

export const STANDINGS_CACHE_KEY = (season: number) =>
  `matchday:standings:${season}`;
