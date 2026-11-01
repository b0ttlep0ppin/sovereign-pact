// The Conjurer's summons (§12.2, §12.15): calling them, the binding cap, timed summons, the Choir's
// dirge, the Imp's burst, Sacrifice, Banish, Pact of Blood, Familiar, and a battle the bots play.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { act, advance, cannotUse, end, resolve } from "./combat/battle.ts";
import { enemyCombatant, newBattle } from "./combat/build.ts";
import { standardParty } from "./combat/fixtures.ts";
import { step } from "./combat/clock.ts";
import { hasStatus } from "./combat/grid.ts";
import { kill } from "./combat/injury.ts";
import { simulate } from "./combat/sim.ts";
import { summon } from "./combat/summons.ts";
import { cellOf } from "./combat/targets.ts";
import type { Battle, Combatant } from "./combat/types.ts";
import { ABILITY_SET_BY_JOB, ACTIVE_BY_ID } from "./content.ts";

function conjurer(): Combatant {
  const [, , , u] = standardParty(1, 9, 1);
  return { ...u!, id: 1, col: 2, row: 3, mp: 500, abilities: ABILITY_SET_BY_JOB.get("conjurer")!.actives, mods: {} };
}
const foe = (id = 10, row = 3): Combatant => ({ ...enemyCombatant("barrow_skeleton", { id, level: 3, col: 0, row }), hp: 9999, maxHp: 9999 });
const ab = (id: string) => ACTIVE_BY_ID.get(id)!;

function ready(u: Combatant, ...others: Combatant[]): Battle {
  const b = newBattle(1, [u, ...others]);
  b.actor = u.id;
  u.ct = 200;
  return b;
}
const owned = (b: Battle, u: Combatant) => b.units.filter((x) => x.owner === u.id && !x.dead);

