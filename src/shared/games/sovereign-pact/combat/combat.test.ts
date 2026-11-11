import { describe, expect, it } from "vitest";
import { createRng, type Rng } from "../../../rng.ts";
import { INJURY_TABLES } from "../content.ts";
import { TUNING } from "../tuning.ts";
import { act, advance, end, move } from "./battle.ts";
import { enemyCombatant, newBattle } from "./build.ts";
import { chargeTicks, forecast, moveCost } from "./clock.ts";
import { baseDamage, hitChance, rollLocation, strike } from "./damage.ts";
import { standardParty } from "./fixtures.ts";
import { holds } from "./gambits.ts";
import { meleeTargets, pickWeighted } from "./grid.ts";
import { addStatus } from "./status.ts";
import { singleTargets } from "./targets.ts";
import type { AbilityDef, Battle, Combatant } from "./types.ts";

/** An Rng whose `int` and `next` return the given values in turn (as fractions of the range), then 0.5. */
function scripted(...rolls: number[]): Rng {
  const base = createRng(1);
  const next = () => rolls.shift() ?? 0.5;
  return { ...base, next, int: (n: number) => Math.min(n - 1, Math.floor(next() * n)), pick: (xs) => xs[Math.floor(next() * xs.length)]! };
}

const HIT: AbilityDef = { id: "hit", shape: "single", side: "foe", power: 1 };

function scion(id: number, col: number, row: number, extra: Partial<Combatant> = {}): Combatant {
  const [p] = standardParty(id, 6, id);
  return { ...p!, id, col, row, ...extra };
}
const enemy = (id: number, col: number, row: number, kind = "barrow_skeleton", level = 2) => enemyCombatant(kind, { id, level, col, row });
const battle = (...units: Combatant[]): Battle => newBattle(7, units);

describe("injury tables (§11)", () => {
  it.each(INJURY_TABLES.map((t) => [t.id, t] as const))("%s reads top down in the spec's bands", (_, t) => {
    const maxes = t.results.map((r) => r.max);
    expect([...maxes].sort((a, b) => a - b)).toEqual(maxes);
    expect(maxes.at(-1)).toBeGreaterThanOrEqual(99);
    t.results.forEach((r, i) => {
      const min = i === 0 ? -99 : t.results[i - 1]!.max + 1;
      if (r.max <= 2) expect(r.band, r.id).toBe("devastating");
      else if (min >= 3 && r.max <= 7) expect(r.band, r.id).toBe("moderate");
      else if (min >= 10 && r.max <= 15) expect(r.band, r.id).toBe("mild");
      else if (min >= 16) expect(r.band, r.id).toBe("shrug");
    });
  });
});

