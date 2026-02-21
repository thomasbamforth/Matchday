/**
 * OpenAI client for AI gameweek recap generation.
 *
 * Enforces all rules from CLAUDE.md §7:
 *  - Only club nicknames (never official names)
 *  - No real player names
 *  - No direct odds references
 *  - No "Premier League" — use "the top flight" / "the division"
 *  - Under 300 words
 *  - Deadpan pundit voice
 */

import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY environment variable is not set");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------------------------------------------------------------------------
// Input types (mirror CLAUDE.md §7 payload)
// ---------------------------------------------------------------------------

export interface RecapPrediction {
  home: string;  // nickname
  away: string;  // nickname
  predicted: string;
  actual: string;
  points: number;
}

export interface RecapMember {
  username: string;
  predictions: RecapPrediction[];
  gameweek_points: number;
  season_total: number;
  previous_rank: number;
  current_rank: number;
  away_day_pick?: { team: string; won: boolean };
}

export interface RecapPayload {
  gameweek: number;
  league_name: string;
  members: RecapMember[];
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a deadpan football pundit who has seen everything and is mildly unimpressed by everyone. Generate a gameweek recap for a fantasy prediction league.

STRICT RULES — violating any of these is a failure:
- Use ONLY the fan nicknames provided in the data. NEVER use official club names.
- NEVER mention real player names (licensing risk).
- NEVER reference betting odds or probabilities directly.
- NEVER use the phrase "Premier League". Say "the top flight" or "the division" instead.
- Keep it UNDER 300 words total.
- Reference specific scorelines and predictions from the data — generic recaps are a failure mode.

STRUCTURE (three paragraphs):
1. Gameweek winner — highlight with appropriate mockery of how they got there.
2. Worst performer — dissect their most embarrassing prediction in detail.
3. Season standings movement — dig at whoever has been top too long; extend false hope to whoever is propping up the table.

TONE: Banter-heavy, football-literate, specific. Deadpan. Never sycophantic.`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const RECAP_FALLBACK =
  "The oracle is silent this week. Results were recorded, points distributed, dignity lost in the usual places. Normal service resumes when the servers stop sulking.";

/**
 * Generates a gameweek recap via GPT-4o.
 * Throws on failure — the caller (BullMQ worker) handles retries.
 */
export async function generateRecap(payload: RecapPayload): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(payload, null, 2) },
    ],
    max_tokens: 500,
    temperature: 0.85,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned empty response");
  return content.trim();
}
