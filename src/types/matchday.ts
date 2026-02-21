// Shared frontend types used across all UI components.

export type FixtureStatus = "UPCOMING" | "LIVE" | "FINISHED" | "POSTPONED";
export type BoostType = "DOUBLE_DOWN" | "OUT_ON_THE_TOWN" | "UNDERDOG_BOOST";
export type BoostSlot = 1 | 2;

export interface Fixture {
  id: string;
  homeTeam: string; // nickname — toNickname() applied before reaching here
  awayTeam: string; // nickname
  kickoff: Date;
  status: FixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
  underdogSide: "home" | "away" | null;
}

export interface UserPrediction {
  homeScore: number;
  awayScore: number;
  points?: number; // undefined until fixture finished
}

export interface BoostChipInfo {
  slot: BoostSlot;
  type: BoostType | null; // null = slot unused (user can choose type)
  activated: boolean;
  expired: boolean;
  activatedGameweek?: number;
  activatedFixtureId?: string; // UNDERDOG_BOOST only
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatarUrl?: string;
  gameweekPoints: number;
  seasonTotal: number;
  rank: number;
  previousRank: number;
  activeBoosts: BoostType[]; // boosts visible to all league members
}

export interface GameweekRecapData {
  content: string;
  failed: boolean;
  gameweekNumber: number;
  leagueName: string;
}

export interface BanterEntry {
  id: string;
  username: string;
  avatarUrl?: string;
  homeTeam: string;
  awayTeam: string;
  predicted: string;
  actual: string;
  points: number;
  isExact: boolean;
  timestamp: Date;
}