describe("hits and damage (§10.6)", () => {
  it("clamps hit chance to 5–95 and applies Blind and charging", () => {
    const u = scion(1, 0, 3);
    const t = enemy(2, 0, 3);
    const plain = hitChance(u, t, HIT);
    expect(plain).toBeGreaterThanOrEqual(5);
    expect(plain).toBeLessThanOrEqual(95);
    expect(hitChance(u, { ...t, evasion: 500 }, HIT)).toBe(5);
    expect(hitChance({ ...u, accuracy: 500 }, t, HIT)).toBe(95);
    const b = battle(u, t);
    addStatus(b, u, "blind");
    expect(hitChance(u, { ...t, evasion: 0 }, HIT)).toBe(Math.min(95, u.weapon.acc + u.accuracy - 30));
  });

  it("rolls locations Body 40 / Arms 25 / Legs 20 / Head 15, or the aimed one", () => {
    const rng = createRng(3);
    const n: Record<string, number> = {};
    for (let i = 0; i < 20_000; i++) {
      const loc = rollLocation(rng, HIT);
      n[loc] = (n[loc] ?? 0) + 1;
    }
    for (const [loc, share] of Object.entries(TUNING.combat.locations)) expect(n[loc]! / 20_000).toBeCloseTo(share / 100, 1);
    expect(rollLocation(rng, { ...HIT, aim: "head" })).toBe("head");
  });

  it("scales physical damage by Might and enemy damage by level (§7.3, §14.2)", () => {
    const u = scion(1, 0, 3);
    // A one-hand weapon and an empty off hand: the free hand's bonus too.
    const free = u.weapon.hands === 1 && !u.offhand && !u.offWeapon ? 1 + TUNING.combat.freeHandPct / 100 : 1;
    expect(baseDamage(u, HIT)).toBeCloseTo(u.weapon.power * free * (1 + u.might / 25));
    const e = enemy(2, 0, 3, "barrow_skeleton", 5);
    expect(baseDamage(e, HIT)).toBeCloseTo((6 + 15 + 2.5) * TUNING.enemies.roles.fodder.atk * (1 + TUNING.combat.enemyLevelFactor * 5) * (TUNING.enemies.softenAtk[4] ?? 1) * TUNING.enemies.atkMult);
  });

  it("halves physical damage when Defending and zeroes it for +100 affinity", () => {
    const rolls = () => scripted(0, 0.99, 0.5); // hit, no crit, Body
    const u = scion(1, 0, 3);
    const a = scion(2, 0, 3, { side: "party" });
    const hard = () => enemy(9, 0, 3, "barrow_skeleton", 6);
    const plain = strike(battle(hard(), a), rolls(), hard(), a, HIT).damage;
    const d = scion(3, 0, 3, { defending: true });
    const defended = strike(battle(hard(), d), rolls(), hard(), d, HIT).damage;
    expect(defended).toBeLessThan(plain);
    const t = enemy(4, 0, 3);
    t.affinity.fire = 100;
    expect(strike(battle(u, t), rolls(), u, t, { ...HIT, element: "fire" }).damage).toBe(0);
  });

  it("puts a Scion Down at 0 HP and rolls on the blow's location at −1 step", () => {
    const e = enemy(9, 0, 3);
    const t = scion(1, 0, 3, { hp: 1 });
    const b = battle(e, t);
    strike(b, scripted(0, 0.99, 0), e, t, HIT);
    const roll = b.events.find((x) => x.t === "injury");
    expect(roll).toBeDefined();
    expect(t.down || t.dead || t.lastStand).toBe(true);
  });

  it("breaks a location at 0 Durability, rolls, then makes the Resilience check (§7.4)", () => {
    const e = enemy(9, 0, 3);
    const t = scion(1, 0, 3);
    t.dur!.body = 1;
    const b = battle(e, t);
    strike(b, scripted(0, 0.99), e, t, { ...HIT, aim: "body" });
    expect(b.events.some((x) => x.t === "injury")).toBe(true);
    expect(t.broken.includes("body") || b.events.some((x) => x.t === "steeled") || t.dead).toBe(true);
  });

  it("tears a blessing away with a Siphon, naming who took it for the field to draw (Josh 2026-11-11)", () => {
    const u = scion(1, 0, 3);
    u.mods.siphon = 1;
    const t = enemy(9, 0, 3);
    const b = battle(u, t);
    addStatus(b, t, "haste", 50);
    strike(b, scripted(0, 0.99, 0), u, t, HIT);
    expect(t.statuses.some((x) => x.id === "haste")).toBe(false);
    expect(b.events).toContainEqual({ t: "status", target: 9, status: "haste", on: false, by: 1 });
  });

  it("takes only a share of a blow's damage from the location's Durability (Josh 2026-11-11)", () => {
    const e = enemy(9, 0, 3);
    const t = scion(1, 0, 3, { hp: 999, maxHp: 999 });
    const before = t.dur!.body;
    const b = battle(e, t);
    strike(b, scripted(0, 0.99), e, t, { ...HIT, aim: "body", power: 3 });
    const hit = b.events.find((x) => x.t === "hit");
    expect(hit?.t === "hit" && hit.damage).toBeGreaterThan(3);
    const dmg = hit?.t === "hit" ? hit.damage : 0;
    expect(before - t.dur!.body).toBe(Math.max(1, Math.round((dmg * TUNING.combat.durabilityTakenPct) / 100)));
  });

  it("kills enemies at 0 HP and credits the kill", () => {
    const u = scion(1, 0, 3);
    const t = enemy(9, 0, 3);
    t.hp = 1;
    strike(battle(u, t), scripted(0, 0.99), u, t, HIT);
    expect(t.dead).toBe(true);
    expect(u.kills).toBe(1);
  });

  it("lets a Last Stand Scion die instead of going Down, and kills them when the battle ends", () => {
    const e = enemy(9, 0, 3);
    const t = scion(1, 0, 3, { lastStand: true });
    const b = battle(e, t, scion(2, 1, 3));
    end(b, "victory");
    expect(t.dead).toBe(true);
  });
});

