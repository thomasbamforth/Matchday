# CLAUDE.md — Matchday

This file is Claude Code's persistent project context. Read it at the start of every session.
Do not modify this file unless explicitly instructed to by the developer.

---

## 1. Project Overview

**Matchday** is a real-time, social, competitive web application for Premier League fans.
Users predict exact scorelines for every top-flight fixture each gameweek, earn points for accuracy,
and compete in private leagues or the global leaderboard.

Built purely for fun. No monetisation. No ads. No official PL branding.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Backend | Next.js API Routes + Node.js |
| Database | PostgreSQL (via Prisma ORM) |
| Caching / Pub-Sub | Redis |
| Real-time | WebSockets (primary), Server-Sent Events (fallback) |
| Auth | NextAuth.js |
| AI Recap | OpenAI API (GPT-4o) |
| Push Notifications | Firebase Cloud Messaging (FCM) |
| Queue / Jobs | BullMQ (backed by Redis) |
| Deployment | Vercel (frontend) + Railway or Render (backend services) |

**Rules:**
- The frontend NEVER queries external APIs directly. All external data flows through our backend.
- PostgreSQL is the canonical source of truth for all fixture and prediction data.
- Redis is for caching and pub/sub only — never treat it as a primary store.

---

## 3. Environment Variables

Reference these by name only. Never hardcode values. Never log them. Never expose them client-side
unless prefixed with `NEXT_PUBLIC_` and confirmed safe.

```
DATABASE_URL                  # PostgreSQL connection string
REDIS_URL                     # Redis connection string
NEXTAUTH_SECRET               # NextAuth session secret
NEXTAUTH_URL                  # App base URL

SOCCER_API_KEY                # API-Football or SportMonks key
SOCCER_API_BASE_URL           # Base URL for fixtures/scores API

ODDS_API_KEY                  # The Odds API key (for Underdog Boost)
ODDS_API_BASE_URL             # https://api.the-odds-api.com

OPENAI_API_KEY                # OpenAI API key (recap generation)

FCM_SERVER_KEY                # Firebase Cloud Messaging server key
FCM_PROJECT_ID                # Firebase project ID
```

---

## 4. Club Nickname Convention — NEVER VIOLATE THIS

Matchday never uses official club names, trademarked league branding, lion crests, official badges,
or licensed logos — anywhere. Not in the UI, not in AI-generated content, not in code comments
that might surface in the UI, not in error messages shown to users.

Use ONLY the fan nicknames listed below. This mapping is enforced at the data ingestion layer:
official names from the API are mapped to nicknames before being stored or passed anywhere.

**The AI recap system prompt must explicitly instruct the model to use only these nicknames.**

### Club Nickname Map

```typescript
// src/lib/clubNicknames.ts — SINGLE SOURCE OF TRUTH
export const CLUB_NICKNAMES: Record<string, string> = {
  "Arsenal":                  "The Gunners",
  "Aston Villa":              "The Villans",
  "Bournemouth":              "The Cherries",
  "Brentford":                "The Bees",
  "Brighton":                 "The Seagulls",
  "Chelsea":                  "The Blues",
  "Crystal Palace":           "The Eagles",
  "Everton":                  "The Toffees",
  "Fulham":                   "The Cottagers",
  "Ipswich":                  "The Tractor Boys",
  "Leicester":                "The Foxes",
  "Liverpool":                "The Reds",
  "Man City":                 "The Citizens",
  "Man United":               "The Red Devils",
  "Newcastle":                "The Magpies",
  "Nottm Forest":             "The Tricky Trees",
  "Southampton":              "The Saints",
  "Spurs":                    "The Lilywhites",
  "West Ham":                 "The Hammers",
  "Wolves":                   "The Wanderers",
};

export function toNickname(officialName: string): string {
  return CLUB_NICKNAMES[officialName] ?? officialName;
}
```

Apply `toNickname()` at every point where external API data enters the system.
Never pass raw official club names to the frontend or the OpenAI prompt.

---

## 5. Scoring & Boost Logic — Implement Exactly as Specified

### 5.1 Standard Prediction Scoring

| Outcome | Points |
|---|---|
| Exact scoreline correct | 3 pts |
| Correct result (win/draw/loss), wrong score | 1 pt |
| Wrong result | 0 pts |

### 5.2 Away Day Pick

- One per gameweek, per user. Does not carry over if unused.
- User picks one away team to win outright (binary — win or not).
- Locks at kickoff of the chosen fixture (independently of other fixtures).
- **Payout:** doubles the points earned from the standard prediction on that same match.
  - Exact score (3 pts) → 6 pts
  - Correct result (1 pt) → 2 pts
  - Wrong prediction (0 pts) → 0 pts (no bonus regardless of away win)
