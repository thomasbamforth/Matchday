import { describe, it, expect } from "vitest";
import {
  getMatchResult,
  getPredictionOutcome,
  scoreFixture,
  scoreGameweek,
  getUnderdogByTablePosition,
  type Score,
  type FixtureInput,
  type GameweekBoosts,
} from "./scoring";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFixture(overrides: Partial<FixtureInput> = {}): FixtureInput {
  return {
    prediction: { home: 2, away: 1 },
    result: { home: 2, away: 1 },
    isAwayDayPickFixture: false,
    isUnderdogBoostFixture: false,
    underdogSide: null,
    ...overrides,
  };
}

const noBoosts: GameweekBoosts = { doubleDown: false, outOnTheTown: false };

// ---------------------------------------------------------------------------
// getMatchResult
// ---------------------------------------------------------------------------

describe("getMatchResult", () => {
  it("returns home on home win", () => {
    expect(getMatchResult({ home: 3, away: 1 })).toBe("home");
  });
  it("returns away on away win", () => {
    expect(getMatchResult({ home: 0, away: 2 })).toBe("away");
  });
  it("returns draw on equal scores", () => {
    expect(getMatchResult({ home: 1, away: 1 })).toBe("draw");
  });
  it("returns draw on 0–0", () => {
    expect(getMatchResult({ home: 0, away: 0 })).toBe("draw");
  });
});

// ---------------------------------------------------------------------------
// getPredictionOutcome
// ---------------------------------------------------------------------------

describe("getPredictionOutcome", () => {
  it("exact — prediction matches result exactly", () => {
    expect(getPredictionOutcome({ home: 2, away: 1 }, { home: 2, away: 1 })).toBe("exact");
  });
  it("exact — 0-0 prediction on 0-0 result", () => {
    expect(getPredictionOutcome({ home: 0, away: 0 }, { home: 0, away: 0 })).toBe("exact");
  });
  it("correct_result — right winner, wrong scoreline (home win)", () => {
    expect(getPredictionOutcome({ home: 1, away: 0 }, { home: 3, away: 1 })).toBe("correct_result");
  });
  it("correct_result — right winner, wrong scoreline (away win)", () => {
    expect(getPredictionOutcome({ home: 0, away: 1 }, { home: 1, away: 3 })).toBe("correct_result");
  });
  it("correct_result — predicted draw, actual draw different score", () => {
    expect(getPredictionOutcome({ home: 1, away: 1 }, { home: 2, away: 2 })).toBe("correct_result");
  });
  it("wrong — predicted home win, actual draw", () => {
    expect(getPredictionOutcome({ home: 2, away: 0 }, { home: 1, away: 1 })).toBe("wrong");
  });
  it("wrong — predicted draw, actual away win", () => {
    expect(getPredictionOutcome({ home: 1, away: 1 }, { home: 0, away: 2 })).toBe("wrong");
  });
  it("wrong — predicted home win, actual away win", () => {
    expect(getPredictionOutcome({ home: 3, away: 0 }, { home: 0, away: 1 })).toBe("wrong");
  });
});

// ---------------------------------------------------------------------------
// scoreFixture — standard scoring (no boosts)
// ---------------------------------------------------------------------------

