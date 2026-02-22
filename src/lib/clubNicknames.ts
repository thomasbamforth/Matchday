// SINGLE SOURCE OF TRUTH for club nickname mapping.
// Apply toNickname() at EVERY point where external API data enters the system.
// Never let official club names reach the frontend or the OpenAI prompt.

export const CLUB_NICKNAMES: Record<string, string> = {
  Arsenal:        "The Gunners",
  "Aston Villa":  "The Villans",
  Bournemouth:    "The Cherries",
  Brentford:      "The Bees",
  Brighton:       "The Seagulls",
  Chelsea:        "The Blues",
  "Crystal Palace": "The Eagles",
  Everton:        "The Toffees",
  Fulham:         "The Cottagers",
  Ipswich:        "The Tractor Boys",
  Leicester:      "The Foxes",
  Liverpool:      "The Reds",
  "Manchester City":    "The Citizens",
  "Manchester United":  "The Red Devils",
  Newcastle:            "The Magpies",
  "Nottingham Forest":  "The Tricky Trees",
  Southampton:          "The Saints",
  Tottenham:            "The Lilywhites",
  "West Ham":     "The Hammers",
  Wolves:         "The Wanderers",
};

/**
 * Maps an official club name from an external API to its fan nickname.
 * Falls back to the original string if no mapping exists (logs a warning in dev).
 */
export function toNickname(officialName: string): string {
  const nickname = CLUB_NICKNAMES[officialName];
  if (!nickname && process.env.NODE_ENV !== "production") {
    console.warn(`[clubNicknames] No nickname mapping for: "${officialName}"`);
  }
  return nickname ?? officialName;
}
