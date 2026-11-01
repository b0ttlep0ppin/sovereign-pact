// Hazards (§14.8): occasional, at the pool's odds and never two of a kind; barrels that explode, gas
// crates that vent, bells that call a wave, saws that bite the Front, rockfalls that warn, hidden traps.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { act, checkEnd, resolve } from "./combat/battle.ts";
import { newBattle } from "./combat/build.ts";
import { step } from "./combat/clock.ts";
import { encounterBattle, place } from "./combat/encounter.ts";
import { standardParty } from "./combat/fixtures.ts";
import { aim } from "./combat/gambits.ts";
import { hasStatus } from "./combat/grid.ts";
import { hazardCombatant, placeHazard, rollHazard } from "./combat/hazards.ts";
import { simulate } from "./combat/sim.ts";
import { addStatus } from "./combat/status.ts";
import { cellOf } from "./combat/targets.ts";
import type { AbilityDef, Battle, Combatant } from "./combat/types.ts";
import { ENEMY_BY_ID, HAZARD_BY_ID } from "./content.ts";

const hz = (id: string) => HAZARD_BY_ID.get(id)!;
const shot: AbilityDef = { id: "shot", shape: "single", side: "foe", power: 1, accuracy: 999, reach: "ranged" };

function field(extra: Combatant[] = []): { b: Battle; party: Combatant[] } {
  const party = standardParty(1, 12);
  const b: Battle = { ...newBattle(1, [...party, ...place([ENEMY_BY_ID.get("barrow_skeleton")!], 4), ...extra]), pool: "barrows" };
  return { b, party };
}