- Only pays out if the selected away team wins.

### 5.3 Boost Chips

Each user receives **2 boost chips per season**. Usage is time-gated:

| Chip | Window |
|---|---|
| Boost #1 | Must be used on or before the final match of Gameweek 19 |
| Boost #2 | Must be used from Gameweek 20 onwards |

If Boost #1 is not used by end of GW19, it **expires**. No exceptions, no grace period.
Once activated, a boost **cannot be reversed**.

#### Double Down
- Doubles the user's **total points tally for the entire gameweek**.
- Applied **after** all match points and any Out on the Town multipliers are calculated.
- Formula: `gameweekTotal × 2`

#### Out on the Town
- Upgrades the Away Day Pick multiplier from **2× to 3×** for that gameweek.
- Has **no effect** if the user has not also made an Away Day Pick that gameweek.
- If both Out on the Town AND Double Down are activated the same gameweek:
  1. Out on the Town applies to the Away Day Pick match first (3× instead of 2×)
  2. Double Down then doubles the **entire gameweek total** (including the upgraded pick)

#### Underdog Boost
- Activated on a specific fixture, before kickoff.
- If the underdog wins AND the user's prediction is correct:
  - Exact score: **5 pts** (replaces standard 3 pts)
  - Correct result: **3 pts** (replaces standard 1 pt)
- Does not interact with the Away Day Pick multiplier — treated as the base score for that match.

#### Underdog Determination (two-signal approach)
1. **Primary:** Odds API — if implied win probability < 35%, team is flagged as underdog.
2. **Fallback (if odds unavailable):** League table position — underdog is the team sitting
   5+ places below their opponent.
- Underdog designation is **locked 12 hours before kickoff**.
- Stored on the fixture record. Not surfaced as raw odds in the UI.

### 5.4 Complete Formula Reference

```
Base score:         3 (exact) | 1 (result) | 0 (wrong)
Away Day Pick:      base × 2  (if away team wins; else no change)
Out on the Town:    base × 3  (replaces 2× for Away Day Pick gameweek)
Underdog Boost:     5 (exact) | 3 (result) — replaces base score only
Double Down:        gameweekTotal × 2 (applied last, after all other multipliers)

Example (all active, exact score on Away Day Pick match):
  Base:             3 pts
  + Out on the Town: 3 × 3 = 9 pts
  + Double Down:    9 × 2 = 18 pts from that one match
  Full GW total 20 pts with Double Down: 40 pts
```

---

## 6. Real-Time Infrastructure Rules

- **Polling loop:** Every 60 seconds during active match windows.
  - Active window = 45 min before first kickoff → 15 min after final whistle.
  - Outside windows: fixtures sync once per day.
- **API response caching:** Redis, TTL = 55 seconds.
- **Pub/sub:** Score updates written to Redis pub/sub channel, broadcast to clients via WebSocket.
  - SSE is the fallback if WebSocket is unavailable.
- **Canonical store:** PostgreSQL. Frontend reads from DB only — never from Redis directly,
  never from the external API.
- All club names are mapped to nicknames at ingestion time, before writing to PostgreSQL.

---

## 7. AI Recap — Tone & Structure

Generated via OpenAI API after all fixtures in a gameweek are confirmed finished.
Triggered by a BullMQ queue job.

**Voice:** Deadpan football pundit. Has seen everything. Mildly unimpressed by everyone.
**Length:** 2–3 paragraphs.
**Tone:** Banter-heavy, football-literate, specific enough to feel personal.

**Structure:**
1. Opening paragraph: gameweek winner — highlight with appropriate mockery of how they got there.
2. Middle paragraph: worst performer — dissect their most embarrassing prediction in detail.
3. Closing paragraph: season standings movement — dig at whoever has been top too long,
   false hope extended to whoever is propping up the table.

**Hard rules for the system prompt (enforce these):**
- Use ONLY club nicknames. Never use official names.
- Never mention real player names (licensing risk).
- Never reference betting odds directly.
- Never use the phrase "Premier League" — refer to "the top flight" or "the division".
- Keep it under 300 words.
- Reference specific scorelines and predictions — generic recaps are a failure mode.

