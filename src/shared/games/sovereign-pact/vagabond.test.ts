// The Vagabond's last abilities (§12.6): Steal, Shadow Lunge, Dirty Trick, Vanish, Pickpocket the
// Reaper, and the passives Knife Flurry and Sixth Sense.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { act, advance, resolve } from "./combat/battle.ts";
import { enemyCombatant, newBattle } from "./combat/build.ts";
import { encounterBattle } from "./combat/encounter.ts";
import { standardParty } from "./combat/fixtures.ts";
import { hasStatus } from "./combat/grid.ts";
import { addStatus, statusValue } from "./combat/status.ts";
import { cellOf, singleTargets } from "./combat/targets.ts";
import type { Battle, Combatant } from "./combat/types.ts";
import { ABILITY_SET_BY_JOB, ACTIVE_BY_ID, CONSUMABLE_BY_ID } from "./content.ts";

function vagabond(col = 0): Combatant {
  const [u] = standardParty(1, 9, 1);
  return { ...u!, id: 1, col, row: 3, mp: 200, tp: 200, guile: 100, abilities: ABILITY_SET_BY_JOB.get("vagabond")!.actives, mods: {}, statuses: [], flags: Array<string>(4).fill("sure_hit") };
}
const ally = (row = 5): Combatant => ({ ...standardParty(1, 9, 1)[0]!, id: 2, col: 1, row, mods: {}, statuses: [] });
const foe = (id = 10, row = 3, col = 0): Combatant => ({ ...enemyCombatant("barrow_skeleton", { id, level: 3, col, row }), hp: 9999, maxHp: 9999, resist: { physical: 0, mental: 0 } });

function ready(u: Combatant, ...others: Combatant[]): Battle {
  const b = newBattle(1, [u, ...others]);
  b.actor = u.id;
  u.ct = 200;
  return b;
}
const use = (b: Battle, u: Combatant, ability: string, t: Combatant) => act(b, createRng(3), u, { do: "ability", ability, target: cellOf(t) });

describe("the Vagabond", () => {
  it("takes a buff with Steal, or with none lifts a consumable once a foe", () => {
    const u = vagabond();
    const f = foe();
    const b = ready(u, f);
    addStatus(b, f, "haste");
    use(b, u, "steal", f);
    expect(hasStatus(f, "haste")).toBe(false);
    expect(hasStatus(u, "haste")).toBe(true);
    resolve(b, createRng(1), u, ACTIVE_BY_ID.get("steal")!, cellOf(f), f.id);
    expect(b.stolen).toHaveLength(1);
    expect(CONSUMABLE_BY_ID.get(b.stolen![0]!)?.use).toBe("battle");
    expect(b.satchel).toEqual(b.stolen);
    resolve(b, createRng(1), u, ACTIVE_BY_ID.get("steal")!, cellOf(f), f.id);
    expect(b.stolen).toHaveLength(1);
  });

  it("darts to the Front and reaches a foe in the Back with Shadow Lunge, then stands Exposed", () => {
    const u = { ...vagabond(2), weapon: { ...vagabond().weapon, reach: "melee" as const } };
    const [front, back] = [foe(10, 3, 0), foe(11, 3, 2)];
    const b = ready(u, front, back);
    expect(singleTargets(b, u, ACTIVE_BY_ID.get("shadow_lunge")!).map((t) => t.id)).toContain(back.id);
    use(b, u, "shadow_lunge", back);
    expect(u.col).toBe(0);
    expect(back.hp).toBeLessThan(9999);
    expect(hasStatus(u, "exposed")).toBe(true);
    // Any foe's melee reaches them now, rows or no.
    const far = foe(12, 7, 2);
    b.units.push(far);
    expect(singleTargets(b, far, { id: "claw", shape: "single", side: "foe", power: 1, reach: "melee" }).map((t) => t.id)).toContain(u.id);
  });

  it("plays one of its tricks with Dirty Trick", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 40; seed++) {
      const u = vagabond();
      const f = { ...foe(), ct: 80 };
      const b = ready(u, f);
      resolve(b, createRng(seed), u, ACTIVE_BY_ID.get("dirty_trick")!, cellOf(f), f.id);
      for (const id of ["stun", "blind", "disarmed"]) if (hasStatus(f, id)) seen.add(id);
      if (f.ct === 50) seen.add("readiness");
    }
    expect([...seen].sort()).toEqual(["blind", "disarmed", "readiness", "stun"]);
  });

  it("stays Hidden through its turns until it acts, and backstabs half again as hard from Vanish", () => {
    const u = vagabond();
    const f = { ...foe(), statuses: [] };
    const b = ready(u, f);
    use(b, u, "vanish", u);
    expect(statusValue(u, "hidden")).toBe(1);
    u.ct = 500;
    advance(b, createRng(1));
    expect(hasStatus(u, "hidden")).toBe(true);
    const plain = { ...f, hp: 9999 };
    const b2 = ready({ ...vagabond(), id: 3 }, plain);
    resolve(b2, createRng(2), b2.units[0]!, ACTIVE_BY_ID.get("backstab")!, cellOf(plain), plain.id);
    const was = 9999 - plain.hp;
    resolve(b, createRng(2), u, ACTIVE_BY_ID.get("backstab")!, cellOf(f), f.id);
    expect(9999 - f.hp).toBeGreaterThan(was * 1.3);
    expect(hasStatus(u, "hidden")).toBe(false);
  });

  it("takes 20 CT from the foe and gives it to the most hurt ally with Pickpocket the Reaper", () => {
    const u = vagabond();
    const [a, hurt] = [ally(5), { ...ally(6), id: 3 }];
    hurt.hp = 1;
    const f = { ...foe(), ct: 70 };
    const b = ready(u, a, hurt, f);
    const ct = hurt.ct;
    use(b, u, "pickpocket_the_reaper", f);
    expect(f.ct).toBe(50);
    expect(hurt.ct).toBe(ct + 20);
  });

  it("is never ambushed with Sixth Sense, and sees the traps", () => {
    const party = [{ ...vagabond(), mods: { sixthSense: 1 } }];
    const { battle, encounter } = encounterBattle(3, party, { pool: "barrows", level: 2, modifier: "ambush" });
    expect(encounter.modifier).toBeUndefined();
    expect(battle.units.every((x) => x.ct === 0)).toBe(true);
  });

  it("has every Vagabond ability built", () => {
    const set = ABILITY_SET_BY_JOB.get("vagabond")!;
    expect([...set.actives, ...set.passives].filter((a) => a.later).map((a) => a.id)).toEqual([]);
  });
});