describe("hazards", () => {
  it("appear at the pool's odds, never one already met", () => {
    const rng = createRng(1);
    let forge = 0;
    let wild = 0;
    for (let i = 0; i < 2000; i++) {
      if (rollHazard(rng, "forge_ruins")) forge++;
      if (rollHazard(rng, "beast_lands")) wild++;
    }
    expect(forge / 2000).toBeGreaterThan(0.25);
    expect(forge / 2000).toBeLessThan(0.35);
    expect(wild / 2000).toBeLessThan(0.14);
    const all = ["explosive_barrel", "poison_gas_crate", "alarm_bell", "rotating_saw", "rockfall"];
    for (let i = 0; i < 200; i++) expect([undefined, "bear_trap"]).toContain(rollHazard(rng, "forge_ruins", all)?.id);
  });

  it("take no turns, shrug off statuses, and do not hold the field", () => {
    const barrel = hazardCombatant(hz("explosive_barrel"), 4, 900, 1, 3);
    const { b } = field([barrel]);
    expect(barrel.maxHp).toBe(1);
    expect(addStatus(b, barrel, "poison", 300)).toBe(false);
    for (const u of b.units.filter((x) => x.enemy === "barrow_skeleton")) u.dead = true;
    checkEnd(b);
    expect(b.outcome).toBe("victory");
  });

  it("an Explosive Barrel goes up when struck, hurting its own side and the Front beside E1", () => {
    const barrel = hazardCombatant(hz("explosive_barrel"), 4, 900, 0, 4);
    const { b, party } = field([barrel]);
    const skeleton = b.units.find((u) => u.enemy === "barrow_skeleton")!;
    const front = party.find((u) => u.col === 0)!;
    front.row = 5;
    const [sk, fr] = [skeleton.hp, front.hp];
    resolve(b, createRng(3), party[2]!, shot, cellOf(barrel));
    expect(barrel.dead).toBe(true);
    expect(skeleton.hp).toBeLessThan(sk);
    expect(front.hp).toBeLessThan(fr);
  });

  it("a Poison Gas Crate vents on the Front every 200 ticks while it stands", () => {
    const crate = hazardCombatant(hz("poison_gas_crate"), 4, 900, 1, 3);
    const { b, party } = field([crate]);
    const front = party.find((u) => u.col === 0)!;
    for (let i = 0; i < 20; i++) step(b, createRng(i));
    expect(b.events.filter((e) => e.t === "hazard" && e.hazard === "poison_gas_crate")).toHaveLength(1);
    expect(b.events.some((e) => (e.t === "hit" || e.t === "status") && e.target === front.id)).toBe(true);
  });

  it("an Alarm Bell calls a wave of the pool's fodder at E3 when struck or after 300 ticks, once; bots leave it be", () => {
    const bell = hazardCombatant(hz("alarm_bell"), 4, 900, 2, 3);
    const { b, party } = field([bell]);
    const a = aim(b, createRng(1), party[2]!, shot, "lowest_hp");
    expect(a && "target" in a ? a.target : undefined).not.toEqual(cellOf(bell));
    const before = b.units.length;
    resolve(b, createRng(1), party[2]!, { ...shot, power: 0.01 }, cellOf(bell));
    const wave = b.units.slice(before);
    expect(wave).toHaveLength(2);
    expect(wave.every((u) => ENEMY_BY_ID.get(u.enemy!)!.role === "fodder" && u.tags.includes("add"))).toBe(true);
    expect(bell.dead).toBe(true);
    const bell2 = hazardCombatant(hz("alarm_bell"), 4, 901, 2, 6);
    const two = field([bell2]).b;
    for (let i = 0; i < 30; i++) step(two, createRng(i));
    expect(bell2.dead).toBe(true);
  });

  it("a Rotating Saw bites the Arms of the Scion at the Front of its row", () => {
    const saw = hazardCombatant(hz("rotating_saw"), 4, 900, 0, 3);
    const { b, party } = field([saw]);
    const front = party.find((u) => u.col === 0)!;
    front.row = 3;
    for (let i = 0; i < 100; i++) step(b, createRng(i));
    const bites = b.events.filter((e) => e.t === "hit" && e.unit === saw.id && e.target === front.id);
    expect(bites.length).toBeGreaterThanOrEqual(5);
    expect(bites.filter((e) => e.t === "hit" && e.loc === "arms").length * 2).toBeGreaterThan(bites.length);
  });

  it("a Rockfall says where it will fall, and falls on that band three turns later", () => {
    const { b, party } = field();
    placeHazard(b, createRng(1), hz("rockfall"), 4);
    const set = b.events.find((e) => e.t === "hazard" && e.what === "set")!;
    expect(set).toBeDefined();
    const row = b.field![0]!.row;
    const under = party.filter((u) => Math.abs(u.row - row) <= 1);
    expect(under.length).toBeGreaterThan(0);
    for (let i = 0; i < 29; i++) step(b, createRng(i));
    expect(b.field).toHaveLength(1);
    step(b, createRng(99));
    expect(b.field).toHaveLength(0);
    expect(b.events.filter((e) => e.t === "hit" && under.some((u) => u.id === e.target))).not.toHaveLength(0);
  });

  it("a hidden Bear Trap springs on the Scion who steps on it: Rooted and a Legs hit", () => {
    const { b, party } = field();
    b.field = [{ id: "bear_trap", col: 1, row: 6, hidden: true }];
    const u = party.find((x) => x.col === 1)!;
    b.actor = u.id;
    b.moved = true;
    u.row = 6;
    act(b, createRng(1), u, { do: "wait" });
    expect(hasStatus(u, "rooted")).toBe(true);
    expect(b.events.some((e) => e.t === "hit" && e.target === u.id && e.loc === "legs")).toBe(true);
    expect(b.field).toHaveLength(0);
  });

  it("come with drawn Encounters and are fought through by the bots", () => {
    let seen = 0;
    for (let s = 0; s < 40; s++) {
      const { battle, encounter } = encounterBattle(s, standardParty(s, 12), { pool: "barrows", level: 4, modifier: null });
      if (encounter.hazard) seen++;
      expect(simulate(battle).outcome).toBeDefined();
    }
    expect(seen).toBeGreaterThan(0);
  });
});
