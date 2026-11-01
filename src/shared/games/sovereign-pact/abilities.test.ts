// Job abilities (§12.1, §12.4–12.9): buying them with JP, mastering a Job, the passive budget, the
// secondary set, and every active that works in battle resolving without trouble.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { cannotUse, resolve } from "./combat/battle.ts";
import { enemyCombatant, newBattle, scionCombatant } from "./combat/build.ts";
import { spellBase } from "./combat/damage.ts";
import { standardParty } from "./combat/fixtures.ts";
import { addStatus } from "./combat/status.ts";
import { shift } from "./combat/forms.ts";
import { cellOf, singleTargets } from "./combat/targets.ts";
import type { AbilityDef, Combatant } from "./combat/types.ts";
import { ABILITY_SETS, ABILITY_SET_BY_JOB } from "./content.ts";
import { promote, rollRecruit } from "./generate.ts";
import { battleActives, equipPassive, gainJp, jpLeft, knows, learn, passiveBudget, setSecondary } from "./progression.ts";
import type { Person } from "./state.ts";

const soldier = (): Person => promote(rollRecruit(createRng(1), 1, 0), "soldier");

describe("buying abilities (§12.1)", () => {
  it("spends the primary Job's JP, and only on that Job", () => {
    const p = gainJp(soldier(), 120);
    const q = learn(p, "heavy_blow");
    expect(knows(q, "heavy_blow")).toBe(true);
    expect(jpLeft(q, "soldier")).toBe(70);
    expect(q.jp.soldier).toBe(120);
    expect(() => learn(q, "savage_strikes")).toThrow(/JP/);
    expect(() => learn(q, "ember")).toThrow(/not in/);
    expect(() => learn(q, "heavy_blow")).toThrow(/already/);
  });

  it("masters the Job when its last ability is bought", () => {
    const set = ABILITY_SET_BY_JOB.get("soldier")!;
    let p = gainJp(soldier(), 10_000);
    for (const a of [...set.actives, ...set.passives]) p = learn(p, a.id);
    expect(p.mastered).toContain("soldier");
    expect(p.learned).toEqual([]);
    expect(knows(p, "finisher")).toBe(true);
    expect(jpLeft(p, "soldier")).toBe(0);
  });

  it("fits equipped passives in the budget", () => {
    let p = gainJp(soldier(), 10_000);
    for (const id of ["weapon_drill", "battle_hardened", "skullsplitter", "grizzled"]) p = learn(p, id);
    p = equipPassive(equipPassive(p, "weapon_drill"), "battle_hardened");
    p = equipPassive(p, "skullsplitter");
    expect(passiveBudget(p)).toBe(5);
    expect(() => equipPassive(p, "grizzled")).toThrow(/budget/);
    expect(() => equipPassive(p, "cutthroat")).toThrow(/not bought/);
  });

  it("takes a secondary set only from a Job with an active bought", () => {
    let p = gainJp(soldier(), 200);
    expect(() => setSecondary(p, "magus")).toThrow();
    p = { ...p, job: "magus", jp: { ...p.jp, magus: 100 } };
    p = learn(p, "ember");
    p = { ...p, job: "soldier" };
    p = setSecondary(learn(p, "heavy_blow"), "magus");
    expect(battleActives(p).map((a) => a.id).sort()).toEqual(["ember", "heavy_blow"]);
    const c = scionCombatant({ ...p, passives: [] }, { id: 1, col: 0, row: 3 });
    expect(c.abilities.map((a) => a.id)).toContain("ember");
  });
});

