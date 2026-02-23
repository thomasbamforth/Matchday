import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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

  // Raw SQL to check if RLS is blocking ORM
  const raw = await prisma.$queryRaw<{ number: number; status: string }[]>`
    SELECT number, status FROM "Gameweek" ORDER BY number ASC
  `;

  return NextResponse.json({ count: gws.length, rawCount: raw.length, dbHost, gameweeks: gws, raw });
}
