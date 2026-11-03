// The Soothsayer's and Gambler's last abilities (§12.7, §12.9): Ancestor's Shield, Commune, Lifeline,
// Calming Presence; Cheat Death, Last Chip, Fortune Favors.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { act } from "./combat/battle.ts";
import { enemyCombatant, newBattle } from "./combat/build.ts";
import { strike } from "./combat/damage.ts";
import { standardParty } from "./combat/fixtures.ts";
import { hasStatus } from "./combat/grid.ts";
import { injure } from "./combat/injury.ts";
import { unitOf } from "./combat/replay.ts";
import { cellOf } from "./combat/targets.ts";
import type { AbilityDef, Battle, Combatant } from "./combat/types.ts";
import { ABILITY_SET_BY_JOB } from "./content.ts";

const HIT: AbilityDef = { id: "hit", shape: "single", side: "foe", power: 1 };

function scion(job: "soothsayer" | "gambler", id = 1, row = 3): Combatant {
  const [u] = standardParty(id, 9, id);
  return { ...u!, id, col: 1, row, mp: 200, tp: 200, abilities: ABILITY_SET_BY_JOB.get(job)!.actives, mods: {}, statuses: [], flags: [] };
}
const ally = (id = 2, row = 4): Combatant => ({ ...standardParty(id, 9, id)[0]!, id, col: 1, row, mods: {}, statuses: [], flags: [] });
const foe = (id = 10, row = 3): Combatant => ({ ...enemyCombatant("barrow_skeleton", { id, level: 3, col: 0, row }), flags: Array<string>(10).fill("sure_hit") });

function ready(u: Combatant, ...others: Combatant[]): Battle {
  const b = newBattle(1, [u, ...others]);
  b.actor = u.id;
  u.ct = 200;
  return b;
}
const use = (b: Battle, u: Combatant, ability: string, t: Combatant) => act(b, createRng(3), u, { do: "ability", ability, target: cellOf(t) });
const totals = (b: Battle) => b.events.flatMap((e) => (e.t === "injury" ? [e.total] : []));

describe("the Soothsayer", () => {
  it("adds two steps to the ally's next injury roll with Ancestor's Shield", () => {
    const [u, a] = [scion("soothsayer"), ally()];
    const plain = newBattle(1, [{ ...a }]);
    injure(plain, createRng(4), plain.units[0]!, "body", 0);
    const b = ready(u, a, foe());
    use(b, u, "ancestors_shield", a);
    injure(b, createRng(4), a, "body", 0);
    injure(b, createRng(4), a, "body", 0);
    const [shielded, after] = totals(b);
    expect(shielded! - totals(plain)[0]!).toBe(4);
    expect(after).toBe(totals(plain)[0]);
  });

  it("reads every enemy with Commune: weak point and affinities show, charges are telegraphed", () => {
    const u = scion("soothsayer");
    const f = foe();
    const b = ready(u, f);
    expect(unitOf(f).read).toBeUndefined();
    use(b, u, "commune", u);
    expect(hasStatus(f, "communed")).toBe(true);
    expect(unitOf(f).read).toBeDefined();
  });

  it("may hold a falling ally at 1 HP with Lifeline, once a battle", () => {
    let saved = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const u = { ...scion("soothsayer"), mods: { lifeline: 1 } };
      const a = { ...ally(), hp: 1 };
      const b = newBattle(1, [u, a, foe()]);
      strike(b, createRng(seed), b.units[2]!, a, { ...HIT, power: 50 });
      if (u.flags.includes("lifeline_used")) {
        saved++;
        expect(a.down).toBe(false);
      }
    }
    expect(saved).toBeGreaterThan(3);
    expect(saved).toBeLessThan(20);
  });

  it("softens Sanity lost beside them with Calming Presence", () => {
    const shake: AbilityDef = { ...HIT, power: 0, kind: "physical", sanity: 20 };
    const [u, a] = [{ ...scion("soothsayer"), mods: { calmingPresence: 1 } }, ally(2, 4)];
    const b = newBattle(1, [u, a, foe()]);
    const before = a.sanity;
    strike(b, createRng(1), b.units[2]!, a, shake);
    expect(before - a.sanity).toBe(16);
    a.row = 6;
    const was = a.sanity;
    strike(b, createRng(1), b.units[2]!, a, shake);
    expect(was - a.sanity).toBe(20);
  });
});

describe("the Gambler", () => {
  it("rolls injuries twice and keeps the better under Cheat Death", () => {
    let better = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const [u, a] = [scion("gambler"), ally()];
      const plain = newBattle(1, [{ ...a }]);
      injure(plain, createRng(seed), plain.units[0]!, "body", 0);
      const b = ready(u, a, foe());
      use(b, u, "cheat_death", a);
      injure(b, createRng(seed), a, "body", 0);
      expect(totals(b)[0]).toBeGreaterThanOrEqual(totals(plain)[0]!);
      if (totals(b)[0]! > totals(plain)[0]!) better++;
    }
    expect(better).toBeGreaterThan(5);
  });

  it("hits harder the lower its HP with Last Chip, and crits after a 12", () => {
    const hitFor = (hp: number, flags: string[] = []) => {
      const u = { ...scion("gambler"), hp, flags: ["sure_hit", ...flags] };
      const f = { ...foe(), hp: 99_999, maxHp: 99_999, defense: 0, flags: [] };
      const b = ready(u, f);
      use(b, u, "last_chip", f);
      return b.events.find((e) => e.t === "hit") as { damage: number; crit?: boolean };
    };
    const full = scion("gambler").maxHp;
    expect(hitFor(1).damage).toBeGreaterThan(hitFor(full).damage * 1.8);
    expect(hitFor(full, ["lots_twelve"]).crit).toBe(true);
  });

  it("has every Soothsayer and Gambler ability built", () => {
    for (const job of ["soothsayer", "gambler"] as const) {
      const set = ABILITY_SET_BY_JOB.get(job)!;
      expect([...set.actives, ...set.passives].filter((a) => a.later).map((a) => a.id)).toEqual([]);
    }
  });
});
