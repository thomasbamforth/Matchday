import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { toNickname } from "@/lib/clubNicknames";

// Temporary admin sync endpoint — remove after use
export async function POST(req: Request) {
  const { gw } = await req.json() as { gw: number };
  const API_KEY = process.env.SOCCER_API_KEY;
  const BASE_URL = process.env.SOCCER_API_BASE_URL;
  if (!API_KEY || !BASE_URL) return NextResponse.json({ error: "Missing API env vars" }, { status: 500 });

  const url = `${BASE_URL}/fixtures?league=39&season=2024&round=Regular%20Season%20-%20${gw}`;
  const res = await fetch(url, { headers: { "x-apisports-key": API_KEY } });
  if (!res.ok) return NextResponse.json({ error: `API ${res.status}` }, { status: 500 });
  const json = await res.json() as { response: any[] };
  const items = json.response;
  if (!items.length) return NextResponse.json({ error: "No fixtures from API" });

  const statusMap: Record<string, "UPCOMING"|"LIVE"|"FINISHED"|"POSTPONED"> = {
    FT:"FINISHED",AET:"FINISHED",PEN:"FINISHED",
    "1H":"LIVE",HT:"LIVE","2H":"LIVE",ET:"LIVE",P:"LIVE",
    PST:"POSTPONED",CANC:"POSTPONED",ABD:"POSTPONED",
  };
  const toStatus = (s: string) => statusMap[s] ?? "UPCOMING";

  const gwRec = await prisma.gameweek.upsert({
    where: { number: gw },
    create: { id: gw, number: gw, status: "UPCOMING" },
    update: {},
  });

  const allFinished = items.every((i: any) => ["FT","AET","PEN"].includes(i.fixture.status.short));
  const anyLive = items.some((i: any) => ["1H","HT","2H","ET","P"].includes(i.fixture.status.short));
  await prisma.gameweek.update({
    where: { id: gwRec.id },
    data: { status: anyLive ? "ACTIVE" : allFinished ? "FINISHED" : "UPCOMING" },
  });

  for (const item of items) {
    const status = toStatus(item.fixture.status.short);
    await prisma.fixture.upsert({
      where: { externalId: String(item.fixture.id) },
      create: {
        externalId: String(item.fixture.id),
        gameweekId: gwRec.id,
        homeTeam: toNickname(item.teams.home.name),
        awayTeam: toNickname(item.teams.away.name),
        kickoff: new Date(item.fixture.date),
        status, homeScore: item.goals.home, awayScore: item.goals.away,
        postponed: status === "POSTPONED",
      },
      update: { status, homeScore: item.goals.home, awayScore: item.goals.away, postponed: status === "POSTPONED" },
    });
  }

  return NextResponse.json({ synced: gw, fixtures: items.length, gwStatus: anyLive ? "ACTIVE" : allFinished ? "FINISHED" : "UPCOMING" });
}