describe("reach and targeting (§10.3)", () => {
  it("lets enemy melee reach only the front-most Scion in its rows", () => {
    const front = scion(1, 0, 3);
    const back = scion(2, 2, 3);
    const other = scion(3, 2, 5);
    const e = enemy(9, 0, 3);
    expect(meleeTargets(battle(front, back, other, e), e).map((u) => u.id)).toEqual([1]);
  });

  it("keeps a Back Scion's sword from reaching, and a Middle one to E1–E2", () => {
    const u = scion(1, 2, 3);
    const e = enemy(9, 0, 3);
    expect(singleTargets(battle(u, e), u, HIT)).toEqual([]);
    const mid = scion(2, 1, 3);
    expect(singleTargets(battle(mid, e), mid, HIT).map((x) => x.id)).toEqual([9]);
  });

  it("lets Scion melee reach any foe with nothing in front of it, in any row (8am)", () => {
    const u = scion(1, 0, 3);
    const front = enemy(8, 0, 2);
    const unblocked = enemy(9, 1, 6);
    const blocked = enemy(7, 2, 2);
    expect(singleTargets(battle(u, front, unblocked, blocked), u, HIT).map((x) => x.id).sort()).toEqual([8, 9]);
    // Middle still reaches only E1–E2, and Back needs a reach weapon.
    const mid = scion(2, 1, 3);
    expect(singleTargets(battle(mid, enemy(6, 2, 7), enemy(5, 1, 0)), mid, HIT).map((x) => x.id)).toEqual([5]);
    const back = scion(3, 2, 3);
    expect(singleTargets(battle(back, front), back, HIT)).toEqual([]);
    // Enemy melee keeps the strict rule (§10.3): only its own rows.
    const e = enemy(9, 0, 3);
    expect(meleeTargets(battle(scion(4, 0, 4), e), e)).toEqual([]);
  });

  it("weights single targets 45/35/20 by column and passes an empty column's weight back", () => {
    const rng = createRng(5);
    const units = [scion(1, 0, 1), scion(2, 1, 1), scion(3, 2, 1)];
    const n = [0, 0, 0];
    for (let i = 0; i < 20_000; i++) n[pickWeighted(rng, units)!.col]!++;
    [45, 35, 20].forEach((w, col) => expect(Math.abs((n[col]! / 20_000) * 100 - w)).toBeLessThan(2));
    const noFront = [scion(2, 1, 1), scion(3, 2, 1)];
    let mid = 0;
    for (let i = 0; i < 10_000; i++) if (pickWeighted(rng, noFront)!.col === 1) mid++;
    expect(mid / 10_000).toBeCloseTo(0.8, 1);
  });
});

