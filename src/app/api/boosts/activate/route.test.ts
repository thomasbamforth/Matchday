/**
 * Tests for POST /api/boosts/activate
 *
 * Key behaviours under test:
 *   - Auth guard (401)
 *   - Input validation (400 for missing / invalid fields)
 *   - Gameweek not found (404)
 *   - Slot timing: slot-1 cannot be used after GW19 (409)
 *   - Slot timing: slot-2 cannot be used before GW20 (409)
 *   - Already-activated chip is rejected (409)
 *   - Expired chip is rejected (409)
 *   - UNDERDOG_BOOST requires fixtureId before kickoff (400/404/409)
 *   - Successful activation creates or updates the chip (200)
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    gameweek: { findUnique: vi.fn() },
    boostChip: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    fixture: { findUnique: vi.fn() },
  },
}));

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const authedSession = { user: { id: "user-1" } };

function req(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/boosts/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const gw10  = { id: 10,  number: 10,  status: "UPCOMING" };
const gw19  = { id: 19,  number: 19,  status: "UPCOMING" };
const gw20  = { id: 20,  number: 20,  status: "UPCOMING" };
const gw25  = { id: 25,  number: 25,  status: "UPCOMING" };

const futureKickoff = new Date(Date.now() + 60 * 60 * 1000);
const pastKickoff   = new Date(Date.now() - 60 * 60 * 1000);

const freshChip = { id: "chip-1", slot: 1, activatedAt: null, expired: false };
const activatedChip = { id: "chip-2", slot: 1, activatedAt: new Date(), expired: false };
const expiredChip   = { id: "chip-3", slot: 1, activatedAt: null, expired: true };

const mockChipResult = { id: "chip-new", slot: 1, type: "DOUBLE_DOWN", gameweekId: 10, activatedAt: new Date() };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/boosts/activate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Auth ---

  it("returns 401 when not authenticated", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);
    const res = await POST(req({ slot: 1, type: "DOUBLE_DOWN", gameweekId: 10 }));
    expect(res.status).toBe(401);
  });

  // --- Input validation ---

  it("returns 400 when slot is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    const res = await POST(req({ type: "DOUBLE_DOWN", gameweekId: 10 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when type is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    const res = await POST(req({ slot: 1, gameweekId: 10 }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when gameweekId is missing", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    const res = await POST(req({ slot: 1, type: "DOUBLE_DOWN" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid boost type", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    const res = await POST(req({ slot: 1, type: "SUPER_BOOST", gameweekId: 10 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid boost type/i);
  });

  // --- Gameweek lookup ---

  it("returns 404 when gameweek does not exist", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.gameweek.findUnique).mockResolvedValueOnce(null);
    const res = await POST(req({ slot: 1, type: "DOUBLE_DOWN", gameweekId: 99 }));
    expect(res.status).toBe(404);
  });

  // --- Slot timing rules ---

  it("returns 409 when slot-1 chip is used after GW19", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.gameweek.findUnique).mockResolvedValueOnce(gw20 as any);
    const res = await POST(req({ slot: 1, type: "DOUBLE_DOWN", gameweekId: 20 }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/expired/i);
  });

  it("allows slot-1 chip on GW19 (boundary)", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.gameweek.findUnique).mockResolvedValueOnce(gw19 as any);
    vi.mocked(prisma.boostChip.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.boostChip.create).mockResolvedValueOnce(mockChipResult as any);
    const res = await POST(req({ slot: 1, type: "DOUBLE_DOWN", gameweekId: 19 }));
    expect(res.status).toBe(200);
  });

  it("returns 409 when slot-2 chip is used before GW20", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.gameweek.findUnique).mockResolvedValueOnce(gw10 as any);
    const res = await POST(req({ slot: 2, type: "DOUBLE_DOWN", gameweekId: 10 }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/gw20/i);
  });

  it("allows slot-2 chip on GW20 (boundary)", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.gameweek.findUnique).mockResolvedValueOnce(gw20 as any);
    vi.mocked(prisma.boostChip.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.boostChip.create).mockResolvedValueOnce(mockChipResult as any);
    const res = await POST(req({ slot: 2, type: "DOUBLE_DOWN", gameweekId: 20 }));
    expect(res.status).toBe(200);
  });

  // --- Chip state guards ---

  it("returns 409 when chip is already activated", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.gameweek.findUnique).mockResolvedValueOnce(gw10 as any);
    vi.mocked(prisma.boostChip.findFirst).mockResolvedValueOnce(activatedChip as any);
    const res = await POST(req({ slot: 1, type: "DOUBLE_DOWN", gameweekId: 10 }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/already activated/i);
  });

  it("returns 409 when chip is expired", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.gameweek.findUnique).mockResolvedValueOnce(gw10 as any);
    vi.mocked(prisma.boostChip.findFirst).mockResolvedValueOnce(expiredChip as any);
    const res = await POST(req({ slot: 1, type: "DOUBLE_DOWN", gameweekId: 10 }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/expired/i);
  });

  // --- UNDERDOG_BOOST specific ---

  it("returns 400 for UNDERDOG_BOOST without fixtureId", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.gameweek.findUnique).mockResolvedValueOnce(gw10 as any);
    vi.mocked(prisma.boostChip.findFirst).mockResolvedValueOnce(null);
    const res = await POST(req({ slot: 1, type: "UNDERDOG_BOOST", gameweekId: 10 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/fixtureId required/i);
  });

  it("returns 404 when UNDERDOG_BOOST fixture does not exist", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.gameweek.findUnique).mockResolvedValueOnce(gw10 as any);
    vi.mocked(prisma.boostChip.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.fixture.findUnique).mockResolvedValueOnce(null);
    const res = await POST(req({ slot: 1, type: "UNDERDOG_BOOST", gameweekId: 10, fixtureId: "bad-id" }));
    expect(res.status).toBe(404);
  });

  it("returns 409 for UNDERDOG_BOOST activated after kickoff", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.gameweek.findUnique).mockResolvedValueOnce(gw10 as any);
    vi.mocked(prisma.boostChip.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.fixture.findUnique).mockResolvedValueOnce({ id: "fix-1", kickoff: pastKickoff } as any);
    const res = await POST(req({ slot: 1, type: "UNDERDOG_BOOST", gameweekId: 10, fixtureId: "fix-1" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/before kickoff/i);
  });

  // --- Successful activation ---

  it("creates a new chip when none exists", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.gameweek.findUnique).mockResolvedValueOnce(gw10 as any);
    vi.mocked(prisma.boostChip.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.boostChip.create).mockResolvedValueOnce(mockChipResult as any);
    const res = await POST(req({ slot: 1, type: "DOUBLE_DOWN", gameweekId: 10 }));
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.boostChip.create)).toHaveBeenCalledOnce();
    expect(vi.mocked(prisma.boostChip.update)).not.toHaveBeenCalled();
  });

  it("updates an existing unactivated chip", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.gameweek.findUnique).mockResolvedValueOnce(gw10 as any);
    vi.mocked(prisma.boostChip.findFirst).mockResolvedValueOnce(freshChip as any);
    vi.mocked(prisma.boostChip.update).mockResolvedValueOnce(mockChipResult as any);
    const res = await POST(req({ slot: 1, type: "DOUBLE_DOWN", gameweekId: 10 }));
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.boostChip.update)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "chip-1" } })
    );
    expect(vi.mocked(prisma.boostChip.create)).not.toHaveBeenCalled();
  });

  it("creates UNDERDOG_BOOST chip with fixtureId before kickoff", async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(authedSession);
    vi.mocked(prisma.gameweek.findUnique).mockResolvedValueOnce(gw25 as any);
    vi.mocked(prisma.boostChip.findFirst).mockResolvedValueOnce(null);
    vi.mocked(prisma.fixture.findUnique).mockResolvedValueOnce({ id: "fix-1", kickoff: futureKickoff } as any);
    vi.mocked(prisma.boostChip.create).mockResolvedValueOnce({ ...mockChipResult, type: "UNDERDOG_BOOST", fixtureId: "fix-1" } as any);
    const res = await POST(req({ slot: 2, type: "UNDERDOG_BOOST", gameweekId: 25, fixtureId: "fix-1" }));
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.boostChip.create)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ fixtureId: "fix-1" }) })
    );
  });
});
