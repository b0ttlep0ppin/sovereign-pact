// Death's door (§11): a d20 plus steps on the location's table (or the Sanity table), the result's
// effects in battle, and the Resilience check that may steel a Broken location (§7.4).
import type { Rng } from "../../../rng.ts";
import { INJURY_TABLE_BY_ID, type InjuryResult, type InjuryTableId } from "../content.ts";
import type { Location } from "../state.ts";
import { TUNING } from "../tuning.ts";
import { addStatus, endSongs, removeStatus } from "./status.ts";
import type { Battle, Combatant } from "./types.ts";

/** The result a final roll lands on: the first row whose `max` reaches it. */
export function resultFor(table: InjuryTableId, total: number): InjuryResult {
  const rows = INJURY_TABLE_BY_ID.get(table)!.results;
  return rows.find((r) => total <= r.max) ?? rows.at(-1)!;
}

/** Steps a combatant brings to every roll on this table: Resilience (Sagacity and half Resilience for Sanity) and its own. */
export function baseSteps(u: Combatant, table: InjuryTableId): number {
  const per = TUNING.combat.injury.resiliencePerStep;
  const stat = table === "sanity" ? u.sagacity + u.resilience / 2 : u.resilience;
  // Unstoppable: every roll; Iron Will: every roll while badly hurt (§12.12).
  const hurt = u.hp < (u.maxHp * TUNING.combat.jobs.lowHpBelow) / 100 ? (u.mods.lowHpSteps ?? 0) : 0;
  return Math.floor(stat / per) + u.steps + (u.mods[`${table}Steps`] ?? 0) + (u.mods.injurySteps ?? 0) + hurt;
}

export interface Roll {
  roll: number;
  total: number;
  result: InjuryResult;
}

/** Rolls d20 + steps × 2 on a table. */
export function roll(rng: Rng, table: InjuryTableId, steps: number): Roll {
  const d20 = 1 + rng.int(20);
  const total = d20 + steps * TUNING.combat.injury.step;
  return { roll: d20, total, result: resultFor(table, total) };
}

const pct = (n: number, p: number) => Math.round((n * p) / 100);

/**
 * Rolls on `table` for `u` with extra `steps` (the trigger's: HP 0, Broken, telegraph…), applies the
 * result in battle, and records it on the combatant. Returns the result.
 */
export function injure(b: Battle, rng: Rng, u: Combatant, table: InjuryTableId, steps: number): InjuryResult {
  const r = roll(rng, table, baseSteps(u, table) + steps);
  b.events.push({ t: "injury", target: u.id, table, roll: r.roll, total: r.total, result: r.result.id });
  u.injuries.push(r.result.id);
  apply(b, u, r.result, table);
  return r.result;
}

function apply(b: Battle, u: Combatant, res: InjuryResult, table: InjuryTableId): void {
  if (res.death) {
    // Deathless (Ravager mastery): once a battle, Death becomes a Mortal wound.
    if (!u.mods.deathless || u.flags.includes("deathless_used")) return kill(b, u);
    u.flags.push("deathless_used");
    res = { ...res, death: undefined, mortal: true };
  }
  if (res.mortal) {
    // They know. They fight anyway (§11.4): up again if they fell, immune to further rolls, dying at the end.
    u.lastStand = true;
    if (u.down) {
      u.down = false;
      u.hp = Math.max(1, u.hp);
    }
  }
  if (res.catatonic) {
    u.catatonic = true;
    down(b, u);
  }
  for (const s of res.statuses ?? []) {
    addStatus(b, u, s.id, s.ticks, s.id === "bleed" && table !== "sanity" ? { loc: table } : undefined);
  }
  if (res.tpSet !== undefined) u.tp = res.tpSet;
  if (res.tp) u.tp = Math.max(0, Math.min(TUNING.combat.tp.max, u.tp + res.tp));
  if (res.hpPct && !u.down) u.hp = Math.min(u.maxHp, u.hp + pct(u.maxHp, res.hpPct));
  if (res.sanity) u.sanity = Math.max(0, u.sanity + res.sanity);
  if (res.sanityTo !== undefined) {
    u.sanity = Math.max(u.sanity, pct(u.maxSanity, res.sanityTo));
    u.sanityBroken = false;
  }
  if (res.durabilityTo !== undefined && table !== "sanity" && u.dur && u.maxDur) {
    u.dur[table] = Math.max(u.dur[table], pct(u.maxDur[table], res.durabilityTo));
    u.broken = u.broken.filter((l) => l !== table);
  }
  for (const flag of res.flags ?? []) u.flags.push(flag);
  for (const [k, v] of Object.entries({ ...res.battle, ...res.expedition, ...res.lasting?.mods })) u.mods[k] = (u.mods[k] ?? 0) + v;
}

/** Down at 0 HP (§10.9); a Last Stand Scion cannot be Downed, and dies instead (they were going to). */
export function down(b: Battle, u: Combatant): void {
  if (u.dead || u.down) return;
  if (u.side === "enemy" || u.owner !== undefined) return kill(b, u);
  if (u.lastStand && !u.catatonic) return kill(b, u);
  u.down = true;
  u.hp = 0;
  u.tp = 0;
  delete u.charge;
  u.defending = false;
  if (u.songs) endSongs(b, u);
  // Hungry weapons lose what they fed on (§13.4).
  if (u.mods.hungry && !u.flags.includes("hungry_lost")) u.flags.push("hungry_lost");
  b.events.push({ t: "down", target: u.id });
}

export function kill(b: Battle, u: Combatant): void {
  if (u.dead) return;
  u.dead = true;
  u.down = false;
  u.hp = 0;
  delete u.charge;
  if (u.songs) endSongs(b, u);
  // Auras it held end with it; the last of a summon's call frees the Conjurer's binding (§12.15).
  for (const o of b.units) for (const s of o.statuses.filter((x) => x.src === u.id)) removeStatus(b, o, s.id);
  if (u.owner !== undefined && !b.units.some((o) => o.binding === u.binding && o.id !== u.id && !o.dead)) {
    const owner = b.units.find((o) => o.id === u.owner);
    if (owner?.mods.bound) owner.mods.bound--;
  }
  b.events.push({ t: "dead", target: u.id });
}

/** After a location roll: 2 × Resilience % (capped) to refill to 25%, else the location stays Broken (§7.4). */
export function steel(b: Battle, rng: Rng, u: Combatant, loc: Location): void {
  if (u.dead || !u.dur || !u.maxDur) return;
  const s = TUNING.combat.steel;
  if (rng.int(100) < Math.min(s.cap, s.perPoint * u.resilience)) {
    u.dur[loc] = Math.max(u.dur[loc], pct(u.maxDur[loc], s.refill));
    u.broken = u.broken.filter((l) => l !== loc);
    b.events.push({ t: "steeled", target: u.id, loc });
  } else if (!u.broken.includes(loc) && u.dur[loc] <= 0) u.broken.push(loc);
}

/** The same check for Sanity, on Sagacity (§7.4). */
export function steelSanity(b: Battle, rng: Rng, u: Combatant): void {
  if (u.dead) return;
  const s = TUNING.combat.steel;
  if (rng.int(100) < Math.min(s.cap, s.perPoint * u.sagacity)) {
    u.sanity = Math.max(u.sanity, pct(u.maxSanity, s.refill));
    u.sanityBroken = false;
    b.events.push({ t: "steeled", target: u.id, loc: "sanity" });
  } else u.sanityBroken = u.sanity <= 0;
}