**Input payload (JSON):**
```json
{
  "gameweek": 14,
  "league_name": "The Usual Suspects",
  "members": [
    {
      "username": "ChrisFromChicago",
      "predictions": [{ "home": "The Citizens", "away": "The Hammers", "predicted": "2-1", "actual": "3-0", "points": 0 }],
      "gameweek_points": 12,
      "season_total": 87,
      "previous_rank": 3,
      "current_rank": 1,
      "away_day_pick": { "team": "The Hammers", "won": false }
    }
  ]
}
```

---

## 8. UI Design System

### Colour Palette

```css
--color-aubergine:    #2D0A31;   /* Primary background, modal sheets */
--color-hot-pink:     #FF2D7A;   /* CTA buttons, down arrows, warning banners */
--color-electric-cyan:#00E5FF;   /* Live score pulse, card flash on goal */
--color-neon-green:   #39FF14;   /* Up arrows, correct prediction indicator, confetti */
--color-white:        #FFFFFF;   /* Body text on dark backgrounds */
--color-gold:         #FFD700;   /* Double Down shimmer effect only */
```

**No official Premier League purple, lion logo, or any trademarked visual assets.**

### Animation Reference

| Trigger | Animation |
|---|---|
| Live score update | Fixture card background flashes electric cyan |
| Exact score confirmed correct | Neon green trophy icon slides across the card |
| Away Day Pick win | Hot pink fireworks burst from Away Day Pick banner |
| Rival overtakes on leaderboard | Notification banner slides down with rival avatar + lightning bolt (hot pink) |
| Leaderboard movement up | Smooth counter, neon green |
| Leaderboard movement down | Smooth counter, hot pink |
| Double Down activation | Gold shimmer sweeps across entire gameweek strip |
| AI recap delivery | Crumpled newspaper unfolding → typewriter effect on aubergine background |
| Correct exact score in banter feed | Confetti animation |

### Component Conventions
- Modals slide up from the bottom on a deep aubergine sheet.
- Team nicknames displayed in **hot pink** at the top of prediction modals.
- User's own row in leaderboard: pinned, highlighted in deep aubergine.
- Active boosts visible to all league members as a small chip icon next to username.
- Boost activation always shows a hot pink confirmation warning banner. Cannot be undone.

---

## 9. Key Edge Cases — Handle These Explicitly

1. **Out on the Town with no Away Day Pick:** No-op. Zero effect. Show a warning if user tries to activate without an active pick.
2. **Double Down + Out on the Town same gameweek:** Out on the Town resolves first (3×), then Double Down applies to full GW total.
3. **Boost #1 expires at GW19:** Hard cutoff. Expired boost slot renders as greyed-out in UI. No grace period.
4. **Away Day Pick lock timing:** Each pick locks at kickoff of the *chosen* fixture, not all fixtures.
5. **Odds API unavailable:** Fall back to league position differential (5+ places). Log the fallback. Do not surface odds data to the user.
6. **Underdog designation lock:** Locked exactly 12 hours before kickoff. Stored on fixture record. Cannot change after lock.
7. **Gameweek with postponed fixtures:** Points are not calculated for postponed matches. Away Day Picks on postponed fixtures are voided and returned for use.
8. **User submits no predictions:** Streak resets. Score is 0. Away Day Pick (if any) is voided.
9. **AI recap generation failure:** Queue job retries 3× with exponential backoff. If all fail, surface a fallback static message in the recap card. Never surface raw error to user.
10. **Multiple league memberships:** Each private league has its own standings. A user's gameweek points are the same across leagues; only rankings differ.

---

## 10. External API References

| API | Purpose | Docs |
|---|---|---|
| API-Football | Fixtures, live scores, standings | https://www.api-football.com |
| SportMonks | Backup fixtures/scores source | https://www.sportmonks.com |
| The Odds API | Pre-match odds for Underdog Boost | https://the-odds-api.com |
| OpenAI API | AI weekly recap generation | https://platform.openai.com |
| Firebase Cloud Messaging | Push notifications | https://firebase.google.com/docs/cloud-messaging |

---

## 11. What Claude Code Should Always Do

- Apply `toNickname()` at every API ingestion point — never let official club names reach the frontend or OpenAI.
- Write tests alongside every scoring function — the boost interaction logic is complex and must be verified.
- Never hardcode API keys or secrets. Reference env vars by name only.
- When generating OpenAI prompts, always include the nickname rule and the word limit.
- When in doubt about scoring edge cases, refer to Section 5 of this file before implementing.
- Keep the data mapping layer (official name → nickname) as a single source of truth in `src/lib/clubNicknames.ts`.

---

*Last updated: 2025 | Version aligned with Matchday PRD v3*
