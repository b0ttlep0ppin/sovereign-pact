// The Magus's, Pugilist's, Alterer's and Abjurer's last abilities (§12.8, §12.10, §12.14, §12.17):
// Siphon, Nova, Elemental Mastery, Second Breath, Hybrid and Ward-Sense.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { act, advance, mpCost, resolve } from "./combat/battle.ts";
import { carriedMods, enemyCombatant, newBattle } from "./combat/build.ts";
import { baseDamage } from "./combat/damage.ts";
import { standardParty } from "./combat/fixtures.ts";
import { revert, shift } from "./combat/forms.ts";
import { hasStatus } from "./combat/grid.ts";
import { vitalsOf } from "./combat/replay.ts";
import { addStatus } from "./combat/status.ts";
import { cellOf } from "./combat/targets.ts";
import type { AbilityDef, Battle, Combatant } from "./combat/types.ts";
import { ABILITY_SET_BY_JOB, ACTIVE_BY_ID } from "./content.ts";
import { promote, rollRecruit } from "./generate.ts";

function scion(job: string, id = 1): Combatant {
  const [u] = standardParty(id, 9, id);
  return { ...u!, id, col: 1, row: 3, mp: 10, maxMp: 400, tp: 200, abilities: ABILITY_SET_BY_JOB.get(job as "magus")!.actives, mods: {}, statuses: [], flags: [] };
}
const foe = (id = 10, row = 3, col = 0): Combatant => ({ ...enemyCombatant("barrow_skeleton", { id, level: 3, col, row }), hp: 9999, maxHp: 9999 });

function ready(u: Combatant, ...others: Combatant[]): Battle {
  const b = newBattle(1, [u, ...others]);
  b.actor = u.id;
  u.ct = 200;
  return b;
}

describe("the last abilities", () => {
  it("turns 20% of max HP into half again as much MP with Siphon", () => {
    const u = scion("magus");
    const b = ready(u, foe());
    const [hp, mp] = [u.hp, u.mp];
    act(b, createRng(1), u, { do: "ability", ability: "siphon", target: cellOf(u) });
    const paid = Math.round(u.maxHp * 0.2);
    expect(hp - u.hp).toBe(paid);
    expect(u.mp - mp).toBe(Math.round(paid * 1.5));
  });

  it("casts Nova in the element its targets fear most, and Stuns the caster", () => {
    const u = { ...scion("magus"), mp: 400 };
    const f = { ...foe(), affinity: { fire: 0, water: -50, holy: 0, dark: 0, earth: 0, wind: 0 } };
    const b = ready(u, f);
    resolve(b, createRng(1), u, ACTIVE_BY_ID.get("nova")!, cellOf(f));
    expect(b.events.find((e) => e.t === "hit")).toMatchObject({ element: "water" });
    expect(hasStatus(u, "stun")).toBe(true);
  });

  it("strengthens and cheapens the birth House element's spells with Elemental Mastery", () => {
    const p = { ...promote(rollRecruit(createRng(2), 1, 0), "magus"), passives: ["elemental_mastery"] };
    const mods = carriedMods(p, { traits: [], element: "earth" });
    expect(mods["spellPct.earth"]).toBe(15);
    const u = { ...scion("magus"), mods };
    const spell: AbilityDef = { id: "quake", shape: "single", side: "foe", power: 1, base: 20, kind: "magic", element: "earth", mp: 20 };
    expect(baseDamage(u, spell) / baseDamage({ ...u, mods: {} }, spell)).toBeCloseTo(1.15, 5);
    expect(mpCost(u, spell)).toBeLessThan(mpCost({ ...u, mods: {} }, spell));
  });

  it("clears Fear and Confusion with Breath under Second Breath", () => {
    const u = { ...scion("pugilist"), mp: 100, mods: { secondBreath: 1 } };
    const b = ready(u, foe());
    addStatus(b, u, "fear");
    addStatus(b, u, "confusion");
    resolve(b, createRng(1), u, ACTIVE_BY_ID.get("breath")!, cellOf(u));
    expect(hasStatus(u, "fear") || hasStatus(u, "confusion")).toBe(false);
  });

  it("keeps the Form's passive for 100 ticks after Revert with Hybrid", () => {
    const u = { ...scion("alterer"), mods: { hybrid: 1 } };
    const b = ready(u, foe());
    shift(b, u, "werewolf");
    revert(b, u);
    expect(u.statuses.find((s) => s.id === "graft")).toMatchObject({ ticks: 100, mods: { drainPct: 25 } });
  });

  it("shows the foes' buffs with their ticks left under Ward-Sense", () => {
    const u = { ...scion("abjurer"), mods: { wardSense: 1 } };
    const f = foe();
    const b = newBattle(1, [u, f]);
    addStatus(b, f, "haste", 240);
    advance(b, createRng(1));
    expect(vitalsOf(f)[9]).toContain("haste@240".replace("240", String(f.statuses.find((s) => s.id === "haste")!.ticks)));
    expect(vitalsOf(u)[9].every((s) => !s.includes("@"))).toBe(true);
  });

  it("leaves no ability unbuilt", () => {
    for (const job of ["magus", "pugilist", "alterer", "abjurer"] as const) {
      const set = ABILITY_SET_BY_JOB.get(job)!;
      expect([...set.actives, ...set.passives].filter((a) => a.later).map((a) => a.id)).toEqual([]);
    }
  });
});
