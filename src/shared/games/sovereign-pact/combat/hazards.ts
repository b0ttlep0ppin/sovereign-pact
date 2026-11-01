// Hazards (§14.8): entities without turns that sit on a cell and trigger on a condition. Barrels, gas
// crates, alarm bells and saws stand on the enemy grid and can be struck; rockfalls and traps lie on the
// party's. Occasional, never common: at most one an Encounter, at the pool's odds.
import type { Rng } from "../../../rng.ts";
import { ENEMIES, fromEnemySide, HAZARD_BY_ID, HAZARDS, POOL_BY_ID, type EnemyDef, type HazardDef } from "../content.ts";
import { TUNING } from "../tuning.ts";
import { spawnAdds } from "./bosses.ts";
import { enemyCombatant } from "./build.ts";
import { strike } from "./damage.ts";
import { isFree, standing, unitsIn } from "./grid.ts";
import { kill } from "./injury.ts";
import { resolveTargets } from "./targets.ts";
import { COLS, ROWS, type AbilityDef, type Battle, type Cell, type Combatant, type FieldHazard } from "./types.ts";

const H = TUNING.encounters.hazards;
const def = (u: Combatant | FieldHazard): HazardDef => HAZARD_BY_ID.get("side" in u ? u.hazard! : u.id)!;

/** A hazard's effect from its own point of view; hazards always find their mark. */
const effect = (h: HazardDef): AbilityDef => ({ ...fromEnemySide(h.effect!), accuracy: H.accuracy });

/** A hazard as a combatant: no turns, no statuses, the HP block × its `hp` (any damage destroys a 0). */
export function hazardCombatant(h: HazardDef, level: number, id: number, col: number, row: number): Combatant {
  const synth: EnemyDef = {
    id: h.id,
    name: h.name,
    pool: "any",
    tags: ["hazard", "construct"],
    role: "fodder",
    size: [1, 1],
    levels: [1, 10],
    stats: { hp: Math.max(0.01, h.hp ?? 0), atk: 1, def: 1, eva: 0, speed: 0 },
    abilities: [],
    gambits: [{ do: "wait" }],
  };
  const u = enemyCombatant(synth, { id, level, col, row });
  if (!h.hp) u.maxHp = u.hp = 1;
  u.hazard = h.id;
  u.mods.noMove = 1;
  return u;
}

/** Middle rows first. */
const MIDDLE_OUT = Array.from({ length: ROWS }, (_, r) => r).sort((x, y) => Math.abs(x + 0.5 - ROWS / 2) - Math.abs(y + 0.5 - ROWS / 2) || x - y);

/** Whether an Encounter in `pool` carries a hazard, and which (by weight, none already met this expedition). */
export function rollHazard(rng: Rng, pool: string, exclude: readonly string[] = []): HazardDef | undefined {
  if (rng.int(100) >= (POOL_BY_ID.get(pool)?.hazardPct ?? 0)) return undefined;
  const can = HAZARDS.filter((h) => h.weight > 0 && !exclude.includes(h.id) && (!h.pools || h.pools.includes(pool)));
  let roll = rng.int(can.reduce((n, h) => n + h.weight, 0) || 1);
  for (const h of can) if ((roll -= h.weight) < 0) return h;
  return undefined;
}

/** Sets a hazard down at the start of a fight: on a free enemy cell, or on the party's grid. */
export function placeHazard(b: Battle, rng: Rng, h: HazardDef, level: number): void {
  if (h.side === "enemy") {
    const spot = (h.cols ?? [0, 1, 2]).flatMap((c) => MIDDLE_OUT.map((r) => [c, r] as const)).find(([c, r]) => isFree(b, "enemy", c, r));
    if (spot) b.units.push(hazardCombatant(h, level, 900 + b.units.length, spot[0], spot[1]));
    return;
  }
  b.field ??= [];
  if (h.trigger.kind === "timer") {
    // A rockfall comes down on the band where most Scions stand, three turns from now, and says so.
    const party = standing(b, "party");
    const row = MIDDLE_OUT.map((r) => ({ r, n: party.filter((u) => Math.abs(u.row - r) <= 1).length })).sort((x, y) => y.n - x.n)[0]!.r;
    b.field.push({ id: h.id, col: 0, row, at: b.tick + (h.trigger.ticks ?? 300) });
    b.events.push({ t: "hazard", hazard: h.id, what: "set", col: 0, row });
    return;
  }
  // A trap lies hidden on a free cell of the Front or Middle.
  const free: Cell[] = [];
  for (let col = 0; col < 2; col++) for (let row = 0; row < ROWS; row++) if (isFree(b, "party", col, row)) free.push({ side: "party", col, row });
  if (!free.length) return;
  const at = rng.pick(free);
  b.field.push({ id: h.id, col: at.col, row: at.row, hidden: h.hidden });
}

