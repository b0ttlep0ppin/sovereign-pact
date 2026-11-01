// Making combatants: a Scion from a Person with the §7.3 formulas, an enemy from its content at an
// expedition level with the §14.2 block, and a battle from both sides. Milestone 2 adds Job
// multipliers, gear and passives; the hooks for them are the `weapon` and `abilities` arguments.
import { ENEMY_BY_ID, INJURY_BY_ID, type EnemyAbility, type EnemyDef } from "../content.ts";
import { maxMp, maxSanity, stat } from "../formulas.ts";
import { LOCATIONS, type Location, type Person } from "../state.ts";
import { TUNING } from "../tuning.ts";
import type { AbilityDef, Battle, Combatant, GambitRule, Weapon } from "./types.ts";

const F = TUNING.formulas;
const C = TUNING.combat;

/** Bare hands, until gear exists (Milestone 2). */
export const UNARMED: Weapon = { kind: "fist", power: 5, acc: 85, crit: 0, reach: "melee", hands: 1 };

export interface ScionOpts {
  id: number;
  col: number;
  row: number;
  weapon?: Weapon;
  abilities?: AbilityDef[];
  gambits?: GambitRule[];
  /** Worn armor, summed over slots (§13.3); gear items replace this in Milestone 2. */
  armor?: Armor;
  /** CT at the start (ambush 0, surprise 50, boss 30; §10.12, §14.6). */
  ct?: number;
}

export interface Armor {
  defense: number;
  /** Durability bonus per location, in %. */
  durabilityPct?: Partial<Record<Location, number>>;
  evasion?: number;
  guard?: number;
}

/** Lasting injury mods the Person carries into battle (§11: maxHpPct, mightPct, speed…). */
function lastingMods(p: Person): Record<string, number> {
  const mods: Record<string, number> = {};
  for (const inj of p.injuries) {
    const res = INJURY_BY_ID.get(inj.id);
    for (const [k, v] of Object.entries({ ...res?.lasting?.mods, ...res?.stat })) mods[k] = (mods[k] ?? 0) + v;
  }
  return mods;
}

const pctMod = (n: number, mods: Record<string, number>, key: string) => Math.max(1, Math.floor(n * (1 + (mods[key] ?? 0) / 100)));

export function scionCombatant(p: Person, o: ScionOpts): Combatant {
  const mods = lastingMods(p);
  const s = (k: Parameters<typeof stat>[1]) => pctMod(stat(p, k), mods, `${k}Pct`);
  const might = s("might"), resilience = s("resilience"), guile = s("guile"), acuity = s("acuity"), sagacity = s("sagacity");
  const hp = pctMod(F.maxHp.base + F.maxHp.might * might + F.maxHp.resilience * resilience + F.maxHp.level * p.level, mods, "maxHpPct");
  const dur = {} as Record<Location, number>;
  const stats = { might, resilience, guile, acuity, sagacity };
  for (const loc of LOCATIONS) {
    const d = F.durability[loc];
    const raw = Math.floor((d.base + d.per * stats[d.stat as keyof typeof stats] + F.durabilityPerLevel * p.level) * (1 + (o.armor?.durabilityPct?.[loc] ?? 0) / 100));
    dur[loc] = pctMod(raw, mods, `${loc}DurabilityPct`);
  }
  const mp = maxMp(p);
  const sanity = maxSanity(p);
  return {
    id: o.id,
    side: "party",
    name: p.name,
    person: p.id,
    tags: [],
    col: o.col,
    row: o.row,
    size: [1, 1],
    level: p.level,
    ...stats,
    speed: stat(p, "speed"),
    maxHp: hp,
    hp,
    maxMp: mp,
    mp: Math.min(mp, p.mp),
    tp: 0,
    maxSanity: sanity,
    sanity: Math.min(sanity, p.sanity),
    evasion: Math.max(0, Math.floor(F.evasion.base + F.evasion.guile * guile + (o.armor?.evasion ?? 0))),
    accuracy: Math.floor(F.accuracy.guile * guile),
    defense: o.armor?.defense ?? 0,
    weapon: o.weapon ?? UNARMED,
    dur,
    maxDur: { ...dur },
    broken: [],
    affinity: { ...p.aff },
    resist: { physical: Math.floor(F.resist.physical * resilience), mental: Math.floor(F.resist.mental * acuity) + (mods.mentalResist ?? 0) },
    immune: [],
    sanityTouch: 0,
    guard: o.armor?.guard ?? 0,
    counter: 0,
    steps: 0,
    abilities: o.abilities ?? [],
    gambits: o.gambits ?? [],
    cooldowns: {},
    ct: o.ct ?? 0,
    statuses: [],
    down: false,
    dead: false,
    mods,
    flags: [],
    turns: 0,
    kills: 0,
    injuries: [],
  };
}

