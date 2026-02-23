/**
 * Tests for POST /api/predictions and GET /api/predictions
 *
 * Key behaviours under test:
 *   - Auth guard (401 when unauthenticated)
 *   - Input validation (400 for missing fields)
 *   - Fixture not found (404)
 *   - Kickoff lock enforcement — predictions locked once match starts (409)
 *   - Successful upsert (200)
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Module mocks (hoisted before imports)
// ---------------------------------------------------------------------------

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    fixture: { findUnique: vi.fn() },
    prediction: { findMany: vi.fn(), upsert: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const authedSession = { user: { id: "user-1" } };

function postReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/predictions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getReq(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/predictions");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url);
}

const futureKickoff = new Date(Date.now() + 60 * 60 * 1000); // 1 h from now
const pastKickoff   = new Date(Date.now() - 60 * 60 * 1000); // 1 h ago

const mockFixture = {
  id: "fix-1",
  kickoff: futureKickoff,
  homeTeam: "The Reds",
  awayTeam: "The Blues",
};

// ---------------------------------------------------------------------------
// POST tests
// ---------------------------------------------------------------------------

describe("POST /api/predictions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const res = await POST(postReq({ fixtureId: "fix-1", homeScore: 2, awayScore: 1 }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when fixtureId is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    const res = await POST(postReq({ homeScore: 2, awayScore: 1 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when homeScore is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    const res = await POST(postReq({ fixtureId: "fix-1", awayScore: 1 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when awayScore is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    const res = await POST(postReq({ fixtureId: "fix-1", homeScore: 2 }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when fixture does not exist", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.fixture.findUnique).mockResolvedValueOnce(null);
    const res = await POST(postReq({ fixtureId: "fix-1", homeScore: 2, awayScore: 1 }));
    expect(res.status).toBe(404);
  });

  it("returns 409 when prediction is submitted after kickoff", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.fixture.findUnique).mockResolvedValueOnce({
      ...mockFixture,
      kickoff: pastKickoff,
    } as any);
    const res = await POST(postReq({ fixtureId: "fix-1", homeScore: 2, awayScore: 1 }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/locked/i);
  });

  it("returns 200 and upserts prediction before kickoff", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.fixture.findUnique).mockResolvedValueOnce(mockFixture as any);
    const savedPrediction = {
      id: "pred-1",
      userId: "user-1",
      fixtureId: "fix-1",
      homeScore: 2,
      awayScore: 1,
      points: null,
    };
    vi.mocked(prisma.prediction.upsert).mockResolvedValueOnce(savedPrediction as any);

    const res = await POST(postReq({ fixtureId: "fix-1", homeScore: 2, awayScore: 1 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.homeScore).toBe(2);
    expect(body.awayScore).toBe(1);
    expect(vi.mocked(prisma.prediction.upsert)).toHaveBeenCalledOnce();
  });

  it("allows a 0-0 prediction", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.fixture.findUnique).mockResolvedValueOnce(mockFixture as any);
    vi.mocked(prisma.prediction.upsert).mockResolvedValueOnce({
      id: "pred-2",
      userId: "user-1",
      fixtureId: "fix-1",
      homeScore: 0,
      awayScore: 0,
      points: null,
    } as any);

    const res = await POST(postReq({ fixtureId: "fix-1", homeScore: 0, awayScore: 0 }));
    // homeScore: 0 is falsy but route checks `== null`, not falsy
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET tests
// ---------------------------------------------------------------------------

describe("GET /api/predictions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const res = await GET(getReq({ gameweekId: "1" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when gameweekId is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    const res = await GET(getReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 200 with predictions array", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    const rows = [
      { fixtureId: "fix-1", homeScore: 2, awayScore: 1, points: 3 },
    ];
    vi.mocked(prisma.prediction.findMany).mockResolvedValueOnce(rows as any);

    const res = await GET(getReq({ gameweekId: "5" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].homeScore).toBe(2);
  });
});
