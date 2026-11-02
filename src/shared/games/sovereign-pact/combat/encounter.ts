// Encounter groups (§14.4): an Encounter node draws a template for the level, fills each role from the
// pool's roster (entries whose `levels` span L), places the group on the enemy grid, and may open with
// an Ambush or a Surprise. All seeded.
import { createRng, type Rng } from "../../../rng.ts";
import { ENEMIES, ENEMY_BY_ID, POOL_BY_ID, rosterOf, TEMPLATE_BY_ID, TEMPLATES, VARIANT_BY_ID, HAZARD_BY_ID, type EnemyDef, type TemplateDef, type TemplateRole } from "../content.ts";
import { TUNING } from "../tuning.ts";
import { enemyCombatant, newBattle } from "./build.ts";
import { partsOf } from "./enemyparts.ts";
import { placeHazard, rollHazard } from "./hazards.ts";
import { variantsFor, withVariant } from "./variants.ts";
import { COLS, ROWS, type Battle, type Combatant } from "./types.ts";

const E = TUNING.encounters;
const V = TUNING.encounters.variants;
const Q = TUNING.hunt;

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
  /** Hazards already met this expedition (never two of a kind, §14.8); `false` forbids one. */
  hazards?: readonly string[] | false;
  /** The campaign Year: Unknown-touched variants from Year 10 (§14.10). */
  year?: number;
  /** The Nest stands (§14.7, Year 15 lost): the Outer Dark's fodder and swarms join every pool's. */
  spread?: boolean;
  /** A Hunt's Lair (§14.9): the named quarry leads its kin, a level up with half again its HP. */
  quarry?: { enemy: string; title: string; ability: "enrage" | "ambush" | "call_pack" };
  /** Shifts on the base odds, in points (traits, buildings, the Lantern). */
  ambushPct?: number;
  surprisePct?: number;
  firstId?: number;
}

export interface Encounter {
  template: string;
  modifier?: Modifier;
  hazard?: string;
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
  return ENEMIES.filter((e) => e.pool === pool && !e.addOnly && e.levels[0] <= level && level <= e.levels[1] && !["boss", "colossus", "elite"].includes(e.role));
}

/** Enemies for each role: different entries where the roster allows, before any repeats. */
export function fill(rng: Rng, pool: string, level: number, roles: readonly TemplateRole[], spread = false): EnemyDef[] {
  const left = new Map<string, EnemyDef[]>();
  const [lo, hi] = POOL_BY_ID.get(SPREAD_POOL)!.levels;
  return roles.map((role) => {
    const own = rosterFor(pool, role, level);
    const roster = spread && pool !== SPREAD_POOL && (role === "fodder" || role === "swarm") ? [...own, ...rosterOf(SPREAD_POOL, role, Math.max(lo, Math.min(hi, level)))] : own;
    if (!roster.length) throw new Error(`pool ${pool} has nothing for ${role} at level ${level}`);
    const key = roster.map((e) => e.id).join();
    if (!left.get(key)?.length) left.set(key, [...roster]);
    const bag = left.get(key)!;
    return bag.splice(rng.int(bag.length), 1)[0]!;
  });
}

/** Where the Unknown breed (§14.7). */
const SPREAD_POOL = "outer_dark";

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

/** An enemy to place, optionally as a variant (§14.10). */
export type Placing = EnemyDef | { def: EnemyDef; variant?: string; up?: number };

/** Places the group on the enemy grid, each on the free cells nearest the middle rows of its preferred column. */
export function place(group: readonly Placing[], level: number, firstId = 101): Combatant[] {
  const defs = group.map((g) => ("def" in g ? g.def : g));
  const variants = group.map((g) => ("def" in g ? g.variant : undefined));
  const ups = group.map((g) => ("def" in g ? (g.up ?? 0) : 0));
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
    const v = variants[i];
    const def = v ? withVariant(d, v) : d;
    const body = enemyCombatant(def, { id: firstId + i, level: level + ups[i]! + (v ? (VARIANT_BY_ID.get(v)!.level ?? 0) : 0), col, row });
    if (v) body.variant = v;
    out.push(body, ...partsOf(body, def));
    if (d.parts?.length) body.mods.noMove = 1;
  }
  return out.sort((x, y) => x.id - y.id);
}

/**
 * Each enemy's variant, if any (§14.10): from Year 10 Unknown-touched at its own odds, otherwise the
 * variant odds among those it can wear.
 */
export function rollVariants(rng: Rng, defs: readonly EnemyDef[], year = 1): Placing[] {
  return defs.map((def) => {
    const can = variantsFor(def, year);
    const unknown = can.find((v) => v.family === "unknown");
    if (unknown && rng.int(100) < V.unknownPct) return { def, variant: unknown.id };
    const rest = can.filter((v) => v.family !== "unknown");
    return rest.length && rng.int(100) < V.pct ? { def, variant: rng.pick(rest).id } : def;
  });
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
  // A pool fields its own enemies at the nearest level it has, scaled to the fight's (the Pit at Year 5).
  const [lo, hi] = POOL_BY_ID.get(spec.pool)!.levels;
  const from = Math.max(lo, Math.min(hi, spec.level));
  const q = spec.quarry;
  const roles = [...rolesFor(rng, t, spec.party), ...(q?.ability === "call_pack" ? Q.pack : [])];
  const kin = rollVariants(rng, fill(rng, spec.pool, from, roles, spec.spread), spec.year);
  const first = spec.firstId ?? 101;
  const enemies = place(q ? [{ def: ENEMY_BY_ID.get(q.enemy)!, up: Q.levelUp }, ...kin] : kin, spec.level, first);
  const lead = q ? enemies.find((u) => u.id === first) : undefined;
  if (lead) {
    lead.name = q!.title;
    lead.maxHp = lead.hp = Math.round((lead.maxHp * Q.hpPct) / 100);
    if (q!.ability === "enrage") lead.statuses.push({ id: "enrage", ticks: Q.enrageTicks });
  }
  const modifier = spec.modifier === null ? undefined : q?.ability === "ambush" ? "ambush" : (spec.modifier ?? rollModifier(rng, t, spec));
  applyModifier(enemies, modifier);
  const hazard = spec.hazards === false ? undefined : rollHazard(rng, spec.pool, spec.hazards)?.id;
  return { template: t.id, modifier, hazard, enemies };
}

/** Every enemy id a pool can field at a level, for lints and the simulator. */
export const poolAt = (pool: string, level: number): string[] => ENEMIES.filter((e) => e.pool === pool && !e.addOnly && e.levels[0] <= level && level <= e.levels[1]).map((e) => e.id);

/** A battle against an Encounter: the party and the group, the opening's CT applied to both sides. */
export function encounterBattle(seed: number, party: Combatant[], spec: Omit<EncounterSpec, "party">): { battle: Battle; encounter: Encounter } {
  const rng = createRng(seed ^ 0x5eed);
  const found = encounter(rng, { ...spec, party: party.length, firstId: spec.firstId ?? 101 });
  const units = [...party, ...found.enemies];
  applyModifier(units, found.modifier);
  const battle = { ...newBattle(seed, units), pool: spec.pool };
  if (found.hazard) placeHazard(battle, rng, HAZARD_BY_ID.get(found.hazard)!, spec.level);
  return { battle, encounter: found };
}
