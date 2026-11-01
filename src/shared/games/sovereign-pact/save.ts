// Checkpoint saves (§4.4; Vibe Pulse docs/decisions/2026-10-18-saves.md): the state at the start of
// each Settlement Phase, as plain JSON with a version and no player ids, at most 64 KB.
import type { PlayerId } from "../../game.ts";
import { packPeople, unpackPeople, type PackedPeople } from "./codec.ts";
import type { SovState } from "./state.ts";
import { campaignYears, clone, trackName } from "./year.ts";

export const SAVE_VERSION = 1;
export const GAME_ID = "sovereign-pact";

/** The campaign without who sat where or the public log, its people packed (codec.ts). */
export type SavedCampaign = Omit<SovState, "players" | "log" | "people"> & { people: PackedPeople };

export interface SovSave {
  v: typeof SAVE_VERSION;
  game: typeof GAME_ID;
  campaign: SavedCampaign;
}

/** The checkpoint is the Settlement Phase's first state: once anyone moves, it is the last one kept. */
export function checkpoint(s: SovState): SovSave | null {
  if (s.phase !== "settlement" || s.phaseMoves > 0) return null;
  const campaign: Partial<SovState> = clone(s);
  delete campaign.players;
  delete campaign.log;
  delete campaign.people;
  return { v: SAVE_VERSION, game: GAME_ID, campaign: { ...(campaign as Omit<SovState, "players" | "log" | "people">), people: packPeople(s.people) } };
}

export function describeSave(save: SovSave): string {
  const c = save.campaign;
  const names = c.houses.map((h) => h.name);
  const who = names.length === 1 ? `House ${names[0]}` : `Houses ${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return `${who}, Year ${c.year} of ${campaignYears(c)}, ${trackName(c)} ${c.accord}, Doom ${c.doom}`;
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/**
 * The campaign a save holds, seated for `players`, or null when it can't continue here: another
 * version, another game, a broken file, or a different number of Houses than seats. Never throws.
 */
export function restore(save: unknown, players: readonly PlayerId[]): SovState | null {
  try {
    if (!isObject(save) || save.v !== SAVE_VERSION || save.game !== GAME_ID || !isObject(save.campaign)) return null;
    const c = save.campaign;
    if (c.v !== 1 || !Array.isArray(c.houses) || !isObject(c.people) || c.houses.length !== players.length) return null;
    if (typeof c.year !== "number" || typeof c.rng !== "number" || c.phase !== "settlement") return null;
    const saved = clone(c) as unknown as SavedCampaign;
    const state: SovState = { ...saved, people: unpackPeople(saved.people), players: [...players], log: [] };
    state.log.push(`The campaign resumes in Year ${state.year}.`);
    return state;
  } catch {
    return null;
  }
}
