/**
 * Matchday scoring engine.
 *
 * Pure functions — no DB, no I/O. All boost interaction logic from CLAUDE.md §5.
 * Every function here has a corresponding test in scoring.test.ts.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MatchResult = "home" | "away" | "draw";
export type PredictionOutcome = "exact" | "correct_result" | "wrong";

export interface Score {
  home: number;
  away: number;
}

/**
 * All data needed to score one fixture for one user.
 *
 * isAwayDayPickFixture  — this is the fixture the user selected for their Away Day Pick
 * isUnderdogBoostFixture — user activated Underdog Boost on this fixture
 * underdogSide         — which side is the designated underdog (locked 12h before kickoff)
 */
export interface FixtureInput {
  prediction: Score;
  result: Score;
  isAwayDayPickFixture: boolean;
  isUnderdogBoostFixture: boolean;
  underdogSide: "home" | "away" | null;
}

/** Gameweek-level boost flags. */
export interface GameweekBoosts {
  /** Doubles the entire gameweek total. Applied last. */
  doubleDown: boolean;
  /**
   * Upgrades the Away Day Pick multiplier from 2× to 3×.
   * No-op if no Away Day Pick was made this gameweek.
   */
  outOnTheTown: boolean;
}

// ---------------------------------------------------------------------------
// Base score tables
// ---------------------------------------------------------------------------

const BASE_SCORES: Record<PredictionOutcome, number> = {
  exact: 3,
  correct_result: 1,
  wrong: 0,
};

/** Replaces BASE_SCORES when Underdog Boost is active AND the underdog won. */
const UNDERDOG_SCORES: Record<PredictionOutcome, number> = {
  exact: 5,
  correct_result: 3,
  wrong: 0,
};

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

/** Returns who won (or draw) based on a scoreline. */
export function getMatchResult(score: Score): MatchResult {
  if (score.home > score.away) return "home";
  if (score.away > score.home) return "away";
  return "draw";
}

/** Compares a prediction against the actual result. */
export function getPredictionOutcome(
  prediction: Score,
  result: Score
): PredictionOutcome {
  if (prediction.home === result.home && prediction.away === result.away) {
    return "exact";
  }
  if (getMatchResult(prediction) === getMatchResult(result)) {
    return "correct_result";
  }
  return "wrong";
}

// ---------------------------------------------------------------------------
// Per-fixture scoring
// ---------------------------------------------------------------------------

/**
 * Scores a single fixture for one user.
 *
 * Order of operations:
 *   1. Determine outcome (exact / correct_result / wrong)
 *   2. Apply Underdog Boost to base score (if active AND underdog won)
 *   3. Apply Away Day Pick multiplier (if this is the pick fixture AND away won)
 *      — multiplier is 2× normally, 3× with Out on the Town
 *
 * Note: Out on the Town is passed through from the gameweek-level boosts.
 * It has no effect unless isAwayDayPickFixture is true.
 */
export function scoreFixture(
  fixture: FixtureInput,
  boosts: Pick<GameweekBoosts, "outOnTheTown">
): number {
  const outcome = getPredictionOutcome(fixture.prediction, fixture.result);

  // Step 1 — determine base score, considering Underdog Boost
  const underdogWon =
    fixture.underdogSide !== null &&
    getMatchResult(fixture.result) === fixture.underdogSide;

  const useUnderdogScores =
    fixture.isUnderdogBoostFixture && underdogWon;

  const baseScore = useUnderdogScores
    ? UNDERDOG_SCORES[outcome]
    : BASE_SCORES[outcome];

  // Step 2 — Away Day Pick multiplier
  if (fixture.isAwayDayPickFixture) {
    const awayWon = getMatchResult(fixture.result) === "away";
    if (awayWon) {
      const multiplier = boosts.outOnTheTown ? 3 : 2;
      return baseScore * multiplier;
    }
  }

  return baseScore;
}

// ---------------------------------------------------------------------------
// Gameweek scoring
// ---------------------------------------------------------------------------

/**
 * Scores a full gameweek for one user.
 *
 * Order of operations:
 *   1. Score each fixture (including Away Day Pick + Underdog Boost per fixture)
 *   2. Sum all fixture scores
 *   3. Apply Double Down last (×2 on the entire total)
 *
 * Edge cases handled:
 *   - Out on the Town with no Away Day Pick fixture → no-op (§9.1)
 *   - Double Down + Out on the Town: Out on the Town resolves per-fixture first,
 *     then Double Down multiplies the full total (§9.2)
 */
export function scoreGameweek(
  fixtures: FixtureInput[],
  boosts: GameweekBoosts
): number {
  const fixtureTotal = fixtures.reduce(
    (sum, fixture) => sum + scoreFixture(fixture, { outOnTheTown: boosts.outOnTheTown }),
    0
  );

  return boosts.doubleDown ? fixtureTotal * 2 : fixtureTotal;
}

// ---------------------------------------------------------------------------
// Underdog determination (fallback logic — primary is Odds API)
// ---------------------------------------------------------------------------

/**
 * Fallback underdog determination when the Odds API is unavailable.
 * Returns the side that is 5+ table positions below their opponent, or null
 * if neither team qualifies.
 *
 * @param homePosition  Current league table position for the home team (1 = top)
 * @param awayPosition  Current league table position for the away team (1 = top)
 */
export function getUnderdogByTablePosition(
  homePosition: number,
  awayPosition: number
): "home" | "away" | null {
  const diff = homePosition - awayPosition; // positive = home team is lower
  if (diff >= 5) return "home";
  if (diff <= -5) return "away";
  return null;
}
