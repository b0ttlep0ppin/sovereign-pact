// The Ravager's Bloodlust and the Sword Saint's Swordplay (§12.12–12.13): costs paid in HP, drains,
// stolen Might, Frenzy, Unstoppable, Executioner, Hold Together, Deathless, Iaijutsu, Mirror Stance,
// Zenith Strike, Still Water and Sheathe.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { act, advance, ATTACK, cannotUse } from "./combat/battle.ts";
import { enemyCombatant, newBattle } from "./combat/build.ts";
import { heal } from "./combat/damage.ts";
import { standardParty } from "./combat/fixtures.ts";
import { hasStatus } from "./combat/grid.ts";
import { injure } from "./combat/injury.ts";
import { addStatus } from "./combat/status.ts";
import { cellOf } from "./combat/targets.ts";
import type { Battle, Combatant } from "./combat/types.ts";
import { ABILITY_SET_BY_JOB, ACTIVE_BY_ID } from "./content.ts";
import { TUNING } from "./tuning.ts";

const J = TUNING.combat.jobs;

/** A front-line Scion in `job` holding a sword, with every hit landing. */
function scion(job: "ravager" | "sword_saint", tp = 100): Combatant {
  const [u] = standardParty(1, 9, 1);
  return {
    ...u!,
    col: 0,
    row: 3,
    tp,
    mp: 80,
    weapon: { ...u!.weapon, kind: "sword", reach: "melee", hands: 2 },
    abilities: ABILITY_SET_BY_JOB.get(job)!.actives,
    flags: Array<string>(20).fill("sure_hit"),
    mods: {},
  };
}

const foe = (id = 10, row = 3): Combatant => ({ ...enemyCombatant("barrow_skeleton", { id, level: 3, col: 0, row }), hp: 9999, maxHp: 9999 });

function ready(u: Combatant, ...others: Combatant[]): Battle {
  const b = newBattle(1, [u, ...others]);
  b.actor = u.id;
  u.ct = 200;
  return b;
}

const use = (b: Battle, u: Combatant, ability: string, t: Combatant = u) => act(b, createRng(3), u, { do: "ability", ability, target: cellOf(t) });

describe("the Ravager", () => {
  it("pays Blood Price in HP, and cannot pay it with too little", () => {
    const u = scion("ravager", 0);
    const t = foe();
    const b = ready(u, t);
    const hp = u.hp;
    use(b, u, "blood_price", t);
    expect(u.hp).toBe(hp - Math.round(u.maxHp * 0.15));
    expect(u.tp).toBeGreaterThanOrEqual(0);
    expect(cannotUse({ ...u, hp: 1 }, ACTIVE_BY_ID.get("blood_price")!)).toBe("hp");
  });

  it("drinks half the damage back with Drink Deep", () => {
    const u = scion("ravager");
    u.hp = 10;
    const t = foe();
    const b = ready(u, t);
    use(b, u, "drink_deep", t);
    const dealt = b.events.find((e) => e.t === "hit" && e.unit === u.id);
    expect(dealt?.t === "hit" && u.hp).toBe(Math.min(u.maxHp, 10 + Math.round((dealt!.t === "hit" ? dealt!.damage : 0) / 2)));
  });

  it("Whirls through every enemy in reach", () => {
    const u = scion("ravager");
    const [a, c] = [foe(10, 1), foe(11, 6)];
    const b = ready(u, a, c);
    use(b, u, "whirl", a);
    expect(new Set(b.events.flatMap((e) => (e.t === "hit" && e.unit === u.id ? [e.target] : [])))).toEqual(new Set([10, 11]));
  });

  it("steals Might for 300 ticks: up on the Ravager, down on the target", () => {
    const u = scion("ravager");
    const t = foe();
    const b = ready(u, t);
    use(b, u, "steal_strength", t);
    expect(u.mods.mightPct).toBe(10);
    expect(t.mods.mightPct).toBe(-10);
    expect(hasStatus(t, "might_down")).toBe(true);
  });

  it("swings for 70 CT in a Frenzy, and cannot Defend", () => {
    const u = scion("ravager");
    const t = foe();
    let b = ready(u, t);
    use(b, u, "frenzy");
    expect(hasStatus(u, "frenzy")).toBe(true);
    b = ready(u, t);
    act(b, createRng(1), u, { do: "ability", ability: "attack", target: cellOf(t) });
    expect(u.ct).toBe(200 - (100 + 1 * -30));
    b = ready(u, t);
    act(b, createRng(1), u, { do: "defend" });
    expect(u.defending).toBeFalsy();
  });

  it("shrugs off Stun while Unstoppable", () => {
    const u = scion("ravager");
    const b = ready(u, foe());
    use(b, u, "unstoppable");
    expect(addStatus(b, u, "stun")).toBe(false);
    expect(u.mods.injurySteps).toBe(1);
  });

  it("always crits a Marked target with Executioner", () => {
    const u = scion("ravager");
    const t = foe();
    addStatus(newBattle(1, []), t, "marked", 200);
    const b = ready(u, t);
    use(b, u, "executioner", t);
    expect(b.events.some((e) => e.t === "hit" && e.unit === u.id && e.crit)).toBe(true);
  });

  it("caps healing at half HP after Hold Together", () => {
    const u = scion("ravager");
    u.hp = 1;
    const b = ready(u, foe());
    use(b, u, "hold_together");
    heal(b, u, u, { id: "big", shape: "single", side: "ally", power: 50, kind: "heal" });
    expect(u.hp).toBe(Math.round((u.maxHp * J.healCapPct) / 100));
  });

  it("turns the first Death of a battle into a Mortal wound once mastered", () => {
    const u = { ...scion("ravager"), resilience: 0, steps: 0, mods: { deathless: 1 } };
    const b = ready(u);
    injure(b, createRng(1), u, "head", -30);
    expect(u.dead).toBe(false);
    expect(u.lastStand).toBe(true);
    injure(b, createRng(1), u, "head", -30);
    expect(u.dead).toBe(true);
  });
});