describe("scoreFixture — standard (no boosts)", () => {
  const opts = { outOnTheTown: false };

  it("exact scoreline → 3 pts", () => {
    expect(scoreFixture(makeFixture(), opts)).toBe(3);
  });
  it("correct result, wrong score → 1 pt", () => {
    const f = makeFixture({ result: { home: 3, away: 1 } }); // still home win
    expect(scoreFixture(f, opts)).toBe(1);
  });
  it("wrong result → 0 pts", () => {
    const f = makeFixture({ result: { home: 0, away: 2 } }); // away win vs predicted home
    expect(scoreFixture(f, opts)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// scoreFixture — Away Day Pick
// ---------------------------------------------------------------------------

describe("scoreFixture — Away Day Pick", () => {
  const opts = { outOnTheTown: false };

  it("exact score + away win → 6 pts (3 × 2)", () => {
    const f = makeFixture({
      prediction: { home: 0, away: 2 },
      result: { home: 0, away: 2 },
      isAwayDayPickFixture: true,
    });
    expect(scoreFixture(f, opts)).toBe(6);
  });

  it("correct result + away win → 2 pts (1 × 2)", () => {
    const f = makeFixture({
      prediction: { home: 0, away: 1 },
      result: { home: 1, away: 3 },
      isAwayDayPickFixture: true,
    });
    expect(scoreFixture(f, opts)).toBe(2);
  });

  it("wrong result + away win → 0 pts (no bonus even if away won)", () => {
    const f = makeFixture({
      prediction: { home: 2, away: 0 }, // predicted home win
      result: { home: 0, away: 1 },    // away won
      isAwayDayPickFixture: true,
    });
    expect(scoreFixture(f, opts)).toBe(0);
  });

  it("exact score + away LOSES → 3 pts (pick doesn't pay out)", () => {
    const f = makeFixture({
      prediction: { home: 2, away: 0 },
      result: { home: 2, away: 0 }, // home won, not away
      isAwayDayPickFixture: true,
    });
    expect(scoreFixture(f, opts)).toBe(3);
  });

  it("exact score + draw → 3 pts (pick doesn't pay out on draw)", () => {
    const f = makeFixture({
      prediction: { home: 1, away: 1 },
      result: { home: 1, away: 1 },
      isAwayDayPickFixture: true,
    });
    expect(scoreFixture(f, opts)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// scoreFixture — Out on the Town
// ---------------------------------------------------------------------------

describe("scoreFixture — Out on the Town", () => {
  it("Away Day Pick + Out on the Town → 3× multiplier on exact score", () => {
    const f = makeFixture({
      prediction: { home: 0, away: 1 },
      result: { home: 0, away: 1 },
      isAwayDayPickFixture: true,
    });
    expect(scoreFixture(f, { outOnTheTown: true })).toBe(9); // 3 × 3
  });

  it("Away Day Pick + Out on the Town → 3× multiplier on correct result", () => {
    const f = makeFixture({
      prediction: { home: 0, away: 1 },
      result: { home: 0, away: 2 },
      isAwayDayPickFixture: true,
    });
    expect(scoreFixture(f, { outOnTheTown: true })).toBe(3); // 1 × 3
  });

  it("Out on the Town with no Away Day Pick → no-op (§9.1)", () => {
    const f = makeFixture({
      prediction: { home: 2, away: 1 },
      result: { home: 2, away: 1 },
      isAwayDayPickFixture: false, // no pick
    });
    expect(scoreFixture(f, { outOnTheTown: true })).toBe(3); // just 3 pts, no multiplier
  });

  it("Out on the Town, pick fixture, away loses → no multiplier pays out", () => {
    const f = makeFixture({
      prediction: { home: 2, away: 0 },
      result: { home: 2, away: 0 },
      isAwayDayPickFixture: true,
    });
    expect(scoreFixture(f, { outOnTheTown: true })).toBe(3); // away didn't win
  });
});

// ---------------------------------------------------------------------------
// scoreFixture — Underdog Boost
// ---------------------------------------------------------------------------

describe("scoreFixture — Underdog Boost", () => {
  const opts = { outOnTheTown: false };

  it("exact score + underdog boost active + underdog (away) wins → 5 pts", () => {
    const f = makeFixture({
      prediction: { home: 0, away: 1 },
      result: { home: 0, away: 1 },
      isUnderdogBoostFixture: true,
      underdogSide: "away",
    });
    expect(scoreFixture(f, opts)).toBe(5);
  });

  it("correct result + underdog boost active + underdog wins → 3 pts", () => {
    const f = makeFixture({
      prediction: { home: 0, away: 1 },
      result: { home: 0, away: 2 },
      isUnderdogBoostFixture: true,
      underdogSide: "away",
    });
    expect(scoreFixture(f, opts)).toBe(3);
  });

  it("wrong result + underdog wins → 0 pts (boost doesn't rescue a wrong prediction)", () => {
    const f = makeFixture({
      prediction: { home: 2, away: 0 },
      result: { home: 0, away: 1 },
      isUnderdogBoostFixture: true,
      underdogSide: "away",
    });
    expect(scoreFixture(f, opts)).toBe(0);
  });

  it("underdog boost active but underdog LOSES → standard base score applies", () => {
    const f = makeFixture({
      prediction: { home: 2, away: 0 },
      result: { home: 2, away: 0 },
      isUnderdogBoostFixture: true,
      underdogSide: "away", // away is underdog but home won
    });
    expect(scoreFixture(f, opts)).toBe(3); // standard exact score
  });

  it("underdog boost inactive → standard base score regardless of underdog result", () => {
    const f = makeFixture({
      prediction: { home: 0, away: 1 },
      result: { home: 0, away: 1 },
      isUnderdogBoostFixture: false, // boost not activated
      underdogSide: "away",
    });
    expect(scoreFixture(f, opts)).toBe(3); // no boost
  });
});

// ---------------------------------------------------------------------------
// scoreFixture — Underdog Boost + Away Day Pick (stacking)
// ---------------------------------------------------------------------------

describe("scoreFixture — Underdog Boost stacks with Away Day Pick", () => {
  it("exact + underdog (away) wins + Away Day Pick → 5 × 2 = 10 pts", () => {
    const f = makeFixture({
      prediction: { home: 0, away: 1 },
      result: { home: 0, away: 1 },
      isUnderdogBoostFixture: true,
      underdogSide: "away",
      isAwayDayPickFixture: true,
    });
    expect(scoreFixture(f, { outOnTheTown: false })).toBe(10);
  });

  it("exact + underdog (away) wins + Away Day Pick + Out on the Town → 5 × 3 = 15 pts", () => {
    const f = makeFixture({
      prediction: { home: 0, away: 1 },
      result: { home: 0, away: 1 },
      isUnderdogBoostFixture: true,
      underdogSide: "away",
      isAwayDayPickFixture: true,
    });
    expect(scoreFixture(f, { outOnTheTown: true })).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// scoreGameweek — Double Down
// ---------------------------------------------------------------------------

describe("scoreGameweek — Double Down", () => {
  it("no boosts → sum of fixture scores", () => {
    const fixtures = [
      makeFixture({ result: { home: 2, away: 1 } }), // exact → 3
      makeFixture({ result: { home: 3, away: 2 } }), // correct result → 1
      makeFixture({ result: { home: 0, away: 2 } }), // wrong → 0
    ];
    expect(scoreGameweek(fixtures, noBoosts)).toBe(4);
  });

  it("Double Down alone → total × 2", () => {
    const fixtures = [
      makeFixture(), // exact → 3
      makeFixture({ result: { home: 3, away: 2 } }), // correct result → 1
    ];
    expect(scoreGameweek(fixtures, { doubleDown: true, outOnTheTown: false })).toBe(8); // (3+1)×2
  });

  it("Double Down on zero total → still 0", () => {
    const fixtures = [
      makeFixture({ result: { home: 0, away: 2 } }), // wrong
    ];
    expect(scoreGameweek(fixtures, { doubleDown: true, outOnTheTown: false })).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// scoreGameweek — full formula (§9.2 edge case)
// ---------------------------------------------------------------------------

describe("scoreGameweek — Double Down + Out on the Town (§9.2)", () => {
  it("Out on the Town applies first (3×), then Double Down on full total", () => {
    // Away Day Pick fixture: exact score, away wins → 3 × 3 = 9
    const awayPickFixture = makeFixture({
      prediction: { home: 0, away: 1 },
      result: { home: 0, away: 1 },
      isAwayDayPickFixture: true,
    });
    // Other fixture: correct result → 1
    const otherFixture = makeFixture({ result: { home: 3, away: 2 } });

    // Total before DD: 9 + 1 = 10; after DD: 20
    expect(
      scoreGameweek([awayPickFixture, otherFixture], {
        doubleDown: true,
        outOnTheTown: true,
      })
    ).toBe(20);
  });

  it("matches the CLAUDE.md §5.4 worked example (all boosts, exact on pick fixture)", () => {
    // Example: exact on Away Day Pick match
    // Base: 3; Out on the Town: 3×3=9; Double Down: 9×2=18 from that match
    // Full GW total 20 pts with Double Down → 40 pts
    // Simulated: pick fixture = 9 pts, other fixture = 11 pts → total = 20 before DD → 40

    const awayPickFixture = makeFixture({
      prediction: { home: 0, away: 1 },
      result: { home: 0, away: 1 },
      isAwayDayPickFixture: true,
    });

    // 11 pts from other fixtures (exact × 3 + correct × 2 = 9 + 2)
    const other1 = makeFixture(); // exact → 3
    const other2 = makeFixture(); // exact → 3
    const other3 = makeFixture(); // exact → 3
    const other4 = makeFixture({ result: { home: 3, away: 2 } }); // correct → 1
    const other5 = makeFixture({ result: { home: 3, away: 2 } }); // correct → 1

    expect(
      scoreGameweek(
        [awayPickFixture, other1, other2, other3, other4, other5],
        { doubleDown: true, outOnTheTown: true }
      )
    ).toBe(40); // (9 + 3 + 3 + 3 + 1 + 1) × 2 = 20 × 2 = 40
  });
});

// ---------------------------------------------------------------------------
// getUnderdogByTablePosition
// ---------------------------------------------------------------------------

describe("getUnderdogByTablePosition", () => {
  it("home team 5+ places below → home is underdog", () => {
    expect(getUnderdogByTablePosition(15, 10)).toBe("home"); // diff = 5
  });
  it("away team 5+ places below → away is underdog", () => {
    expect(getUnderdogByTablePosition(3, 8)).toBe("away"); // diff = -5
  });
  it("difference exactly 5 → qualifies", () => {
    expect(getUnderdogByTablePosition(6, 1)).toBe("home");
  });
  it("difference < 5 → no underdog", () => {
    expect(getUnderdogByTablePosition(5, 1)).toBeNull(); // diff = 4
  });
  it("same position → no underdog", () => {
    expect(getUnderdogByTablePosition(5, 5)).toBeNull();
  });
  it("top vs bottom (1 vs 20) → away is underdog", () => {
    expect(getUnderdogByTablePosition(1, 20)).toBe("away");
  });
});