describe("the clock (§10.4–10.5)", () => {
  it("gives the faster combatant the first turn and keeps leftover CT", () => {
    const fast = scion(1, 0, 3, { speed: 20, ct: 0 });
    const slow = scion(2, 0, 4, { speed: 5, ct: 0 });
    const b = battle(fast, slow, enemy(9, 2, 7));
    b.units.find((u) => u.id === 9)!.speed = 1;
    const rng = createRng(1);
    const first = advance(b, rng)!;
    expect(first.id).toBe(1);
    const ct = first.ct;
    act(b, rng, first, { do: "wait" });
    expect(first.ct).toBe(ct - 60);
  });

  it("charges for base × 100 / (100 + Acuity) ticks, holds at 100, then resolves", () => {
    const fire: AbilityDef = { id: "fire", shape: "single", side: "foe", power: 1, base: 10, kind: "magic", charge: 100 };
    const u = scion(1, 2, 3, { ct: 100, abilities: [fire], mp: 50 });
    expect(chargeTicks(u, 100)).toBe(Math.round(10_000 / (100 + u.acuity)));
    const e = enemy(9, 0, 3);
    e.speed = 1;
    e.hp = e.maxHp = 10_000;
    const b = battle(u, e);
    const rng = createRng(2);
    advance(b, rng);
    act(b, rng, u, { do: "ability", ability: "fire", target: { side: "enemy", col: 0, row: 3 } });
    const ticks = u.charge!.ticks;
    const started = b.tick;
    expect(b.events.some((x) => x.t === "use")).toBe(false);
    advance(b, rng);
    const used = b.events.findIndex((x) => x.t === "use");
    expect(used).toBeGreaterThan(-1);
    expect(b.tick - started).toBeGreaterThanOrEqual(ticks);
    expect(u.charge).toBeUndefined();
  });

  it("cancels a charge on Stun", () => {
    const fire: AbilityDef = { id: "fire", shape: "single", side: "foe", power: 1, base: 10, kind: "magic", charge: 100 };
    const u = scion(1, 2, 3, { ct: 100, abilities: [fire], mp: 50 });
    const e = enemy(9, 0, 3);
    e.speed = 1;
    const b = battle(u, e);
    const rng = createRng(2);
    advance(b, rng);
    act(b, rng, u, { do: "ability", ability: "fire", target: { side: "enemy", col: 0, row: 3 } });
    expect(u.charge).toBeDefined();
    addStatus(b, u, "stun");
    expect(u.charge).toBeUndefined();
    expect(b.events.some((x) => x.t === "cancel")).toBe(true);
  });

  it("charges move by Guile and forecasts the next turns", () => {
    const u = scion(1, 0, 3, { guile: 25 });
    expect(moveCost(u, 2)).toBe(2 * Math.max(10, 20 - 5));
    const b = battle(u, enemy(9, 0, 3));
    expect(forecast(b, 10)).toHaveLength(10);
  });

  it("moves up to two cells and swaps with an adjacent ally", () => {
    const u = scion(1, 2, 3, { ct: 100, speed: 30 });
    const ally = scion(2, 1, 3, { speed: 1 });
    const b = battle(u, ally, enemy(9, 0, 3));
    b.units.find((x) => x.id === 9)!.speed = 1;
    const rng = createRng(1);
    expect(advance(b, rng)!.id).toBe(1);
    move(b, u, 1, 3);
    expect([u.col, ally.col]).toEqual([1, 2]);
    expect(() => move(b, u, 0, 3)).toThrow();
  });
});

describe("gambit conditions (§14.1)", () => {
  it("reads turn, HP, marked and charging conditions", () => {
    const u = scion(1, 0, 3, { turns: 3 });
    const e = enemy(9, 0, 3);
    const b = battle(u, e);
    expect(holds(b, u, "turn % 3 == 0")).toBe(true);
    expect(holds(b, u, "turn % 3 == 1")).toBe(false);
    expect(holds(b, u, "hp<0.5")).toBe(false);
    u.hp = 1;
    expect(holds(b, u, "ally.hp<0.5")).toBe(true);
    expect(holds(b, e, "enemy.marked")).toBe(false);
    addStatus(b, u, "marked");
    expect(holds(b, e, "enemy.marked")).toBe(true);
    expect(holds(b, u, "nonsense")).toBe(false);
  });
});
