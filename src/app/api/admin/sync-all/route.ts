import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { toNickname } from "@/lib/clubNicknames";

/**
 * Fetches ALL season fixtures in ONE API call, groups by round, upserts
 * gameweeks (with startDate/endDate) and fixtures.
 *
 * Body: { season?: number }
 *   season=2024 → 2024/25 season, stored as GW IDs 1-38
 *   season=2025 → 2025/26 season, stored as GW IDs 39-76
 *   Omit season → auto-detect from current date (Aug–Dec = current year, Jan–Jul = previous year)
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { season?: number };

  // Auto-detect season from current date if not provided
  const now = new Date();
  const defaultSeason = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  const season = body.season ?? defaultSeason;

  // 2024/25 uses IDs 1-38, 2025/26 uses 39-76, 2026/27 would use 77-114, etc.
  const idOffset = (season - 2024) * 38;

  const API_KEY = process.env.SOCCER_API_KEY;
  const BASE_URL = process.env.SOCCER_API_BASE_URL;
  if (!API_KEY || !BASE_URL) {
    return NextResponse.json({ error: "Missing SOCCER_API_KEY or SOCCER_API_BASE_URL" }, { status: 500 });
  }

  const url = `${BASE_URL}/fixtures?league=39&season=${season}`;
  const res = await fetch(url, { headers: { "x-apisports-key": API_KEY } });
  if (!res.ok) return NextResponse.json({ error: `API ${res.status}: ${await res.text()}` }, { status: 500 });

  const json = await res.json() as { response: any[] };
  const items: any[] = json.response;
  if (!items.length) return NextResponse.json({ error: "No fixtures returned from API — season may not exist yet" });

  const statusMap: Record<string, "UPCOMING" | "LIVE" | "FINISHED" | "POSTPONED"> = {
    FT: "FINISHED", AET: "FINISHED", PEN: "FINISHED",
    "1H": "LIVE", HT: "LIVE", "2H": "LIVE", ET: "LIVE", P: "LIVE",
    PST: "POSTPONED", CANC: "POSTPONED", ABD: "POSTPONED",
  };
  const toStatus = (s: string) => statusMap[s] ?? "UPCOMING";

  const byGW = new Map<number, any[]>();
  for (const item of items) {
    const m = item.league.round.match(/(\d+)$/);
    if (!m) continue;
    const gw = parseInt(m[1], 10);
    if (!byGW.has(gw)) byGW.set(gw, []);
    byGW.get(gw)!.push(item);
  }

  const summary: Record<string, unknown> = {};

  for (const [seasonNumber, gwItems] of Array.from(byGW.entries()).sort((a, b) => a[0] - b[0])) {
    const dbNumber = idOffset + seasonNumber; // unique sequential ID across seasons
    const allFinished = gwItems.every((i: any) => ["FT", "AET", "PEN"].includes(i.fixture.status.short));
    const anyLive     = gwItems.some((i: any)  => ["1H", "HT", "2H", "ET", "P"].includes(i.fixture.status.short));
    const gwStatus    = anyLive ? "ACTIVE" : allFinished ? "FINISHED" : "UPCOMING";

    // Derive gameweek startDate/endDate from fixture kickoffs
    const kickoffs = gwItems.map((i: any) => new Date(i.fixture.date).getTime());
    const startDate = new Date(Math.min(...kickoffs));
    const endDate = new Date(Math.max(...kickoffs));

    const gwRec = await prisma.gameweek.upsert({
      where: { number: dbNumber },
      create: { id: dbNumber, number: dbNumber, season, seasonNumber, status: gwStatus, startDate, endDate },
      update: { status: gwStatus, season, seasonNumber, startDate, endDate },
    });

    for (const item of gwItems) {
      const status = toStatus(item.fixture.status.short);
      await prisma.fixture.upsert({
        where: { externalId: String(item.fixture.id) },
        create: {
          externalId: String(item.fixture.id),
          gameweekId: gwRec.id,
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
          kickoff: new Date(item.fixture.date),
        },
      });
    }

    summary[`gw${seasonNumber}`] = { dbId: dbNumber, fixtures: gwItems.length, status: gwStatus };
  }

  return NextResponse.json({ season, totalFixtures: items.length, gameweeks: byGW.size, summary });
}
