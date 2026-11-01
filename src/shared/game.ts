// The game interface The Sovereign Pact implements, matching Vibe Pulse's GameDefinition (its
// shared/src/game.ts) field for field, so the game can move into the Vibe Pulse repo unchanged. Here the
// standalone host (src/client/App.tsx) runs it in the browser; on Vibe Pulse the room server does.
// Copied from Hardpoint Contract's shim (b0ttlep0ppin/hardpoint-contracts), which follows the same model.
import type { GameAchievement } from "./achievements.ts";
import type { ChallengeId, DailyTask } from "./daily.ts";
import type { Rng } from "./rng.ts";
import type { TableOption, TableOptions } from "./table-options.ts";

export type PlayerId = string;

/** What a game may add about one player to its result. */
export interface SeatResult {
  placement?: number;
  score?: number;
  team?: number;
}

/** How a finished game ended. Co-op games where everyone loses report `win` with no winners. */
export type GameResult = ({ kind: "win"; winners: PlayerId[] } | { kind: "draw" }) & {
  seats?: Record<PlayerId, SeatResult>;
  /** Added by the Vibe Pulse room server from `describeResult`; games never set it themselves. */
  headline?: string;
};

export type MoveResult<State> = { ok: true; state: State } | { ok: false; error: string };

/** What the server knows about a move beyond the move itself. Turn-based games ignore it. */
export interface MoveInfo {
  lagMs: number;
}

/** What each player picked in the lobby, by id. */
export type LobbyPicks = Readonly<Partial<Record<PlayerId, string>>>;

export interface LobbyOption {
  id: string;
  name: string;
  blurb: string;
  unlock?: string;
}

export interface LobbyChoice {
  label: string;
  options: readonly LobbyOption[];
}

/** Vibe Pulse's GameDefinition (realtime games' `realtime`/`tick` and leaderboard `records` aren't used here). */
export interface GameDefinition<State, Move, View, Save extends object = object> {
  id: string;
  options?: readonly TableOption[];
  lobbyChoice?: LobbyChoice;
  /** `save` is something `checkpoint` returned, maybe from an older version: check it, and never throw for a bad one. */
  setup(players: readonly PlayerId[], rng: Rng, picks?: LobbyPicks, options?: TableOptions, save?: unknown): State;
  applyMove(state: State, playerId: PlayerId, move: Move, info?: MoveInfo): MoveResult<State>;
  activePlayers(state: State): PlayerId[];
  result(state: State): GameResult | null;
  /** One line about how a finished game ended, shown in place of who won. */
  describeResult?(state: State): string | null;
  view(state: State, playerId: PlayerId): View;
  botMove?(state: State, playerId: PlayerId, rng: Rng): Move;
  /**
   * The move `type`s a seated person may send while it isn't their turn, like taking back a sealed Year.
   * Vibe Pulse hands such a move to `applyMove` even though `activePlayers` doesn't list them.
   */
  passiveMoves?(state: State, playerId: PlayerId): readonly string[];
  /** The move made for a person whose turn ran out at a public table. */
  timeoutMove?(state: State, playerId: PlayerId): Move;
  canReplaceBot?(state: State): boolean;
  /** 6 to 12 achievements. */
  achievements?: readonly GameAchievement<State>[];
  /** Tasks the daily challenge can set in this game. */
  dailyTasks?: readonly DailyTask<State>[];
  /** The save to keep at a checkpoint (plain JSON, at most SAVE_MAX_BYTES, versioned, no player ids), else null. */
  checkpoint?(state: State): Save | null;
  /** One line for the Continue button. */
  describeSave?(save: Save): string;
}


export interface RoomPlayer {
  id: PlayerId;
  name: string;
  ready: boolean;
  bot: boolean;
  connected: boolean;
  wins: number;
  pick?: string;
}

export interface RoomErrorPayload {
  code: string;
  message: string;
}

/** The turn clock at a public table: how long a turn is, and when each one runs out (epoch ms). */
export interface TurnClock {
  seconds: number;
  endsAt: Partial<Record<PlayerId, number>>;
}

export interface GameClientProps<View, Move> {
  view: View;
  me: PlayerId;
  players: RoomPlayer[];
  isMyTurn: boolean;
  sendMove(move: Move): void;
  lastError: RoomErrorPayload | null;
  daily?: ChallengeId | null;
  turnClock?: TurnClock | null;
}
