// A battle's replay for the battle screen (SPEC §15.5): battles are fought by gambits for now, so the
// screen plays one back. It holds who fought, the events turn by turn, and after each turn the vitals
// of every combatant that changed (HP, MP, TP, Sanity, place, state, Durability, statuses), so the
// screen never has to re-derive the rules. It lives on the state for the Year it was fought in and
// never goes into a save (save.ts drops it).
import { describeEvent } from "./render.ts";
import { simulate, type BattleSummary } from "./sim.ts";
import { LOCATIONS } from "../state.ts";
import type { Battle, BattleEvent, BattleOutcome, Combatant } from "./types.ts";

/** What a combatant is, which does not change in a battle. */
export interface ReplayUnit {
  id: number;
  side: Combatant["side"];
  name: string;
  /** Enemy content id, or the Person and their House for a Scion. */
  enemy?: string;
  person?: number;
  house?: number;
  boss?: boolean;
  /** The summon's content id. */
  summon?: string;
  /** A summon's owner; a Part's body. */
  owner?: number;
  partOf?: number;
  hazard?: string;
  /** A Scion's weapon kind, for the sound of their blows. */
  weapon?: string;
  size: [number, number];
  maxHp: number;
  maxMp: number;
  maxSanity: number;
  /** Durability maxima, Head/Body/Arms/Legs (Scions). */
  maxDur?: number[];
}

/** One combatant's vitals: id, HP, MP, TP, Sanity, col, row, state bits (see `FLAG`), Durability (H/B/A/L) and status ids. */
export type Vitals = [id: number, hp: number, mp: number, tp: number, sanity: number, col: number, row: number, flags: number, dur: number[], statuses: string[]];

export const FLAG = { down: 1, dead: 2, lastStand: 4, charging: 8, fled: 16, defending: 32 } as const;

/** One turn: the events it made, and the vitals that changed by its end. */
export interface ReplayFrame {
  ev: BattleEvent[];
  vit: Vitals[];
}

export interface Replay {
  /** What the battle was: "An Encounter", the boss's name, a Sortie's name. */
  title: string;
  /** The battle's RNG state as it began: with the Year, it tells one battle from another. */
  seed: number;
  pool?: string;
  outcome: BattleOutcome;
  units: ReplayUnit[];
  /** The vitals at the start, then turn by turn. */
  start: Vitals[];
  frames: ReplayFrame[];
}

const flagsOf = (u: Combatant): number =>
  (u.down ? FLAG.down : 0) | (u.dead ? FLAG.dead : 0) | (u.lastStand ? FLAG.lastStand : 0) | (u.charge ? FLAG.charging : 0) | (u.flags.includes("fled") ? FLAG.fled : 0) | (u.defending ? FLAG.defending : 0);

export const vitalsOf = (u: Combatant): Vitals => [
  u.id,
  u.hp,
  u.mp,
  u.tp,
  u.sanity,
  u.col,
  u.row,
  flagsOf(u),
  u.dur ? LOCATIONS.map((l) => (u.broken.includes(l) ? -1 : u.dur![l])) : [],
  u.statuses.map((s) => s.id),
];

export const unitOf = (u: Combatant): ReplayUnit => ({
  id: u.id,
  side: u.side,
  name: u.name,
  ...(u.enemy ? { enemy: u.enemy } : {}),
  ...(u.person !== undefined ? { person: u.person, house: u.house } : {}),
  ...(u.boss ? { boss: true } : {}),
  ...(u.summon ? { summon: u.summon } : {}),
  ...(u.owner !== undefined ? { owner: u.owner } : {}),
  ...(u.partOf !== undefined ? { partOf: u.partOf } : {}),
  ...(u.hazard ? { hazard: u.hazard } : {}),
  ...(u.person !== undefined ? { weapon: u.weapon.kind } : {}),
  size: u.form?.size ?? u.size,
  maxHp: u.maxHp,
  maxMp: u.maxMp,
  maxSanity: u.maxSanity,
  ...(u.maxDur ? { maxDur: LOCATIONS.map((l) => u.maxDur![l]) } : {}),
});

const memo = new WeakMap<Replay, Map<number, string>>();

/** Each combatant's vitals as the replay last showed them, by id (worked out once per copy of the replay). */
function shown(r: Replay): Map<number, string> {
  let last = memo.get(r);
  if (!last) {
    last = new Map();
    for (const v of [...r.start, ...r.frames.flatMap((f) => f.vit)]) last.set(v[0], JSON.stringify(v));
    memo.set(r, last);
  }
  return last;
}

/** A replay begun, for a battle fought turn by turn (fight.ts): frames follow, and `closed` finishes it. */
export function begun(b: Battle, title: string): Replay {
  // The outcome is a placeholder until the end.
  return { title, seed: b.rng, ...(b.pool ? { pool: b.pool } : {}), outcome: "retreat", units: b.units.map(unitOf), start: b.units.map(vitalsOf), frames: [] };
}

/** The turn just played as a frame of `r`: the events after `seen`, and the vitals that changed. Returns the new `seen`. */
export function frame(b: Battle, r: Replay, seen: number): number {
  if (b.events.length === seen) return seen;
  const last = shown(r);
  const vit: Vitals[] = [];
  for (const u of b.units) {
    const v = vitalsOf(u);
    const key = JSON.stringify(v);
    if (last.get(u.id) !== key) vit.push(v);
    last.set(u.id, key);
  }
  r.frames.push({ ev: b.events.slice(seen), vit });
  return b.events.length;
}

/** The replay's ending: everyone who fought (summons too) and how it went. */
export function closed(b: Battle, r: Replay): Replay {
  r.units = b.units.map(unitOf);
  r.outcome = b.outcome!;
  return r;
}

/** Plays `b` to its end by gambits, as `simulate` does, and records it. */
export function recorded(b: Battle, title: string): { summary: BattleSummary; replay: Replay } {
  const last = new Map<number, string>();
  const changed = (): Vitals[] => {
    const out: Vitals[] = [];
    for (const u of b.units) {
      const v = vitalsOf(u);
      const key = JSON.stringify(v);
      if (last.get(u.id) !== key) out.push(v);
      last.set(u.id, key);
    }
    return out;
  };
  const start = changed();
  const seed = b.rng;
  const frames: ReplayFrame[] = [];
  let seen = b.events.length;
  const summary = simulate(b, undefined, false, () => {
    frames.push({ ev: b.events.slice(seen), vit: changed() });
    seen = b.events.length;
  });
  if (b.events.length > seen) frames.push({ ev: b.events.slice(seen), vit: changed() });
  return { summary, replay: { title, seed, ...(b.pool ? { pool: b.pool } : {}), outcome: b.outcome!, units: b.units.map(unitOf), start, frames } };
}

/** One event as a line of the battle log, by name (no grid tags). */
export function replayLine(r: Replay, e: BattleEvent): string {
  const b = { units: r.units } as unknown as Battle;
  return describeEvent(b, e).replace(/ \([PE]\d+\)/g, "");
}
