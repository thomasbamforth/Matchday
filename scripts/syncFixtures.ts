/**
 * One-off fixture sync script.
 * Run against any DB by providing DATABASE_URL + DIRECT_URL env vars.
 * Does NOT require Redis or BullMQ — fetches directly from API-Football.
 *
 * Usage:
 *   DOTENV_CONFIG_PATH=.env.production.local npx tsx scripts/syncFixtures.ts
 */

import * as dotenv from "dotenv";
import * as path from "path";

// Load production env first, then fall back to local for missing vars
const prodEnvPath = process.env.DOTENV_CONFIG_PATH ?? ".env.production.local";
dotenv.config({ path: path.resolve(process.cwd(), prodEnvPath) });
dotenv.config({ path: path.resolve(process.cwd(), ".env") }); // fill in any gaps (SOCCER_API_KEY etc.)

// Derive DIRECT_URL from pooler DATABASE_URL if not explicitly set
// Supabase pooler:  postgres.PROJECTREF:PASSWORD@aws-*.pooler.supabase.com:6543/postgres?pgbouncer=true
// Supabase direct:  postgres:PASSWORD@db.PROJECTREF.supabase.co:5432/postgres
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  try {
    const pooler = new URL(process.env.DATABASE_URL);
    const username = pooler.username; // e.g. postgres.jmdzgmgeaccvqhumieov
    const [, projectRef] = username.split(".");
    if (projectRef) {
      const direct = new URL(process.env.DATABASE_URL);
      direct.username = "postgres";
      direct.hostname = `db.${projectRef}.supabase.co`;
      direct.port = "5432";
      direct.searchParams.delete("pgbouncer");
      process.env.DIRECT_URL = direct.toString();
      console.log("[sync] Derived DIRECT_URL from DATABASE_URL");
    }
  } catch {
    // Not a Supabase pooler URL — no-op, DIRECT_URL stays unset
  }
}

import { PrismaClient } from "@prisma/client";
import { toNickname } from "../src/lib/clubNicknames";

const prisma = new PrismaClient();

const BASE_URL = process.env.SOCCER_API_BASE_URL!;
const API_KEY  = process.env.SOCCER_API_KEY!;
const SEASON   = 2024;
const PL_LEAGUE_ID = 39;

// Gameweeks to sync — default to env var or 26+27
const GW_RANGE = (() => {
  const gw = parseInt(process.env.CURRENT_GAMEWEEK ?? "26", 10);
  return [gw, gw + 1]; // sync current + next
})();

// ---------------------------------------------------------------------------

type ApiStatus = "NS" | "1H" | "HT" | "2H" | "ET" | "P" | "FT" | "AET" | "PEN" | "PST" | "CANC" | "ABD";

function toFixtureStatus(short: ApiStatus): "UPCOMING" | "LIVE" | "FINISHED" | "POSTPONED" {
  if (["FT", "AET", "PEN"].includes(short)) return "FINISHED";
  if (["1H", "HT", "2H", "ET", "P"].includes(short)) return "LIVE";
  if (["PST", "CANC", "ABD"].includes(short)) return "POSTPONED";
  return "UPCOMING";
}

async function fetchGameweek(gw: number) {
  const url = `${BASE_URL}/fixtures?league=${PL_LEAGUE_ID}&season=${SEASON}&round=Regular%20Season%20-%20${gw}`;
  console.log(`[sync] Fetching GW${gw} from ${url}`);
  const res = await fetch(url, { headers: { "x-apisports-key": API_KEY } });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const json = await res.json() as { response: any[] };
  return json.response;
}

async function syncGameweek(gwNumber: number) {
  const items = await fetchGameweek(gwNumber);
  if (items.length === 0) {
    console.log(`[sync] GW${gwNumber}: no fixtures returned from API`);
    return;
  }

  const gw = await prisma.gameweek.upsert({
    where: { number: gwNumber },
    create: { id: gwNumber, number: gwNumber, status: "UPCOMING" },
    update: {},
  });

  let upserted = 0;
  for (const item of items) {
    const status = toFixtureStatus(item.fixture.status.short as ApiStatus);
    await prisma.fixture.upsert({
      where: { externalId: String(item.fixture.id) },
      create: {
        externalId: String(item.fixture.id),
        gameweekId: gw.id,
        homeTeam: toNickname(item.teams.home.name),
        awayTeam: toNickname(item.teams.away.name),
        kickoff: new Date(item.fixture.date),
        status,
        homeScore: item.goals.home,
        awayScore: item.goals.away,
        postponed: status === "POSTPONED",
      },
      update: {
        status,
        homeScore: item.goals.home,
        awayScore: item.goals.away,
        postponed: status === "POSTPONED",
      },
    });
    upserted++;
  }

  // Mark gameweek FINISHED if all fixtures are done
  const allFinished = items.every((i: any) =>
    ["FT", "AET", "PEN"].includes(i.fixture.status.short)
  );
  const anyLive = items.some((i: any) =>
    ["1H", "HT", "2H", "ET", "P"].includes(i.fixture.status.short)
  );

  const newStatus = anyLive ? "ACTIVE" : allFinished ? "FINISHED" : "UPCOMING";
  if (gw.status !== newStatus) {
    await prisma.gameweek.update({ where: { id: gw.id }, data: { status: newStatus } });
  }

  console.log(`[sync] GW${gwNumber}: upserted ${upserted} fixtures, status=${newStatus}`);
}

async function main() {
  if (!API_KEY || !BASE_URL) {
    throw new Error("SOCCER_API_KEY and SOCCER_API_BASE_URL must be set");
  }
  console.log(`[sync] Syncing gameweeks: ${GW_RANGE.join(", ")}`);
  for (const gw of GW_RANGE) {
    await syncGameweek(gw);
  }
  console.log("[sync] Done.");
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
