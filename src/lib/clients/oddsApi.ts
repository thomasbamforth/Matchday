/**
 * The Odds API client — used to determine underdog status for fixtures.
 *
 * Primary signal: implied win probability < 35% → team is the underdog.
 * Fallback (when odds unavailable): getUnderdogByTablePosition() in scoring.ts.
 *
 * Raw odds are NEVER surfaced to the user or stored as odds — only the
 * derived 'home' | 'away' | null underdog designation is persisted.
 */

import { redis } from "@/lib/redis";
import { ODDS_CACHE_KEY, ODDS_CACHE_TTL } from "@/lib/redisKeys";

const BASE_URL = process.env.ODDS_API_BASE_URL!;
const API_KEY = process.env.ODDS_API_KEY!;

const UNDERDOG_PROBABILITY_THRESHOLD = 0.35;

// ---------------------------------------------------------------------------
// Response shapes (The Odds API v4 — h2h market)
// ---------------------------------------------------------------------------

interface OddsOutcome {
  name: string;  // team name or "Draw"
  price: number; // decimal odds
}

interface OddsBookmaker {
  outcomes: OddsOutcome[];
}

interface OddsEvent {
  id: string;
  bookmakers: OddsBookmaker[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Converts decimal odds to implied probability. */
function impliedProbability(decimalOdds: number): number {
  return 1 / decimalOdds;
}

/**
 * Averages odds across all bookmakers for a given outcome name.
 * Returns null if no bookmakers carry the outcome.
 */
function averageOdds(event: OddsEvent, outcomeName: string): number | null {
  const prices: number[] = [];
  for (const bm of event.bookmakers) {
    const outcome = bm.outcomes.find((o) => o.name === outcomeName);
    if (outcome) prices.push(outcome.price);
  }
  if (prices.length === 0) return null;
  return prices.reduce((a, b) => a + b, 0) / prices.length;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface UnderdogResult {
  side: "home" | "away" | null;
  /** true when odds were available; false means table-position fallback was used */
  fromOdds: boolean;
}

/**
 * Determines which side (if any) is the underdog for a fixture.
 *
 * @param homeTeamName  Official name as used by The Odds API (pre-nickname mapping)
 * @param awayTeamName  Official name as used by The Odds API (pre-nickname mapping)
 * @param externalId    The Odds API event ID
 * @param homePosition  League table position for fallback (1 = top)
 * @param awayPosition  League table position for fallback (1 = top)
 */
export async function getUnderdogSide(
  homeTeamName: string,
  awayTeamName: string,
  externalId: string,
  homePosition: number,
  awayPosition: number
): Promise<UnderdogResult> {
  const cacheKey = ODDS_CACHE_KEY(externalId);
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as UnderdogResult;

  try {
    const url =
      `${BASE_URL}/v4/sports/soccer_epl/odds` +
      `?regions=uk&markets=h2h&eventIds=${externalId}&apiKey=${API_KEY}`;

    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error(`Odds API ${res.status}`);

    const events: OddsEvent[] = await res.json();
    const event = events[0];

    if (!event || event.bookmakers.length === 0) {
      throw new Error("No bookmakers returned");
    }

    const homeOdds = averageOdds(event, homeTeamName);
    const awayOdds = averageOdds(event, awayTeamName);

    if (homeOdds === null || awayOdds === null) {
      throw new Error("Incomplete odds data");
    }

    const homeProb = impliedProbability(homeOdds);
    const awayProb = impliedProbability(awayOdds);

    let side: "home" | "away" | null = null;
    if (homeProb < UNDERDOG_PROBABILITY_THRESHOLD) side = "home";
    else if (awayProb < UNDERDOG_PROBABILITY_THRESHOLD) side = "away";

    const result: UnderdogResult = { side, fromOdds: true };
    await redis.setex(cacheKey, ODDS_CACHE_TTL, JSON.stringify(result));
    return result;
  } catch (err) {
    // Fallback: table position differential (§9.5)
    console.warn(
      `[oddsApi] Odds unavailable for ${externalId}, falling back to table position:`,
      (err as Error).message
    );

    const { getUnderdogByTablePosition } = await import("@/lib/scoring");
    const side = getUnderdogByTablePosition(homePosition, awayPosition);
    const result: UnderdogResult = { side, fromOdds: false };
    // Don't cache the fallback result — retry odds next time
    return result;
  }
}
