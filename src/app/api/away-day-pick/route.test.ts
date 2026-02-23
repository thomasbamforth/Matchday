/**
 * Tests for POST /api/away-day-pick and DELETE /api/away-day-pick
 *
 * Key behaviours under test:
 *   - Auth guard (401)
 *   - Input validation (400)
 *   - Fixture not found (404)
 *   - Postponed fixture guard (409) — §9.7
 *   - Kickoff lock — pick locks at kickoff of chosen fixture (409) — §9.4
 *   - Successful pick upsert, including `voided: false` reset for re-picks
 *   - DELETE: rejects removal after kickoff (409)
 *   - DELETE: succeeds before kickoff
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    fixture: { findUnique: vi.fn() },
    awayDayPick: { upsert: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { POST, DELETE } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const authedSession = { user: { id: "user-1" } };

function postReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/away-day-pick", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deleteReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/away-day-pick", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const futureKickoff = new Date(Date.now() + 60 * 60 * 1000);
const pastKickoff   = new Date(Date.now() - 60 * 60 * 1000);

const activeFixture = {
  id: "fix-1",
  awayTeam: "The Seagulls",
  kickoff: futureKickoff,
  postponed: false,
};

const postponedFixture = {
  id: "fix-2",
  awayTeam: "The Cherries",
  kickoff: futureKickoff,
  postponed: true,
};

const lockedFixture = {
  id: "fix-3",
  awayTeam: "The Bees",
  kickoff: pastKickoff,
  postponed: false,
};

// ---------------------------------------------------------------------------
// POST tests
// ---------------------------------------------------------------------------

describe("POST /api/away-day-pick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const res = await POST(postReq({ fixtureId: "fix-1", gameweekId: 5 }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when fixtureId is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    const res = await POST(postReq({ gameweekId: 5 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when gameweekId is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    const res = await POST(postReq({ fixtureId: "fix-1" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 when fixture does not exist", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.fixture.findUnique).mockResolvedValueOnce(null);
    const res = await POST(postReq({ fixtureId: "bad-id", gameweekId: 5 }));
    expect(res.status).toBe(404);
  });

  it("returns 409 when fixture is postponed", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.fixture.findUnique).mockResolvedValueOnce(postponedFixture as any);
    const res = await POST(postReq({ fixtureId: "fix-2", gameweekId: 5 }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/postponed/i);
  });

  it("returns 409 when fixture has already kicked off", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.fixture.findUnique).mockResolvedValueOnce(lockedFixture as any);
    const res = await POST(postReq({ fixtureId: "fix-3", gameweekId: 5 }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/locked/i);
  });

  it("returns 200 and upserts pick before kickoff", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.fixture.findUnique).mockResolvedValueOnce(activeFixture as any);
    const savedPick = {
      id: "pick-1",
      userId: "user-1",
      gameweekId: 5,
      fixtureId: "fix-1",
      team: "The Seagulls",
      voided: false,
      won: null,
    };
    vi.mocked(prisma.awayDayPick.upsert).mockResolvedValueOnce(savedPick as any);
    const res = await POST(postReq({ fixtureId: "fix-1", gameweekId: 5 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.team).toBe("The Seagulls");
  });

  it("upsert update payload includes voided: false to re-enable a previously voided slot", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.fixture.findUnique).mockResolvedValueOnce(activeFixture as any);
    vi.mocked(prisma.awayDayPick.upsert).mockResolvedValueOnce({ id: "pick-1" } as any);

    await POST(postReq({ fixtureId: "fix-1", gameweekId: 5 }));

    expect(vi.mocked(prisma.awayDayPick.upsert)).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ voided: false }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// DELETE tests
// ---------------------------------------------------------------------------

describe("DELETE /api/away-day-pick", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const res = await DELETE(deleteReq({ gameweekId: 5 }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when gameweekId is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    const res = await DELETE(deleteReq({}));
    expect(res.status).toBe(400);
  });

  it("returns 200 (no-op) when no pick exists", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.awayDayPick.findUnique).mockResolvedValueOnce(null);
    const res = await DELETE(deleteReq({ gameweekId: 5 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(vi.mocked(prisma.awayDayPick.delete)).not.toHaveBeenCalled();
  });

  it("returns 409 when fixture has already kicked off", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.awayDayPick.findUnique).mockResolvedValueOnce({
      id: "pick-1",
      fixture: { kickoff: pastKickoff },
    } as any);
    const res = await DELETE(deleteReq({ gameweekId: 5 }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/cannot remove/i);
  });

  it("returns 200 and deletes pick before kickoff", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.awayDayPick.findUnique).mockResolvedValueOnce({
      id: "pick-1",
      fixture: { kickoff: futureKickoff },
    } as any);
    vi.mocked(prisma.awayDayPick.delete).mockResolvedValueOnce({} as any);
    const res = await DELETE(deleteReq({ gameweekId: 5 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(vi.mocked(prisma.awayDayPick.delete)).toHaveBeenCalledOnce();
  });
});
