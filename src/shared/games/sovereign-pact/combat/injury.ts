// Death's door (§11): a d20 plus steps on the location's table (or the Sanity table), the result's
// effects in battle, and the Resilience check that may steel a Broken location (§7.4).
import type { Rng } from "../../../rng.ts";
import { INJURY_BY_ID, INJURY_TABLE_BY_ID, type InjuryResult, type InjuryTableId } from "../content.ts";
import type { Location } from "../state.ts";
import { TUNING } from "../tuning.ts";
import { partBroken } from "./enemyparts.ts";
import { spendItem } from "./items.ts";
import { hasStatus } from "./grid.ts";
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
  // Grizzled (§12.5): a step per 20 Might on the body's tables.
  const grizzled = table !== "sanity" && u.mods.grizzled ? Math.floor(u.might / TUNING.combat.soldier.grizzledPer) : 0;
  return Math.floor(stat / per) + u.steps + (u.mods[`${table}Steps`] ?? 0) + (u.mods.injurySteps ?? 0) + hurt + grizzled;
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

/** What the party satchel holds, and spending one from it, for the carried items that change a roll. */
export interface Carried {
  has: (id: string) => boolean;
  spend: (id: string) => void;
}

/**
 * A roll with what is carried (§13.7): the Dice of the Marches rerolls a low die, seen before the table
 * is; the Saint's Tooth turns a Mortal wound into a severed arm. Each is spent when it works.
 */
export function carriedRoll(rng: Rng, table: InjuryTableId, steps: number, c?: Carried): Roll & { table: InjuryTableId; rerolled?: number; tooth?: true } {
  let r: Roll & { table: InjuryTableId; rerolled?: number; tooth?: true } = { ...roll(rng, table, steps), table };
  if (c?.has("dice_of_the_marches") && r.roll <= TUNING.consumables.uses.diceRerollAt) {
    c.spend("dice_of_the_marches");
    r = { ...roll(rng, table, steps), table, rerolled: r.roll };
  }
  if (r.result.mortal && c?.has("saints_tooth")) {
    c.spend("saints_tooth");
    r = { ...r, table: "arms", result: INJURY_BY_ID.get(TUNING.consumables.uses.toothResult)!, tooth: true };
  }
  return r;
}

/**
 * Rolls on `table` for `u` with extra `steps` (the trigger's: HP 0, Broken, telegraph…), applies the
 * result in battle, and records it on the combatant. Returns the result.
 */
export function injure(b: Battle, rng: Rng, u: Combatant, table: InjuryTableId, steps: number): InjuryResult {
  // A Scion's rolls answer to what the satchel carries.
  const c: Carried | undefined = u.side === "party" && u.person !== undefined && u.owner === undefined ? { has: (id) => !!b.satchel?.includes(id), spend: (id) => spendItem(b, id) } : undefined;
  // Ancestor's Shield (§12.9): this one roll +2 steps.
  const shield = u.flags.indexOf("ancestors_shield");
  if (shield >= 0) {
    u.flags.splice(shield, 1);
    steps += TUNING.combat.soothsayer.shieldSteps;
  }
  let r = carriedRoll(rng, table, baseSteps(u, table) + steps, c);
  // Cheat Death (§12.7): a lucky reroll, the better of the two.
  if (hasStatus(u, "cheat_death") && !r.tooth) {
    const again = carriedRoll(rng, table, baseSteps(u, table) + steps);
    if (again.total > r.total) r = { ...again, rerolled: r.roll };
  }
  let result = r.tooth ? r.result : capped(b, table, r.result, r.total);
  // The Last Rite (a Commons project): once in a Scion's life, a killing blow maims instead.
  const rite = table !== "sanity" && (result.death || result.mortal) && !!u.mods.lastRite && !u.flags.includes("last_rite");
  if (rite) {
    u.flags.push("last_rite");
    result = INJURY_BY_ID.get(TUNING.consumables.uses.toothResult)!;
    r = { ...r, table: "arms" };
  }
  b.events.push({ t: "injury", target: u.id, table: r.table, roll: r.roll, total: r.total, result: result.id, ...(r.rerolled ? { rerolled: r.rerolled } : {}), ...(r.tooth ? { tooth: true as const } : {}), ...(rite ? { rite: true as const } : {}) });
  u.injuries.push(result.id);
  apply(b, u, result, r.table);
  return result;
}

const BANDS = ["devastating", "moderate", "mild", "shrug"] as const;

/** Under a cap, a worse result becomes the first result of the table, at or above the roll, that the cap allows. */
function capped(b: Battle, table: InjuryTableId, res: InjuryResult, total: number): InjuryResult {
  if (!b.injuryCap || BANDS.indexOf(res.band) >= BANDS.indexOf(b.injuryCap)) return res;
  const ok = (x: InjuryResult) => BANDS.indexOf(x.band) >= BANDS.indexOf(b.injuryCap!);
  const rows = INJURY_TABLE_BY_ID.get(table)!.results;
  return rows.find((x) => ok(x) && x.max >= total) ?? rows.find(ok) ?? res;
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
  // A Part's loss reaches its body; a body's death takes its Parts with it (§14.1).
  if (u.partOf !== undefined) partBroken(b, u);
  for (const p of b.units) if (p.partOf === u.id && !p.dead) kill(b, p);
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
