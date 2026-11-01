// What the browser imports as "@vibepulse/shared" (aliased in vite.config.ts), so the client code is
// the same here and in the Vibe Pulse repo. A game's own exports come from "@vibepulse/shared/games/<id>".
export { createRng, type Rng } from "./rng.ts";
export { SAVE_MAX_BYTES } from "./saves.ts";
export type { GameClientProps, GameDefinition, GameResult, MoveInfo, MoveResult, PlayerId, RoomErrorPayload, RoomPlayer, TurnClock } from "./game.ts";
export type { GameAchievement, SeatOutcome } from "./achievements.ts";
export type { ChallengeId, DailyTask } from "./daily.ts";
export type { TableOption, TableOptions } from "./table-options.ts";
export type { HowTo } from "./howto.ts";