describe("abilities in battle", () => {
  const scion = (id: number, row: number, extra: Partial<Combatant> = {}): Combatant => {
    const [u] = standardParty(id, 9, id);
    return { ...u!, id, col: 0, row, mp: 999, maxMp: 999, tp: 100, ...extra };
  };
  const foe = (id: number, row: number, kind = "barrow_skeleton") => ({ ...enemyCombatant(kind, { id, level: 3, col: 0, row }), evasion: 0 });
  const field = () => {
    const u = scion(1, 3);
    const ally = scion(2, 4);
    return { u, ally, b: newBattle(9, [u, ally, foe(10, 3), foe(11, 4)]) };
  };
  const target = (b: ReturnType<typeof field>["b"], u: Combatant, ab: AbilityDef) => {
    if (ab.side === "self") return { cell: cellOf(u), on: u.id };
    const t = ab.shape === "single" ? singleTargets(b, u, ab)[0] : b.units.find((x) => x.side === (ab.side === "foe" ? "enemy" : "party") && x.id !== u.id);
    return { cell: cellOf(t!), on: t!.id };
  };

  it.each(ABILITY_SETS.flatMap((s) => s.actives.filter((a) => !a.later).map((a) => [s.job, a.id, a] as const)))("%s %s resolves", (_, __, ab) => {
    const { u, b } = field();
    const weapon = ab.requires?.find((w) => w !== "shield");
    if (weapon) u.weapon = { ...u.weapon, kind: weapon };
    if (ab.requires?.includes("shield")) u.offhand = "shield";
    u.parts = [...(ab.parts ?? [])];
    if (ab.revert || ab.graft) shift(b, u, "werewolf");
    // Finishers are only played at the end of a combo (combos.test.ts).
    expect(cannotUse(u, ab)).toBe(ab.move?.finisher ? "finisher" : null);
    const { cell, on } = target(b, u, ab);
    expect(() => resolve(b, createRng(3), u, ab, cell, on)).not.toThrow();
    expect(b.events.some((e) => e.t === "use" && e.ability === ab.id)).toBe(true);
  });

  const ab = (id: string) => ABILITY_SETS.flatMap((s) => s.actives).find((a) => a.id === id)!;

  it("needs the weapon or shield it names", () => {
    const { u } = field();
    expect(cannotUse(u, ab("shield_bash"))).toMatch(/shield/);
    expect(cannotUse({ ...u, offhand: "shield" }, ab("shield_bash"))).toBeNull();
    expect(cannotUse(u, ab("volley"))).toMatch(/bow/);
  });

  it("support restores, cures, grants and revives", () => {
    const { u, ally, b } = field();
    ally.tp = 0;
    resolve(b, createRng(1), u, ab("rally"), cellOf(u));
    expect(ally.tp).toBe(15);
    ally.dur!.arms = 1;
    resolve(b, createRng(1), u, ab("knit_bone"), cellOf(ally), ally.id);
    expect(ally.dur!.arms).toBeGreaterThan(1);
    addStatus(b, ally, "poison");
    resolve(b, createRng(1), u, ab("purify"), cellOf(ally), ally.id);
    expect(ally.statuses.some((s) => s.id === "poison")).toBe(false);
    Object.assign(ally, { down: true, hp: 0 });
    resolve(b, createRng(1), u, ab("breath_of_life"), cellOf(ally), ally.id);
    expect(ally.down).toBe(false);
    expect(ally.hp).toBe(Math.round(ally.maxHp * 0.2));
  });

  it("Coup de Grâce finishes the weak, Judgement smites the undead, Savage Strikes hits 2–4 times", () => {
    const { u, b } = field();
    const weak = b.units.find((x) => x.id === 10)!;
    weak.hp = Math.floor(weak.maxHp * 0.1);
    resolve(b, createRng(1), u, ab("coup_de_grace"), cellOf(weak), weak.id);
    expect(weak.dead).toBe(true);
    const hitOn = (tags: string[]) => {
      const f = field();
      const t = f.b.units.find((x) => x.id === 10)!;
      t.tags = tags;
      Object.assign(t, { hp: 9999, maxHp: 9999 });
      resolve(f.b, createRng(5), f.u, { ...ab("judgement"), crit: -100 }, cellOf(t), t.id);
      return f.b.events.find((e) => e.t === "hit")!;
    };
    expect((hitOn(["undead"]) as { damage: number }).damage).toBeGreaterThan((hitOn([]) as { damage: number }).damage);
    for (let seed = 1; seed < 20; seed++) {
      const f = field();
      const t = f.b.units.find((x) => x.id === 10)!;
      Object.assign(t, { hp: 9999, maxHp: 9999 });
      resolve(f.b, createRng(seed), f.u, ab("savage_strikes"), cellOf(t), t.id);
      // Hits and misses: the hit chance tops out at 95%.
      const hits = f.b.events.filter((e) => (e.t === "hit" || e.t === "miss") && e.unit === f.u.id).length;
      expect(hits).toBeGreaterThanOrEqual(2);
      expect(hits).toBeLessThanOrEqual(4);
    }
  });

  it("gives Scions' spells the power of their level", () => {
    expect(spellBase(30)).toBeGreaterThan(spellBase(9));
    expect(spellBase(3)).toBeCloseTo(9.1);
  });
});
