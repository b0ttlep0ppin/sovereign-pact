// Encounter groups (§14.4): an Encounter node draws a template for the level, fills each role from the
// pool's roster (entries whose `levels` span L), places the group on the enemy grid, and may open with
// an Ambush or a Surprise. All seeded.
import { createRng, type Rng } from "../../../rng.ts";
import { ENEMIES, POOL_BY_ID, rosterOf, TEMPLATE_BY_ID, TEMPLATES, type EnemyDef, type TemplateDef, type TemplateRole } from "../content.ts";
import { TUNING } from "../tuning.ts";
import { enemyCombatant, newBattle } from "./build.ts";
import { COLS, ROWS, type Battle, type Combatant } from "./types.ts";

const E = TUNING.encounters;

export type Modifier = "ambush" | "surprise";

export interface EncounterSpec {
  pool: string;
  /** Expedition level, 1–10. */
  level: number;
  /** Scions in the party: up to 4 uses the template's 4-party column, more its 8-party one. */
  party: number;
  /** A template by id; otherwise one is drawn by weight from those allowed at the level. */
  template?: string;
  /** Forces the opening; `null` forbids one. Otherwise it is rolled. */
  modifier?: Modifier | null;
  /** Shifts on the base odds, in points (traits, buildings, the Lantern). */
  ambushPct?: number;
  surprisePct?: number;
  firstId?: number;
}

export interface Encounter {
  template: string;
  modifier?: Modifier;
  enemies: Combatant[];
}

/** Templates allowed at expedition level `level`. */
export const templatesAt = (level: number): TemplateDef[] => TEMPLATES.filter((t) => t.weight > 0 && t.levels[0] <= level && level <= t.levels[1]);

/** One template by weight among those allowed at the level. */
export function drawTemplate(rng: Rng, level: number): TemplateDef {
  const pool = templatesAt(level);
  let roll = rng.int(pool.reduce((n, t) => n + t.weight, 0));
  for (const t of pool) {
    roll -= t.weight;
    if (roll < 0) return t;
  }
  return pool[0]!;
}

/** The template's roles for this party, ranges drawn: one entry per enemy. */
export function rolesFor(rng: Rng, t: TemplateDef, party: number): TemplateRole[] {
  const counts = party > 4 ? t.eight : t.four;
  return Object.entries(counts).flatMap(([role, n]) => {
    const k = Array.isArray(n) ? n[0] + rng.int(n[1] - n[0] + 1) : n;
    return Array<TemplateRole>(k).fill(role as TemplateRole);
  });
}

/** The roster a role draws from at the level, standing in the next role (tuning) where the pool has none. */
export function rosterFor(pool: string, role: TemplateRole, level: number): EnemyDef[] {
  for (const r of [role, ...(E.stand[role] ?? [])]) {
    const found = rosterOf(pool, r as TemplateRole, level);
    if (found.length) return found;
  }
  // Last resort while a pool's roster is thin: anything of the pool at the level but the big ones.
  return ENEMIES.filter((e) => e.pool === pool && e.levels[0] <= level && level <= e.levels[1] && !["boss", "colossus", "elite"].includes(e.role));
}

/** Enemies for each role: different entries where the roster allows, before any repeats. */
export function fill(rng: Rng, pool: string, level: number, roles: readonly TemplateRole[]): EnemyDef[] {
  const left = new Map<string, EnemyDef[]>();
  return roles.map((role) => {
    const roster = rosterFor(pool, role, level);
    if (!roster.length) throw new Error(`pool ${pool} has nothing for ${role} at level ${level}`);
    const key = roster.map((e) => e.id).join();
    if (!left.get(key)?.length) left.set(key, [...roster]);
    const bag = left.get(key)!;
    return bag.splice(rng.int(bag.length), 1)[0]!;
  });
}

/** Columns each role prefers (§14.4): fodder and bruisers on E1, lurkers E1–E2, casters, supports and artillery on E3. */
const COLUMNS: Record<string, number[]> = {
  fodder: [0, 1, 2],
  swarm: [0, 1, 2],
  bruiser: [0, 1, 2],
  elite: [0, 1, 2],
  colossus: [0, 1, 2],
  lurker: [1, 0, 2],
  horror: [1, 2, 0],
  caster: [2, 1, 0],
  support: [2, 1, 0],
  artillery: [2, 1, 0],
  boss: [0, 1, 2],
};

