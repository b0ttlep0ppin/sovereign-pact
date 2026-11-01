// Achievement shape, matching Vibe Pulse's (its shared/src/achievements.ts), so the game's list carries over unchanged.

/** One seat as Vibe Pulse's match record keeps it. */
export interface MatchRecordPlayer {
  seat: number;
  kind: "user" | "guest" | "bot";
  userId: string | null;
  name: string;
  team: number | null;
  placement: number | null;
  won: boolean;
  score: number | null;
}

/** One seat's finished match, as a game's achievements and daily tasks see it. */
export interface SeatOutcome<State> {
  /** The game's last state. */
  state: State;
  /** The seat's index, in the match record and in the game's own seat order. */
  seat: number;
  won: boolean;
  players: readonly MatchRecordPlayer[];
}

export interface GameAchievement<State> {
  /** Unique within the game, kebab-case. Unlocks are stored by it, so it never changes once shipped. */
  key: string;
  name: string;
  description: string;
  rarity: "easy" | "skill" | "rare";
  earned(outcome: SeatOutcome<State>): boolean;
}
