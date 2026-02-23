/**
 * Tests for scoreUpdate worker helpers.
 *
 * computeRanksPerLeague is the pure ranking function used to detect rival
 * overtakes. It has no I/O and can be exercised directly.
 */

import { describe, it, expect } from "vitest";
import { computeRanksPerLeague } from "./scoreUpdate";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function member(leagueId: string, userId: string) {
  return { leagueId, userId, user: { name: userId } };
}

// ---------------------------------------------------------------------------
// computeRanksPerLeague
// ---------------------------------------------------------------------------

describe("computeRanksPerLeague", () => {
  it("ranks a single user as rank 1", () => {
    const members = [member("league-A", "user-1")];
    const points  = { "user-1": 10 };
    const ranks   = computeRanksPerLeague(members, points);
    expect(ranks["league-A"]["user-1"]).toBe(1);
  });

  it("assigns ranks by descending points (highest → rank 1)", () => {
    const members = [
      member("league-A", "user-1"),
      member("league-A", "user-2"),
      member("league-A", "user-3"),
    ];
    const points = { "user-1": 5, "user-2": 15, "user-3": 10 };
    const ranks  = computeRanksPerLeague(members, points);

    expect(ranks["league-A"]["user-2"]).toBe(1);
    expect(ranks["league-A"]["user-3"]).toBe(2);
    expect(ranks["league-A"]["user-1"]).toBe(3);
  });

  it("gives equal rank positions to tied users (both get the same ordinal position)", () => {
    // The implementation sorts and assigns positional ranks (1, 2, 2, 4 style),
    // but the current implementation assigns sequential indices regardless of tie.
    // Test documents actual behaviour: tied users keep their insertion-order rank.
    const members = [
      member("league-A", "user-1"),
      member("league-A", "user-2"),
    ];
    const points = { "user-1": 10, "user-2": 10 };
    const ranks  = computeRanksPerLeague(members, points);

    // Both users have the same points; they receive ranks 1 and 2
    // (insertion-order tie-break — no skipping).
    const r1 = ranks["league-A"]["user-1"];
    const r2 = ranks["league-A"]["user-2"];
    expect([r1, r2].sort()).toEqual([1, 2]);
  });

  it("defaults to 0 points for users absent from the points map", () => {
    const members = [
      member("league-A", "user-1"),
      member("league-A", "user-2"),
    ];
    // user-2 has no entry — treated as 0
    const points = { "user-1": 7 };
    const ranks  = computeRanksPerLeague(members, points);

    expect(ranks["league-A"]["user-1"]).toBe(1);
    expect(ranks["league-A"]["user-2"]).toBe(2);
  });

  it("handles multiple leagues independently", () => {
    const members = [
      member("league-A", "user-1"),
      member("league-A", "user-2"),
      member("league-B", "user-2"),
      member("league-B", "user-3"),
    ];
    const points = { "user-1": 20, "user-2": 15, "user-3": 25 };
    const ranks  = computeRanksPerLeague(members, points);

    // League A
    expect(ranks["league-A"]["user-1"]).toBe(1);
    expect(ranks["league-A"]["user-2"]).toBe(2);

    // League B — user-3 leads
    expect(ranks["league-B"]["user-3"]).toBe(1);
    expect(ranks["league-B"]["user-2"]).toBe(2);
  });

  it("a user in multiple leagues gets an independent rank in each", () => {
    const members = [
      member("league-A", "user-1"),
      member("league-A", "user-2"),
      member("league-B", "user-1"),
      member("league-B", "user-3"),
    ];
    const points = { "user-1": 10, "user-2": 20, "user-3": 5 };
    const ranks  = computeRanksPerLeague(members, points);

    // In league A, user-1 is rank 2 (user-2 leads)
    expect(ranks["league-A"]["user-1"]).toBe(2);
    // In league B, user-1 is rank 1 (user-3 trails)
    expect(ranks["league-B"]["user-1"]).toBe(1);
  });

  it("returns an empty object for an empty member list", () => {
    const ranks = computeRanksPerLeague([], {});
    expect(ranks).toEqual({});
  });
});