/** a + b·L + c·L² (§14.2). */
const block = (k: keyof typeof TUNING.enemies, level: number) => {
  const [a, b, c] = TUNING.enemies[k] as readonly [number, number, number];
  return a + b * level + c * level * level;
};

/** The enemy's own sides map onto the user's point of view: "player" is its foe. */
export function enemyAbility(a: EnemyAbility): AbilityDef {
  return { ...a, side: a.side === "player" ? "foe" : a.side };
}

export interface EnemyOpts {
  id: number;
  level: number;
  col: number;
  row: number;
  ct?: number;
}

export function enemyCombatant(def: EnemyDef | string, o: EnemyOpts): Combatant {
  const e = typeof def === "string" ? ENEMY_BY_ID.get(def) : def;
  if (!e) throw new Error(`unknown enemy ${String(def)}`);
  const L = o.level;
  const role = TUNING.enemies.roles[e.role];
  const m = { hp: role.hp, atk: role.atk, def: role.def, eva: role.eva, acc: 1, ...e.stats };
  const hp = Math.round(block("hp", L) * m.hp);
  const resist = C.enemyResist.base + C.enemyResist.perLevel * L;
  const melee = e.tags.includes("reach") ? "reach" : "melee";
  return {
    id: o.id,
    side: "enemy",
    name: e.name,
    enemy: e.id,
    role: e.role,
    tags: [...e.tags],
    boss: e.role === "boss" || undefined,
    col: o.col,
    row: o.row,
    size: [...e.size],
    level: L,
    might: 0,
    resilience: 0,
    guile: 0,
    acuity: 0,
    sagacity: 0,
    speed: Math.round(m.speed ?? block("speed", L)),
    maxHp: hp,
    hp,
    maxMp: 0,
    mp: 0,
    tp: 0,
    maxSanity: 0,
    sanity: 0,
    evasion: Math.round(block("evasion", L) * m.eva),
    accuracy: 0,
    defense: Math.round(block("defense", L) * m.def),
    weapon: { kind: "natural", power: block("power", L), acc: Math.round(block("accuracy", L) * m.acc), crit: 0, reach: melee, hands: 1 },
    enemyScale: m.atk * (1 + C.enemyLevelFactor * L),
    broken: [],
    affinity: { ...e.affinity },
    resist: { physical: resist, mental: resist },
    immune: [...(e.immune ?? [])],
    weak: e.weak,
    sanityTouch: m.sanityTouch ?? 0,
    guard: 0,
    counter: 0,
    steps: 0,
    abilities: e.abilities.map(enemyAbility),
    gambits: e.gambits,
    cooldowns: {},
    ct: o.ct ?? 0,
    statuses: [],
    down: false,
    dead: false,
    mods: {},
    flags: [],
    turns: 0,
    kills: 0,
    injuries: [],
  };
}

/** A fresh battle (§10.12): the caller sets starting CT for ambushes, surprises and bosses. */
export function newBattle(seed: number, units: Combatant[]): Battle {
  return { rng: seed >>> 0, tick: 0, units, actor: null, moved: false, acted: false, events: [] };
}
