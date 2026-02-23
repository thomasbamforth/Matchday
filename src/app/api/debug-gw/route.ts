import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Trigger fixture sync via API-Football and write results to DB
export async function POST() {
  const API_KEY = process.env.SOCCER_API_KEY;
  const BASE_URL = process.env.SOCCER_API_BASE_URL;
  const SEASON = 2024;
  const PL_LEAGUE_ID = 39;
  const GW_CURRENT = parseInt(process.env.CURRENT_GAMEWEEK ?? "27", 10);

  if (!API_KEY || !BASE_URL) {
    return NextResponse.json({ error: "SOCCER_API_KEY or SOCCER_API_BASE_URL not set" }, { status: 500 });
  }

  const { toNickname } = await import("@/lib/clubNicknames");

  const results: Record<string, unknown> = {};

  for (const gwNumber of [GW_CURRENT - 1, GW_CURRENT]) {
    const url = `${BASE_URL}/fixtures?league=${PL_LEAGUE_ID}&season=${SEASON}&round=Regular%20Season%20-%20${gwNumber}`;
    const res = await fetch(url, { headers: { "x-apisports-key": API_KEY } });
    if (!res.ok) { results[`gw${gwNumber}`] = `API error ${res.status}`; continue; }
    const json = await res.json() as { response: any[] };
    const items = json.response;

    if (items.length === 0) { results[`gw${gwNumber}`] = "no fixtures from API"; continue; }

    const statusMap: Record<string, "UPCOMING"|"LIVE"|"FINISHED"|"POSTPONED"> = {
      FT: "FINISHED", AET: "FINISHED", PEN: "FINISHED",
      "1H": "LIVE", HT: "LIVE", "2H": "LIVE", ET: "LIVE", P: "LIVE",
      PST: "POSTPONED", CANC: "POSTPONED", ABD: "POSTPONED",
    };
    const toStatus = (s: string) => statusMap[s] ?? "UPCOMING";

    const gw = await prisma.gameweek.upsert({
      where: { number: gwNumber },
      create: { id: gwNumber, number: gwNumber, status: "UPCOMING" },
      update: {},
    });

    const allFinished = items.every((i: any) => ["FT","AET","PEN"].includes(i.fixture.status.short));
    const anyLive = items.some((i: any) => ["1H","HT","2H","ET","P"].includes(i.fixture.status.short));
    const gwStatus = anyLive ? "ACTIVE" : allFinished ? "FINISHED" : "UPCOMING";
    await prisma.gameweek.update({ where: { id: gw.id }, data: { status: gwStatus } });

    let upserted = 0;
    for (const item of items) {
      await prisma.fixture.upsert({
        where: { externalId: String(item.fixture.id) },
        create: {
          externalId: String(item.fixture.id),
          gameweekId: gw.id,
          homeTeam: toNickname(item.teams.home.name),
          awayTeam: toNickname(item.teams.away.name),
          kickoff: new Date(item.fixture.date),
          status: toStatus(item.fixture.status.short),
          homeScore: item.goals.home,
          awayScore: item.goals.away,
          postponed: toStatus(item.fixture.status.short) === "POSTPONED",
        },
        update: {
          status: toStatus(item.fixture.status.short),
          homeScore: item.goals.home,
          awayScore: item.goals.away,
          postponed: toStatus(item.fixture.status.short) === "POSTPONED",
        },
      });
      upserted++;
    }
    results[`gw${gwNumber}`] = { upserted, gwStatus };
  }

  return NextResponse.json({ synced: true, results });
}

// Temporary diagnostic endpoint — remove after debugging
export async function GET() {
  const dbUrl = process.env.DATABASE_URL ?? "not set";
  let dbHost = "unknown";
  try {
    const u = new URL(dbUrl);
    dbHost = `${u.protocol}//${u.username.split(":")[0]}@${u.hostname}:${u.port}`;
  } catch { /* noop */ }

  // Prisma ORM query
  const gws = await prisma.gameweek.findMany({
    include: { _count: { select: { fixtures: true } } },
    orderBy: { number: "asc" },
  });

  // Raw SQL checks
  const raw = await prisma.$queryRaw<{ number: number; status: string }[]>`
    SELECT number, status FROM "Gameweek" ORDER BY number ASC
  `;

  const schemaInfo = await prisma.$queryRaw<{ current_schema: string; search_path: string }[]>`
    SELECT current_schema(), current_setting('search_path') as search_path
  `;

  const tableList = await prisma.$queryRaw<{ tablename: string; schemaname: string }[]>`
    SELECT schemaname, tablename FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog','information_schema')
    ORDER BY schemaname, tablename
  `;

  return NextResponse.json({ count: gws.length, rawCount: raw.length, dbHost, gameweeks: gws, raw, schemaInfo, tableList });
}