describe("summons", () => {
  it("charge, then stand on the party's cells with their own HP and CT", () => {
    const u = conjurer();
    const b = ready(u, foe());
    act(b, createRng(1), u, { do: "ability", ability: "call_hound", target: cellOf(u) });
    expect(u.charge?.ability.id).toBe("call_hound");
    resolve(b, createRng(1), u, u.charge!.ability, cellOf(u));
    const [hound] = owned(b, u);
    expect(hound).toMatchObject({ side: "party", col: 0, summon: "bone_hound", maxHp: Math.round(u.maxHp * 0.6), ct: 0 });
    expect(hound!.expires).toBe(b.tick + 300);
  });

  it("come two Crows to a call, and the binding cap counts calls", () => {
    const u = conjurer();
    const b = ready(u, foe());
    summon(b, u, "carrion_crows");
    expect(owned(b, u)).toHaveLength(2);
    expect(owned(b, u).every((c) => hasStatus(c, "provoke"))).toBe(true);
    summon(b, u, "marsh_lantern");
    expect(cannotUse(u, ab("call_imp"))).toBe("binding");
    // Losing one crow keeps the binding; losing both frees it.
    kill(b, owned(b, u)[0]!);
    expect(cannotUse(u, ab("call_imp"))).toBe("binding");
    kill(b, owned(b, u).find((x) => x.summon === "carrion_crows")!);
    expect(cannotUse(u, ab("call_imp"))).toBeNull();
    // Legion: one more.
    u.mods.bindingCap = 1;
    summon(b, u, "ember_imp");
    expect(cannotUse(u, ab("call_hound"))).toBeNull();
  });

  it("leave when their time is up, and all of them at battle end", () => {
    const u = conjurer();
    const b = newBattle(1, [u, foe()]);
    const [hound] = summon(b, u, "bone_hound");
    for (let i = 0; i < 29; i++) step(b, createRng(i));
    expect(hound!.dead).toBe(false);
    step(b, createRng(1));
    expect(hound!.dead).toBe(true);
    const [lantern] = summon(b, u, "marsh_lantern");
    end(b, "victory");
    expect(lantern!.dead).toBe(true);
    expect(b.events.filter((e) => e.t === "vanish")).toHaveLength(2);
  });

  it("dirge every enemy while the Choir stands", () => {
    const u = conjurer();
    const [t, s] = [foe(10, 1), foe(11, 6)];
    const b = ready(u, t, s);
    const [choir] = summon(b, u, "drowned_choir");
    expect([t.mods.accuracy, s.mods.accuracy]).toEqual([-10, -10]);
    kill(b, choir!);
    expect([t.mods.accuracy, s.mods.accuracy]).toEqual([undefined, undefined]);
  });

  it("burst into flame as the Imp dies", () => {
    const u = conjurer();
    const t = foe(10, 3);
    const b = ready(t, u);
    const [imp] = summon(b, u, "ember_imp");
    imp!.hp = 1;
    t.flags = Array<string>(5).fill("sure_hit");
    resolve(b, createRng(1), t, { id: "smash", shape: "single", side: "foe", power: 5 }, cellOf(imp!), imp!.id);
    expect(imp!.dead).toBe(true);
    expect(b.events.some((e) => (e.t === "hit" || e.t === "miss") && e.unit === imp!.id && e.target === t.id)).toBe(true);
  });

  it("can be Sacrificed to heal the allies beside them", () => {
    const u = conjurer();
    const ally = { ...standardParty(1, 9, 1)[0]!, id: 2, col: 2, row: 4, mods: {} };
    ally.hp = 1;
    const b = ready(u, ally, foe());
    const [lantern] = summon(b, u, "marsh_lantern");
    expect(lantern).toMatchObject({ col: 2, row: 2 });
    lantern!.row = 5;
    resolve(b, createRng(1), u, ab("sacrifice"), cellOf(lantern!), lantern!.id);
    expect(lantern!.dead).toBe(true);
    expect(ally.hp).toBe(1 + Math.round(ally.maxHp * 0.2));
  });

  it("Banish summons and adds, never the rest", () => {
    const u = conjurer();
    const [add, plain] = [{ ...foe(10, 2), tags: ["add"] }, foe(11, 5)];
    const b = ready(u, add, plain);
    resolve(b, createRng(1), u, ab("banish"), cellOf(add), add.id);
    resolve(b, createRng(1), u, ab("banish"), cellOf(plain), plain.id);
    expect([add.dead, plain.dead]).toEqual([true, false]);
  });

  it("cost no MP after Pact of Blood", () => {
    const u = conjurer();
    const b = ready(u, foe());
    act(b, createRng(1), u, { do: "ability", ability: "pact_of_blood", target: cellOf(u) });
    const mp = u.mp;
    const b2 = ready(u, foe());
    act(b2, createRng(1), u, { do: "ability", ability: "call_crows", target: cellOf(u) });
    expect(u.mp).toBe(mp);
    expect(u.flags).not.toContain("free_summon");
  });

  it("start the battle with a free Crow under Familiar", () => {
    const u = { ...conjurer(), mods: { familiar: 1 } };
    const b = newBattle(1, [u, foe()]);
    advance(b, createRng(1));
    expect(owned(b, u).map((x) => x.summon)).toEqual(["carrion_crows"]);
  });

  it("fight in a battle the bots play to the end, and the party still loses when only summons stand", () => {
    const party = standardParty(1, 9, 1);
    party[3] = { ...party[3]!, abilities: ABILITY_SET_BY_JOB.get("conjurer")!.actives, gambits: [], mp: 500 };
    const b = newBattle(5, [...party, foe(10, 2), foe(11, 4), foe(12, 6)]);
    const summary = simulate(b);
    expect(summary.outcome).toBeDefined();
    expect(b.events.some((e) => e.t === "summon")).toBe(true);
    const lone = conjurer();
    const b2 = newBattle(1, [lone, foe()]);
    summon(b2, lone, "stone_sentinel");
    kill(b2, lone);
    advance(b2, createRng(1));
    expect(b2.outcome).toBe("defeat");
  });
});