/** A field hazard's blow lands from nowhere: a stand-in attacker at the battle's level. */
function fieldStrike(b: Battle, rng: Rng, h: HazardDef, targets: Combatant[]): void {
  const level = Math.max(1, ...b.units.filter((u) => u.side === "enemy").map((u) => u.level));
  const src = hazardCombatant(h, level, 999, 0, 0);
  for (const t of targets) strike(b, rng, src, t, effect(h));
}

/** The barrel goes up: everyone in the 3×3 around it, and the party's Front beside it if it stood on E1. */
function detonate(b: Battle, rng: Rng, u: Combatant): void {
  const cells: Cell[] = [];
  for (let c = u.col - 1; c <= u.col + 1; c++) for (let r = u.row - 1; r <= u.row + 1; r++) if (c >= 0 && c < COLS && r >= 0 && r < ROWS) cells.push({ side: "enemy", col: c, row: r });
  if (u.col === 0) for (let r = u.row - 1; r <= u.row + 1; r++) if (r >= 0 && r < ROWS) cells.push({ side: "party", col: 0, row: r });
  b.events.push({ t: "hazard", hazard: u.hazard!, what: "trigger", col: u.col, row: u.row });
  for (const t of unitsIn(b, cells).filter((x) => x.id !== u.id && !x.dead)) strike(b, rng, u, t, effect(def(u)));
}

/** The bell rings once: fodder of the pool come at E3 as a Reinforcements wave (§14.4), and it falls silent. */
function ring(b: Battle, u: Combatant): void {
  if (u.flags.includes("rung")) return;
  u.flags.push("rung");
  b.events.push({ t: "hazard", hazard: u.hazard!, what: "trigger", col: u.col, row: u.row });
  const fodder = ENEMIES.filter((e) => e.pool === b.pool && e.role === "fodder" && !e.addOnly && e.levels[0] <= u.level && u.level <= e.levels[1]).map((e) => e.id);
  if (fodder.length) spawnAdds(b, u, { spawn: fodder, count: def(u).reinforce ?? 2, at: "E3" });
  kill(b, u);
}

/** After a blow lands on a hazard: a destroyed barrel explodes, a struck bell rings. */
export function hazardStruck(b: Battle, rng: Rng, t: Combatant): void {
  if (!t.hazard) return;
  const h = def(t);
  if (h.trigger.kind === "destroyed" && t.dead && !t.flags.includes("spent")) {
    t.flags.push("spent");
    detonate(b, rng, t);
  }
  if (h.trigger.kind === "struck_or_timer" && !t.dead) ring(b, t);
}

/** Each clock step: crates vent, saws bite the Front of their row, bells ring on their timer, rockfalls fall. */
export function hazardStep(b: Battle, rng: Rng): void {
  for (const u of b.units.filter((x) => x.hazard && !x.dead)) {
    const h = def(u);
    const every = h.trigger.ticks ?? 100;
    if (h.trigger.kind === "struck_or_timer" && b.tick >= every) ring(b, u);
    if (b.tick % every !== 0) continue;
    if (h.trigger.kind === "every") {
      b.events.push({ t: "hazard", hazard: h.id, what: "trigger", col: u.col, row: u.row });
      for (const t of resolveTargets(b, rng, u, effect(h), { side: "party", col: 0, row: u.row })) strike(b, rng, u, t, effect(h));
    }
    if (h.trigger.kind === "front_row") {
      const t = standing(b, "party").find((x) => x.col === 0 && x.row === u.row);
      if (t) strike(b, rng, u, t, effect(h));
    }
  }
  for (const f of [...(b.field ?? [])]) {
    if (f.at === undefined || b.tick < f.at) continue;
    const h = def(f);
    b.field = b.field!.filter((x) => x !== f);
    b.events.push({ t: "hazard", hazard: h.id, what: "trigger", col: f.col, row: f.row });
    fieldStrike(b, rng, h, standing(b, "party").filter((u) => Math.abs(u.row - f.row) <= 1));
  }
}

/** A Scion who moved onto a trap springs it before acting (§14.8). */
export function springTrap(b: Battle, rng: Rng, u: Combatant): void {
  const f = b.field?.find((x) => x.at === undefined && x.col === u.col && x.row === u.row);
  if (!f || u.side !== "party") return;
  b.field = b.field!.filter((x) => x !== f);
  b.events.push({ t: "hazard", hazard: f.id, what: "trigger", col: f.col, row: f.row });
  fieldStrike(b, rng, def(f), [u]);
}

/** Hazards do not hold the field: a fight is won when only they and Parts are left (§14.8). */
export const fights = (u: Combatant): boolean => u.partOf === undefined && u.hazard === undefined;
