/**
 * API-Football client.
 *
 * All club names are mapped to nicknames via toNickname() before being
 * returned from any function — official names never leave this module.
 *
 * Responses are cached in Redis for FIXTURE_CACHE_TTL seconds.
 */

import { redis } from "@/lib/redis";
import { toNickname } from "@/lib/clubNicknames";
import { FIXTURE_CACHE_KEY, FIXTURE_CACHE_TTL } from "@/lib/redisKeys";

const BASE_URL = process.env.SOCCER_API_BASE_URL!;
const API_KEY = process.env.SOCCER_API_KEY!;
const PL_LEAGUE_ID = 39; // Premier League on API-Football

// ---------------------------------------------------------------------------
// Response shapes (API-Football v3)
// ---------------------------------------------------------------------------

interface ApiFixture {
  fixture: {
    id: number;
    date: string;
    status: {
      short: "NS" | "1H" | "HT" | "2H" | "ET" | "P" | "FT" | "AET" | "PEN" | "PST" | "CANC" | "ABD";
    };
  };
  league: {
    round: string; // e.g. "Regular Season - 14"
  };
  teams: {
    home: { name: string };
    away: { name: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

interface ApiResponse {
  response: ApiFixture[];
}

// ---------------------------------------------------------------------------
// Normalised fixture shape (nicknames applied, used internally and in DB)
// ---------------------------------------------------------------------------

export interface NormalisedFixture {
  externalId: string;
  gameweekNumber: number;
  homeTeam: string; // nickname
  awayTeam: string; // nickname
  kickoff: Date;
  status: "UPCOMING" | "LIVE" | "FINISHED" | "POSTPONED";
  homeScore: number | null;
  awayScore: number | null;
}

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

function toFixtureStatus(
  short: ApiFixture["fixture"]["status"]["short"]
): NormalisedFixture["status"] {
  if (["FT", "AET", "PEN"].includes(short)) return "FINISHED";
  if (["1H", "HT", "2H", "ET", "P"].includes(short)) return "LIVE";
  if (["PST", "CANC", "ABD"].includes(short)) return "POSTPONED";
  return "UPCOMING";
}

function extractGameweekNumber(round: string): number {
  const match = round.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function apiFetch<T>(path: string): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: {
      "x-rapidapi-key": API_KEY,
      "x-rapidapi-host": new URL(BASE_URL).hostname,
    },
    next: { revalidate: 0 }, // never cache at the Next.js layer
  });

  if (!res.ok) {
    throw new Error(`API-Football error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches all fixtures for a given gameweek number.
 * Results are cached in Redis for FIXTURE_CACHE_TTL seconds.
 */
export async function getFixturesByGameweek(
  gameweekNumber: number,
  season: number
): Promise<NormalisedFixture[]> {
  const cacheKey = FIXTURE_CACHE_KEY(gameweekNumber);
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached) as NormalisedFixture[];

  const data = await apiFetch<ApiResponse>(
    `/fixtures?league=${PL_LEAGUE_ID}&season=${season}&round=Regular%20Season%20-%20${gameweekNumber}`
  );

  const fixtures = data.response.map(
    (item): NormalisedFixture => ({
      externalId: String(item.fixture.id),
      gameweekNumber,
      homeTeam: toNickname(item.teams.home.name),
      awayTeam: toNickname(item.teams.away.name),
      kickoff: new Date(item.fixture.date),
      status: toFixtureStatus(item.fixture.status.short),
      homeScore: item.goals.home,
      awayScore: item.goals.away,
    })
  );

  await redis.setex(cacheKey, FIXTURE_CACHE_TTL, JSON.stringify(fixtures));
  return fixtures;
}

/**
 * Fetches live scores for a specific fixture by external ID.
 * Not cached — called during active match windows.
 */
export async function getLiveFixture(
  externalId: string
): Promise<NormalisedFixture | null> {
  const data = await apiFetch<ApiResponse>(`/fixtures?id=${externalId}`);
  const item = data.response[0];
  if (!item) return null;

  return {
    externalId: String(item.fixture.id),
    gameweekNumber: extractGameweekNumber(item.league.round),
    homeTeam: toNickname(item.teams.home.name),
    awayTeam: toNickname(item.teams.away.name),
    kickoff: new Date(item.fixture.date),
    status: toFixtureStatus(item.fixture.status.short),
    homeScore: item.goals.home,
    awayScore: item.goals.away,
  };
}