describe("the Sword Saint", () => {
  it("pays no TP for the first sword technique of a battle with Iaijutsu", () => {
    const u = { ...scion("sword_saint", 30), mods: { iaijutsu: 1 } };
    const t = foe();
    let b = ready(u, t);
    use(b, u, "draw_cut", t);
    expect(u.tp).toBeGreaterThanOrEqual(30);
    const before = u.tp;
    b = ready(u, t);
    use(b, u, "draw_cut", t);
    expect(u.tp).toBeLessThan(before);
  });

  it("answers every melee hit in Mirror Stance, 20 TP each, until the next turn", () => {
    const u = scion("sword_saint", 50);
    const t = { ...foe(), flags: Array<string>(10).fill("sure_hit") };
    use(ready(u, t), u, "mirror_stance");
    let counters = 0;
    for (let i = 0; i < 3; i++) {
      const b = ready(t, u);
      act(b, createRng(i), t, { do: "ability", ability: "attack", target: cellOf(u) });
      // Each counter is the Sword Saint's hit on the skeleton; its TP is paid from what being hit gives.
      counters += b.events.filter((e) => e.t === "hit" && e.unit === u.id).length;
    }
    expect(counters).toBe(3);
    expect(hasStatus(u, "mirror_stance")).toBe(true);
    const b = newBattle(1, [u, t]);
    [u.ct, t.ct] = [100, 0];
    advance(b, createRng(1));
    expect(b.actor).toBe(u.id);
    expect(hasStatus(u, "mirror_stance")).toBe(false);
  });

  it("breaks even a boss's charge with Zenith Strike", () => {
    const u = scion("sword_saint");
    const t = { ...foe(), boss: true };
    t.charge = { ability: ATTACK, target: cellOf(u), ticks: 200 };
    const b = ready(u, t);
    use(b, u, "zenith_strike", t);
    expect(t.charge).toBeUndefined();
    expect(b.events.some((e) => e.t === "cancel" && e.unit === t.id)).toBe(true);
  });

  it("puts 20% more into the technique after Still Water", () => {
    const hitOf = (still: boolean) => {
      const u = scion("sword_saint");
      u.weapon = { ...u.weapon, crit: -100 };
      if (still) u.flags.push("still_water");
      const t = { ...foe(), defense: 0 };
      const b = ready(u, t);
      use(b, u, "crescent_cut", t);
      const hit = b.events.find((e) => e.t === "hit" && e.unit === u.id);
      return hit?.t === "hit" ? hit.damage : 0;
    };
    expect(hitOf(true) / hitOf(false)).toBeCloseTo(1 + J.stillWaterPct / 100, 1);
  });

  it("comes back 20 CT sooner after Sheathe", () => {
    const u = scion("sword_saint");
    const b = ready(u, foe());
    use(b, u, "sheathe");
    expect(u.ct).toBe(200 - 60 + 20);
  });
});
