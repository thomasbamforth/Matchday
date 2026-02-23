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
