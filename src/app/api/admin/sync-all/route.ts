import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { toNickname } from "@/lib/clubNicknames";

// Temporary — fetches ALL season fixtures in ONE API call, groups by round, upserts everything.
// Remove after use.
export async function POST() {
  const API_KEY = process.env.SOCCER_API_KEY;
  const BASE_URL = process.env.SOCCER_API_BASE_URL;
  if (!API_KEY || !BASE_URL) {
    return NextResponse.json({ error: "Missing SOCCER_API_KEY or SOCCER_API_BASE_URL" }, { status: 500 });
  }

  const url = `${BASE_URL}/fixtures?league=39&season=2024`;
  const res = await fetch(url, { headers: { "x-apisports-key": API_KEY } });
  if (!res.ok) return NextResponse.json({ error: `API ${res.status}: ${await res.text()}` }, { status: 500 });

  const json = await res.json() as { response: any[] };
  const items: any[] = json.response;
  if (!items.length) return NextResponse.json({ error: "No fixtures returned from API" });

  const statusMap: Record<string, "UPCOMING" | "LIVE" | "FINISHED" | "POSTPONED"> = {
    FT: "FINISHED", AET: "FINISHED", PEN: "FINISHED",
    "1H": "LIVE", HT: "LIVE", "2H": "LIVE", ET: "LIVE", P: "LIVE",
    PST: "POSTPONED", CANC: "POSTPONED", ABD: "POSTPONED",
  };
  const toStatus = (s: string) => statusMap[s] ?? "UPCOMING";

  // Group by gameweek number (extracted from round string "Regular Season - N")
  const byGW = new Map<number, any[]>();
  for (const item of items) {
    const m = item.league.round.match(/(\d+)$/);
    if (!m) continue;
    const gw = parseInt(m[1], 10);
    if (!byGW.has(gw)) byGW.set(gw, []);
    byGW.get(gw)!.push(item);
  }

  const summary: Record<string, unknown> = {};

  for (const [gwNumber, gwItems] of Array.from(byGW.entries()).sort((a, b) => a[0] - b[0])) {
    const allFinished = gwItems.every((i) => ["FT", "AET", "PEN"].includes(i.fixture.status.short));
    const anyLive     = gwItems.some((i)  => ["1H", "HT", "2H", "ET", "P"].includes(i.fixture.status.short));
    const gwStatus    = anyLive ? "ACTIVE" : allFinished ? "FINISHED" : "UPCOMING";

    const gwRec = await prisma.gameweek.upsert({
      where: { number: gwNumber },
      create: { id: gwNumber, number: gwNumber, status: gwStatus },
      update: { status: gwStatus },
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

    summary[`gw${gwNumber}`] = { fixtures: gwItems.length, status: gwStatus };
  }

  return NextResponse.json({ totalFixtures: items.length, gameweeks: byGW.size, summary });
}
