// Daily challenge task shape, matching Vibe Pulse's (its shared/src/daily.ts).
import type { SeatOutcome } from "./achievements.ts";

export interface DailyTask<State> {
  /** Unique within the game, kebab-case. */
  key: string;
  /** Short, for headings. */
  title: string;
  /** What to do. */
  description: string;
  /** Seats in the match, the player's included; bots take the rest. */
  seats: number;
  done(outcome: SeatOutcome<State>): boolean;
}

/** Names a challenge: the daily one from the free games, or the premium one. */
export type ChallengeId = { kind: "daily" | "premium"; day: string };
