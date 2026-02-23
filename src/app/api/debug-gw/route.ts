import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

// Temporary diagnostic endpoint — remove after debugging
export async function GET() {
  const gws = await prisma.gameweek.findMany({
    include: { _count: { select: { fixtures: true } } },
    orderBy: { number: "asc" },
  });
  return NextResponse.json({ count: gws.length, gameweeks: gws });
}
