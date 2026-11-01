// The Conjurer's summons (§12.2, §12.15): entities on the party's cells with their own CT, HP and
// abilities, bound to the Conjurer up to a cap, leaving when their time runs out or the battle ends.
import type { Rng } from "../../../rng.ts";
import { SUMMON_BY_ID, type SummonDef } from "../content.ts";
import { TUNING } from "../tuning.ts";
import { hpCap, spellBase, strike } from "./damage.ts";
import { isFree } from "./grid.ts";
import { kill } from "./injury.ts";
import { addStatus, meta } from "./status.ts";
import { resolveTargets } from "./targets.ts";
import { ROWS, type AbilityDef, type Battle, type Cell, type Combatant } from "./types.ts";

const S = TUNING.combat.summons;

/** How many summons `u` may hold at once: 2, +1 with Legion (§12.3). */
export const bindingCap = (u: Combatant): number => S.cap + (u.mods.bindingCap ?? 0);

/** Whether `u` holds as many summons as it may. */
export const atCap = (u: Combatant): boolean => (u.mods.bound ?? 0) >= bindingCap(u);

/** Where the next of a summon would stand: the cell asked for if it fits, else the nearest free row in its column. */
function cellFor(b: Battle, u: Combatant, def: SummonDef, at?: Cell): { col: number; row: number } | undefined {
  const cols = def.place === "front" ? [0] : def.place === "back" ? [2] : [u.col, ...[0, 1, 2].filter((c) => c !== u.col)];
  if (at && at.side === u.side && cols.includes(at.col) && isFree(b, u.side, at.col, at.row, def.size)) return at;
  const rows = Array.from({ length: ROWS }, (_, r) => r).sort((x, y) => Math.abs(x - u.row) - Math.abs(y - u.row) || x - y);
  for (const col of cols) for (const row of rows) if (isFree(b, u.side, col, row, def.size)) return { col, row };
  return undefined;
}

/** Whether there is room for at least one of a summon. */
export const hasRoom = (b: Battle, u: Combatant, id: string): boolean => !!cellFor(b, u, SUMMON_BY_ID.get(id)!);

function summonCombatant(b: Battle, u: Combatant, def: SummonDef, id: number, col: number, row: number): Combatant {
  // Field Engineer: sturdier constructs that act sooner.
  const construct = def.tags.includes("construct");
  const hp = Math.max(1, Math.round(((u.maxHp * def.hp) / 100) * (construct ? 1 + (u.mods.constructHpPct ?? 0) / 100 : 1)));
  const ticks = def.ticks ? def.ticks + (u.mods.summonTicks ?? 0) : 0;
  return {
    id,
    side: u.side,
    name: def.name,
    owner: u.id,
    summon: def.id,
    binding: id,
    expires: ticks ? b.tick + ticks : undefined,
    onDeath: def.onDeath,
    house: u.house,
    tags: ["summon", ...def.tags],
    col,
    row,
    size: [...def.size],
    level: u.level,
    might: 0,
    resilience: u.resilience,
    guile: 0,
    acuity: u.acuity,
    sagacity: u.sagacity,
    speed: Math.max(1, u.speed + def.speed),
    maxHp: hp,
    hp,
    maxMp: 0,
    mp: 0,
    tp: 0,
    maxSanity: 0,
    sanity: 0,
    evasion: def.evasion ?? 0,
    accuracy: 0,
    defense: Math.round(u.defense * (def.defense ?? 1)),
    // Summons hit with the spell power block at the Conjurer's level, scaled by the Conjurer's Acuity.
    weapon: { kind: "natural", power: spellBase(u.level) * def.atk, acc: S.accuracy, crit: 0, reach: "melee", hands: 1 },
    enemyScale: 1 + u.acuity / TUNING.combat.acuityDivisor,
    broken: [],
    affinity: { ...def.affinity },
    resist: { ...u.resist },
    immune: [...(def.immune ?? [])],
    sanityTouch: 0,
    guard: def.guard ?? 0,
    counter: 0,
    steps: 0,
    abilities: def.abilities,
    gambits: def.gambits ?? [],
    cooldowns: {},
    ct: (def.ct ?? 0) + (construct ? (u.mods.constructCt ?? 0) : 0),
    statuses: [],
    down: false,
    dead: false,
    mods: { ...def.mods },
    flags: [],
    turns: 0,
    kills: 0,
    injuries: [],
  };
}

/** Calls `id` for `u`: one binding, `count` bodies, each on a free cell. Returns the new combatants. */
export function summon(b: Battle, u: Combatant, id: string, at?: Cell, count?: number): Combatant[] {
  const def = SUMMON_BY_ID.get(id);
  if (!def) throw new Error(`unknown summon ${id}`);
  const out: Combatant[] = [];
  for (let i = 0; i < (count ?? def.count); i++) {
    const cell = cellFor(b, u, def, i === 0 ? at : undefined);
    if (!cell) break;
    const s = summonCombatant(b, u, def, Math.max(...b.units.map((x) => x.id)) + 1, cell.col, cell.row);
    s.binding = out[0]?.id ?? s.id;
    b.units.push(s);
    out.push(s);
    for (const st of def.start ?? []) addStatus(b, s, st, meta(st).ticks);
  }
  if (!out.length) return out;
  u.mods.bound = (u.mods.bound ?? 0) + 1;
  b.events.push({ t: "summon", unit: u.id, summon: id, ids: out.map((s) => s.id) });
  // The Drowned Choir's dirge: on every enemy while the summon stands (kill() takes it off).
  if (def.aura) for (const e of b.units) if (e.side !== u.side && !e.dead) addStatus(b, e, `${id}_aura`, 0, { src: out[0]!.id, mods: { ...def.aura } });
  return out;
}

/** A summon dying with something to give (the Ember Imp's burst): it lands on the enemy cell across from it. */
export function deathThroes(b: Battle, rng: Rng, u: Combatant): void {
  if (!u.onDeath || u.flags.includes("throes")) return;
  u.flags.push("throes");
  const ab: AbilityDef = u.onDeath;
  const at: Cell = { side: u.side === "party" ? "enemy" : "party", col: 0, row: u.row };
  for (const t of resolveTargets(b, rng, u, ab, at)) if (!t.dead) strike(b, rng, u, t, ab);
}

/** A summon whose time is up leaves the field. */
export function vanish(b: Battle, u: Combatant): void {
  b.events.push({ t: "vanish", unit: u.id });
  kill(b, u);
}

/** Battle-start summons: Familiar's free Carrion Crow (§12.15). */
export function openingSummons(b: Battle): void {
  for (const u of [...b.units]) if (u.mods.familiar && !u.dead && !u.down) summon(b, u, "carrion_crows", undefined, u.mods.familiar);
}

/** Sacrifice (§12.15): the summon is dismissed and allies around it heal. */
export function sacrifice(b: Battle, u: Combatant, s: Combatant, hpPct: number): void {
  if (s.owner !== u.id || s.dead) return;
  const near = b.units.filter((o) => o.side === s.side && o.id !== s.id && !o.dead && !o.down && !o.owner && Math.abs(o.col - s.col) <= 1 && Math.abs(o.row - s.row) <= 1);
  for (const o of near) {
    const amount = Math.max(0, Math.min(hpCap(o) - o.hp, Math.round((o.maxHp * hpPct) / 100)));
    o.hp += amount;
    b.events.push({ t: "heal", unit: u.id, target: o.id, amount });
  }
  vanish(b, s);
}
