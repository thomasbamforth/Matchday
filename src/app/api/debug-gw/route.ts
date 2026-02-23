import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Temporary diagnostic endpoint — remove after debugging
export async function GET() {
  const dbUrl = process.env.DATABASE_URL ?? "not set";
  // Mask password: show only scheme + host
  let dbHost = "unknown";
  try {
    const u = new URL(dbUrl);
    dbHost = `${u.protocol}//${u.hostname}:${u.port}`;
  } catch { /* noop */ }

  const gws = await prisma.gameweek.findMany({
    include: { _count: { select: { fixtures: true } } },
    orderBy: { number: "asc" },
  });
  return NextResponse.json({ count: gws.length, dbHost, gameweeks: gws });
}
