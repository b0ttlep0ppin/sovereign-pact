// Making combatants: a Scion from a Person with the §7.3 formulas in their Job (§12.3), an enemy from
// its content at an expedition level with the §14.2 block, and a battle from both sides. Gear arrives
// as the `weapon` and `armor` arguments until items exist.
import { ENEMY_BY_ID, fromEnemySide, INJURY_BY_ID, type EnemyAbility, type EnemyDef } from "../content.ts";
import { jobStat, maxHp, maxMp, maxSanity } from "../formulas.ts";
import { UNARMED, type GearTotals } from "../items.ts";
import { battleActives, freePassives, passiveMods } from "../progression.ts";
import { ELEMENTS, LOCATIONS, type Location, type Person } from "../state.ts";
import { TUNING } from "../tuning.ts";
import { meta } from "./status.ts";
import type { AbilityDef, Battle, Combatant, GambitRule, Weapon } from "./types.ts";

const F = TUNING.formulas;
const C = TUNING.combat;

export { UNARMED };

export interface ScionOpts {
  id: number;
  col: number;
  row: number;
  weapon?: Weapon;
  abilities?: AbilityDef[];
  gambits?: GambitRule[];
  /** Worn armor, summed over slots (§13.3), when not built from items. */
  armor?: Armor;
  /** The Scion's worn items added up (items.ts `gearTotals`): weapon, armor, staff bonuses. */
  gear?: GearTotals;
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

/** Mods the Person carries into battle: lasting injuries (§11: maxHpPct, mightPct, speed…) and free passives (§12.1). */
function carriedMods(p: Person): Record<string, number> {
  const mods: Record<string, number> = {};
  const add = (m: Record<string, number> | undefined) => {
    for (const [k, v] of Object.entries(m ?? {})) mods[k] = (mods[k] ?? 0) + v;
  };
  for (const inj of p.injuries) {
    const res = INJURY_BY_ID.get(inj.id);
    add(res?.lasting?.mods);
    add(res?.stat);
  }
  for (const passive of freePassives(p)) add(passive.mods);
  for (const m of passiveMods(p)) add(m);
  return mods;
}

const pctMod = (n: number, mods: Record<string, number>, key: string) => Math.max(1, Math.floor(n * (1 + (mods[key] ?? 0) / 100)));

export function scionCombatant(p: Person, opts: ScionOpts): Combatant {
  const o: ScionOpts = opts.gear ? { ...opts, weapon: opts.weapon ?? opts.gear.weapon, armor: opts.armor ?? opts.gear } : opts;
  const mods = carriedMods(p);
  let weapon = o.weapon ?? UNARMED;
  // Iron Fists and Counterpunch: a Pugilist's bare hands (§12.10).
  const bare = weapon.kind === "unarmed";
  if (bare && mods.ironFists) weapon = { ...weapon, power: Math.max(weapon.power, mods.ironFists * p.level) };
  for (const [k, v] of Object.entries(o.gear?.mods ?? {})) mods[k] = (mods[k] ?? 0) + v;
  if (o.gear?.spellPct) mods.spellPct = (mods.spellPct ?? 0) + o.gear.spellPct;
  const s = (k: Parameters<typeof jobStat>[1]) => pctMod(jobStat(p, k) + (mods[`${k}Flat`] ?? 0), mods, `${k}Pct`);
  const might = s("might"), resilience = s("resilience"), guile = s("guile"), acuity = s("acuity"), sagacity = s("sagacity");
  const hp = pctMod(maxHp(p), mods, "maxHpPct");
  const dur = {} as Record<Location, number>;
  const stats = { might, resilience, guile, acuity, sagacity };
  for (const loc of LOCATIONS) {
    const d = F.durability[loc];
    const raw = Math.floor((d.base + d.per * stats[d.stat as keyof typeof stats] + F.durabilityPerLevel * p.level) * (1 + (o.armor?.durabilityPct?.[loc] ?? 0) / 100));
    dur[loc] = pctMod(raw, mods, `${loc}DurabilityPct`);
  }
  const mp = Math.floor(maxMp(p) * (1 + (o.gear?.mpPct ?? 0) / 100));
  const sanity = pctMod(maxSanity(p), mods, "maxSanityPct");
  // Warded and Exposed shift the element's affinity (§7.3: +50 takes half).
  const affinity: Combatant["affinity"] = { ...p.aff };
  for (const el of ELEMENTS) if (mods[`ward.${el}`]) affinity[el] = (affinity[el] ?? 0) + mods[`ward.${el}`]!;
  const statuses = freePassives(p).flatMap((x) => (x.start ?? []).map((id) => ({ id, ticks: meta(id).ticks })));
  if (mods.markedStart) statuses.push({ id: "marked", ticks: meta("marked").ticks });
  // Thick Skin and the like: `start.<status>` passives (§12.14).
  for (const k of Object.keys(mods)) if (k.startsWith("start.") && !statuses.some((s) => s.id === k.slice(6))) statuses.push({ id: k.slice(6), ticks: meta(k.slice(6)).ticks });
  return {
    id: o.id,
    side: "party",
    name: p.name,
    person: p.id,
    house: p.house,
    tags: [],
    col: o.col,
    row: o.row,
    size: [1, 1],
    level: p.level,
    ...stats,
    speed: jobStat(p, "speed"),
    maxHp: hp,
    hp,
    maxMp: mp,
    mp: Math.min(mp, p.mp),
    tp: Math.min(C.tp.max, mods.tpStart ?? 0),
    maxSanity: sanity,
    sanity: Math.max(0, Math.min(sanity, p.sanity + (mods.sanityStart ?? 0))),
    evasion: Math.max(0, Math.floor(F.evasion.base + F.evasion.guile * guile + (o.armor?.evasion ?? 0))),
    accuracy: Math.floor(F.accuracy.guile * guile),
    defense: o.armor?.defense ?? 0,
    weapon,
    offhand: o.gear?.offhand,
    dur,
    maxDur: { ...dur },
    broken: [],
    affinity,
    resist: {
      physical: Math.floor(F.resist.physical * resilience) + (mods["resist.physical"] ?? 0),
      mental: Math.floor(F.resist.mental * acuity) + (mods.mentalResist ?? 0) + (mods["resist.mental"] ?? 0),
    },
    immune: [],
    sanityTouch: 0,
    guard: (o.armor?.guard ?? 0) + (mods.guard ?? 0),
    counter: (mods.counter ?? 0) + (bare ? (mods.unarmedCounter ?? 0) : 0),
    steps: 0,
    abilities: o.abilities ?? battleActives(p),
    gambits: o.gambits ?? [],
    cooldowns: {},
    ct: o.ct ?? 0,
    statuses,
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
export const enemyAbility: (a: EnemyAbility) => AbilityDef = fromEnemySide;

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
