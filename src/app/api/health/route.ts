import { NextResponse } from "next/server";

/**
 * GET /api/health
 * Unauthenticated liveness probe used by Render and Railway health checks.
 */
export async function GET() {
  return NextResponse.json({ ok: true });
}