/** Big enemies first (colossi centered), then the front line, then the back. */
const order = (e: EnemyDef) => -e.size[0] * e.size[1] * 10 + (COLUMNS[e.role]?.[0] ?? 0);

/** Places the group on the enemy grid, each on the free cells nearest the middle rows of its preferred column. */
export function place(defs: readonly EnemyDef[], level: number, firstId = 101): Combatant[] {
  const taken = Array.from({ length: COLS }, () => Array<boolean>(ROWS).fill(false));
  const fits = (c: number, r: number, [w, h]: readonly number[]) => {
    if (c + w! > COLS || r + h! > ROWS) return false;
    for (let i = 0; i < w!; i++) for (let j = 0; j < h!; j++) if (taken[c + i]![r + j]) return false;
    return true;
  };
  const sorted = defs.map((d, i) => ({ d, i })).sort((x, y) => order(x.d) - order(y.d) || x.i - y.i);
  const out: Combatant[] = [];
  for (const { d, i } of sorted) {
    const [w, h] = d.size;
    const rows = Array.from({ length: ROWS - h + 1 }, (_, r) => r).sort((x, y) => Math.abs(x + h / 2 - ROWS / 2) - Math.abs(y + h / 2 - ROWS / 2) || x - y);
    const spot = (COLUMNS[d.role] ?? [0, 1, 2]).flatMap((c) => rows.map((r) => [c, r] as const)).find(([c, r]) => fits(c, r, d.size));
    if (!spot) continue;
    const [col, row] = spot;
    for (let a = 0; a < w; a++) for (let b = 0; b < h; b++) taken[col + a]![row + b] = true;
    out.push(enemyCombatant(d, { id: firstId + i, level, col, row }));
  }
  return out.sort((x, y) => x.id - y.id);
}

/** Rolls the opening: Ambush (the template can multiply its odds), Surprise, or neither. */
export function rollModifier(rng: Rng, t: TemplateDef, spec: Pick<EncounterSpec, "ambushPct" | "surprisePct">): Modifier | undefined {
  const ambush = (E.ambushPct + (spec.ambushPct ?? 0)) * (t.ambushMult ?? 1);
  const roll = rng.int(100);
  if (roll < ambush) return "ambush";
  if (roll < ambush + E.surprisePct + (spec.surprisePct ?? 0)) return "surprise";
  return undefined;
}

/**
 * Starting CT for an opening (§10.12, §14.4): ambushed side at 0, the other at 50, and every lurker of
 * an ambushing group a free first turn. Without one, everyone starts at 0.
 */
export function applyModifier(units: Combatant[], mod: Modifier | undefined): void {
  if (!mod) return;
  const ambusher = mod === "ambush" ? "enemy" : "party";
  for (const u of units) {
    u.ct = u.side === ambusher ? E.ct.ambusher : E.ct.ambushed;
    if (mod === "ambush" && u.side === "enemy" && u.role === "lurker") u.ct = E.ct.lurkerAmbush;
  }
}

/** An Encounter node's group (§14.4). */
export function encounter(rng: Rng, spec: EncounterSpec): Encounter {
  if (!POOL_BY_ID.has(spec.pool)) throw new Error(`unknown pool ${spec.pool}`);
  const t = spec.template ? TEMPLATE_BY_ID.get(spec.template) : drawTemplate(rng, spec.level);
  if (!t) throw new Error(`unknown template ${String(spec.template)}`);
  const enemies = place(fill(rng, spec.pool, spec.level, rolesFor(rng, t, spec.party)), spec.level, spec.firstId);
  const modifier = spec.modifier === null ? undefined : (spec.modifier ?? rollModifier(rng, t, spec));
  applyModifier(enemies, modifier);
  return { template: t.id, modifier, enemies };
}

/** Every enemy id a pool can field at a level, for lints and the simulator. */
export const poolAt = (pool: string, level: number): string[] => ENEMIES.filter((e) => e.pool === pool && e.levels[0] <= level && level <= e.levels[1]).map((e) => e.id);

/** A battle against an Encounter: the party and the group, the opening's CT applied to both sides. */
export function encounterBattle(seed: number, party: Combatant[], spec: Omit<EncounterSpec, "party">): { battle: Battle; encounter: Encounter } {
  const rng = createRng(seed ^ 0x5eed);
  const found = encounter(rng, { ...spec, party: party.length, firstId: spec.firstId ?? 101 });
  const units = [...party, ...found.enemies];
  applyModifier(units, found.modifier);
  return { battle: newBattle(seed, units), encounter: found };
}
