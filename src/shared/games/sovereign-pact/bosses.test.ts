// Scripted bosses (§10.10, §14.6): the fight's opening (CT 30, adds), phases entered once and in order
// when their conditions hold, with new gambits and Speed, a dispel, regrown Parts, adds, flight, and lines.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { abilityOf, act, advance, checkEnd, resolve } from "./combat/battle.ts";
import { cellOf, resolveTargets, singleTargets } from "./combat/targets.ts";
import { bossBattle, bossDef } from "./combat/bosses.ts";
import { decide, holds } from "./combat/gambits.ts";
import { standardParty } from "./combat/fixtures.ts";
import { kill } from "./combat/injury.ts";
import { realParty, BASELINE } from "./combat/roster.ts";
import { simulate } from "./combat/sim.ts";
import { addStatus } from "./combat/status.ts";
import { affinityMult } from "./combat/damage.ts";
import { knownCondition } from "./combat/conditions.ts";
import { BOSS_BY_ID, ENEMY_BY_ID, type BossDef } from "./content.ts";

const vq = () => {
  const party = standardParty(1, 12);
  const b = bossBattle(1, party, "vampire_queen", 4);
  const queen = b.units.find((u) => u.enemy === "vampire_queen")!;
  const brides = b.units.filter((u) => u.enemy === "barrow_bride");
  return { b, party, queen, brides };
};

/** Registers a test-only boss built on the Queen. */
function testBoss(id: string, over: Partial<BossDef>): void {
  (BOSS_BY_ID as Map<string, BossDef>).set(id, { ...BOSS_BY_ID.get("vampire_queen")!, id, ...over });
  (ENEMY_BY_ID as Map<string, BossDef>).set(id, BOSS_BY_ID.get(id)!);
}

describe("a boss fight", () => {
  it("opens at CT 30 for everyone, with the boss's adds on their column and its opening line", () => {
    const { b, party, queen, brides } = vq();
    expect(queen.boss).toBe(true);
    expect(queen.speed).toBe(15);
    expect([queen, ...party, ...brides].every((u) => u.ct === 30)).toBe(true);
    expect(brides).toHaveLength(2);
    expect(brides.every((u) => u.col === 1 && u.tags.includes("add"))).toBe(true);
    expect(b.events.some((e) => e.t === "say" && e.line === "open")).toBe(true);
    // Bosses shrug off Charm and Sleep; their adds do not (§10.10).
    expect(addStatus(b, queen, "charm", 100)).toBe(false);
    expect(addStatus(b, queen, "stop", 100)).toBe(false);
    expect(addStatus(b, brides[0]!, "stop", 100)).toBe(true);
  });

  it("enters each phase once when its condition holds: new gambits, Speed, a dispel of the party's buffs", () => {
    const { b, party, queen } = vq();
    addStatus(b, party[0]!, "protect", 300);
    queen.hp = Math.round(queen.maxHp * 0.55);
    checkEnd(b);
    expect(queen.phase).toBe(1);
    expect(queen.speed).toBe(16);
    expect(queen.gambits[0]!.do).toBe("blood_rain");
    expect(party[0]!.statuses.some((s) => s.id === "protect")).toBe(false);
    checkEnd(b);
    expect(b.events.filter((e) => e.t === "phase")).toHaveLength(1);
    queen.hp = 1;
    checkEnd(b);
    expect(queen.phase).toBe(2);
    expect(queen.gambits.at(-1)!.do).toBe("last_dance");
  });

  it("goes through every phase it has passed at once, in order", () => {
    const { b, queen } = vq();
    queen.hp = 1;
    checkEnd(b);
    expect(b.events.filter((e) => e.t === "phase").map((e) => (e.t === "phase" ? e.phase : 0))).toEqual([1, 2]);
  });

  it("can only turn to mist while a Bride stands", () => {
    const { b, queen, brides } = vq();
    queen.hp = Math.round(queen.maxHp * 0.7);
    queen.turns = 2;
    expect(holds(b, queen, "adds>=1 && self.hp<0.8 && turn%2==0")).toBe(true);
    expect(decide(b, createRng(1), queen).action).toMatchObject({ ability: "mist_form" });
    for (const x of brides) kill(b, x);
    expect(decide(b, createRng(1), queen).action).not.toMatchObject({ ability: "mist_form" });
  });

  it("Charms the strongest Scion", () => {
    const { b, party, queen } = vq();
    queen.turns = 1;
    const strong = party.reduce((x, y) => (y.might > x.might ? y : x));
    const plan = decide(b, createRng(1), queen);
    expect(plan.action).toMatchObject({ ability: "beguile", target: { col: strong.col, row: strong.row } });
  });

  it("can flee, which wins the fight without a kill, and says its death line only when it dies", () => {
    testBoss("test_fleer", { phases: [{ at: "hp<=0.3 && !self.rooted", name: "Run", gambits: [{ do: "queens_kiss" }], flee: true, say: "Not today." }] });
    const b = bossBattle(2, standardParty(2, 12), "test_fleer", 4);
    const boss = b.units.find((u) => u.enemy === "test_fleer")!;
    for (const x of b.units.filter((u) => u.enemy === "barrow_bride")) kill(b, x);
    addStatus(b, boss, "rooted", 200);
    boss.hp = 10;
    checkEnd(b);
    expect(boss.dead).toBe(false);
    boss.statuses = [];
    checkEnd(b);
    expect(boss.dead).toBe(true);
    expect(b.events.some((e) => e.t === "flee")).toBe(true);
    expect(b.events.some((e) => e.t === "say" && e.line === "death")).toBe(false);
    expect(b.outcome).toBe("victory");
    expect(bossDef(boss)?.id).toBe("test_fleer");
  });

  it("regrows its Parts and calls adds in a later phase", () => {
    const dz = ENEMY_BY_ID.get("barrow_dragon_zombie")!;
    testBoss("test_grower", {
      size: [3, 3],
      parts: dz.parts,
      abilities: [...BOSS_BY_ID.get("vampire_queen")!.abilities, { id: "rot_breath", shape: "band:3", side: "player", power: 1 }],
      adds: [],
      phases: [{ at: "parts<1", name: "Again", gambits: [{ do: "queens_kiss" }], regrow: true, adds: { spawn: ["barrow_zombie"], count: 2, at: "E3" }, say: "Again." }],
    });
    const b = bossBattle(3, standardParty(3, 12), "test_grower", 4);
    const boss = b.units.find((u) => u.enemy === "test_grower")!;
    const part = b.units.find((u) => u.partOf === boss.id)!;
    kill(b, part);
    expect(boss.lost).toContain("rot_breath");
    checkEnd(b);
    expect(part.dead).toBe(false);
    expect(part.hp).toBe(part.maxHp);
    expect(boss.lost).toEqual([]);
    expect(b.units.filter((u) => u.enemy === "barrow_zombie" && u.col === 2)).toHaveLength(2);
  });

  it("is fought to the end by the bots, with its lines in the log", () => {
    const b = bossBattle(4, realParty(4, 12, BASELINE), "vampire_queen", 4);
    expect(simulate(b).outcome).toBeDefined();
    expect(b.events.some((e) => e.t === "say")).toBe(true);
  });
});

describe("the Goblin Lord", () => {
  const gl = () => {
    const b = bossBattle(3, standardParty(3, 6), "goblin_lord", 1);
    const lord = b.units.find((u) => u.enemy === "goblin_lord")!;
    const goblins = b.units.filter((u) => u.enemy === "beast_goblin");
    return { b, lord, goblins };
  };

  it("hangs back on E3 behind four goblins on E1", () => {
    const { lord, goblins } = gl();
    expect(lord.col).toBe(2);
    expect(goblins).toHaveLength(4);
    expect(goblins.every((u) => u.col === 0 && u.tags.includes("add"))).toBe(true);
  });

  it("is Cornered once its goblins are down to one, or at half health (either condition)", () => {
    const { b, lord, goblins } = gl();
    expect(holds(b, lord, "adds<2 || hp<=0.5")).toBe(false);
    for (const x of goblins.slice(0, 3)) kill(b, x);
    checkEnd(b);
    expect(lord.phase).toBe(1);
    expect(lord.speed).toBe(16);
    const fresh = gl();
    fresh.lord.hp = Math.floor(fresh.lord.maxHp * 0.5);
    checkEnd(fresh.b);
    expect(fresh.lord.phase).toBe(1);
  });

  it("runs at 30% unless rooted, and the fight is won when his goblins are gone", () => {
    const { b, lord, goblins } = gl();
    for (const x of goblins) kill(b, x);
    lord.hp = Math.floor(lord.maxHp * 0.25);
    checkEnd(b);
    expect(lord.dead).toBe(true);
    expect(b.events.some((e) => e.t === "flee")).toBe(true);
    expect(b.outcome).toBe("victory");
  });
});

describe("the Ancient Tree King", () => {
  const tk = () => {
    const b = bossBattle(5, standardParty(5, 6), "tree_king", 2);
    const king = b.units.find((u) => u.enemy === "tree_king" && u.partOf === undefined)!;
    const limbs = b.units.filter((u) => u.partOf === king.id);
    return { b, king, limbs };
  };

  it("fills the enemy grid's width, two limbs on its front corners, two Sprouts beside it, and burns twice over", () => {
    const { b, king, limbs } = tk();
    expect([king.col, king.size[0], king.size[1]]).toEqual([0, 3, 4]);
    expect(limbs.map((l) => [l.part, l.row - king.row])).toEqual([["upper_limb", 0], ["lower_limb", 3]]);
    expect(b.units.filter((u) => u.enemy === "hollow_sprout")).toHaveLength(2);
    expect(affinityMult(king, "fire")).toBe(2);
  });

  it("loses a quarter of its damage for each limb destroyed, and regrows them (and the damage) at a third", () => {
    const { b, king, limbs } = tk();
    kill(b, limbs[0]!);
    expect(king.mods.damagePct).toBe(-25);
    kill(b, limbs[1]!);
    expect(king.mods.damagePct).toBe(-50);
    king.hp = Math.floor(king.maxHp * 0.3);
    checkEnd(b);
    expect(king.phase).toBe(2);
    expect(limbs.every((l) => !l.dead)).toBe(true);
    expect(king.mods.damagePct).toBeUndefined();
    expect(b.units.filter((u) => u.enemy === "hollow_sprout").length).toBe(6);
  });
});

describe("conditions the content may use", () => {
  it("are recognized, and anything else is caught by the content lint", () => {
    expect(knownCondition("adds<2 || hp<=0.5")).toBe(true);
    expect(knownCondition("hp<=0.3 && !self.rooted")).toBe(true);
    expect(knownCondition("foe.rooted")).toBe(true);
    expect(knownCondition("turn % 3 == 0")).toBe(true);
    expect(knownCondition("hp<half")).toBe(false);
    expect(knownCondition("turn%3==1 && whenever")).toBe(false);
  });
});

describe("Scylla", () => {
  const sc = () => {
    const b = bossBattle(7, standardParty(7, 12), "scylla", 4);
    const scylla = b.units.find((u) => u.enemy === "scylla")!;
    const kelpies = b.units.filter((u) => u.enemy === "marsh_kelpie");
    return { b, scylla, kelpies };
  };

  it("comes with two Kelpies beside her on E1, and a Kelpie's drag pulls a Back Scion to the Front", () => {
    const { b, kelpies } = sc();
    expect(kelpies).toHaveLength(2);
    expect(kelpies.every((k) => k.col === 0)).toBe(true);
    const back = b.units.find((u) => u.side === "party" && u.col === 2)!;
    const drag = { ...abilityOf(kelpies[0]!, "drag_under")!, accuracy: 999 };
    for (const u of b.units.filter((x) => x.side === "party" && x.row === back.row && x !== back)) u.row = (u.row + 3) % 8;
    resolve(b, createRng(1), kelpies[0]!, drag, cellOf(back));
    expect(back.col).toBe(0);
  });

  it("dives at half health: nothing can pick her or catch her in an area until she surfaces, and a Kelpie joins her", () => {
    const { b, scylla, kelpies } = sc();
    scylla.hp = Math.floor(scylla.maxHp * 0.5);
    checkEnd(b);
    expect(scylla.phase).toBe(1);
    expect(scylla.statuses.some((s) => s.id === "submerged")).toBe(true);
    expect(b.units.filter((u) => u.enemy === "marsh_kelpie" && !u.dead).length).toBe(kelpies.length + 1);
    const scion = b.units.find((u) => u.side === "party")!;
    const shot = { id: "test_shot", shape: "single", side: "foe", power: 1, reach: "ranged" } as const;
    expect(singleTargets(b, scion, shot)).not.toContain(scylla);
    const blast = { id: "test_blast", shape: "burst:3x3", side: "foe", power: 1 } as const;
    expect(resolveTargets(b, createRng(1), scion, blast, cellOf(scylla))).not.toContain(scylla);
  });
});

describe("the Dark General", () => {
  const dg = () => {
    const b = bossBattle(9, standardParty(9, 21), "dark_general", 7);
    const general = b.units.find((u) => u.enemy === "dark_general")!;
    const elite = b.units.find((u) => u.enemy === "pit_elite_demon")!;
    const gunner = b.units.find((u) => u.enemy === "pit_demon_gunner")!;
    return { b, general, elite, gunner };
  };

  it("stands in formation: his Elite in front of him on E1, his Gunner behind on E3", () => {
    const { general, elite, gunner } = dg();
    expect([elite.col, general.col, gunner.col]).toEqual([0, 1, 2]);
    expect(elite.row).toBe(general.row);
    expect(gunner.row).toBe(general.row);
  });

  it("gives the Infernal Order at half: Quickened allies pay half the CT for an action", () => {
    const { b, general, gunner } = dg();
    general.hp = Math.floor(general.maxHp * 0.5);
    checkEnd(b);
    expect(general.phase).toBe(1);
    expect(general.gambits[0]!.do).toBe("infernal_order");
    addStatus(b, gunner, "quickened", 300);
    const rng = createRng(4);
    for (const x of b.units) x.ct = x === gunner ? 100 : 0;
    expect(advance(b, rng)).toBe(gunner);
    const before = gunner.ct;
    act(b, rng, gunner, decide(b, rng, gunner).action);
    expect(before - gunner.ct).toBe(50);
  });
});

describe("the Stone Colossus", () => {
  const sc = () => {
    const b = bossBattle(11, standardParty(11, 15), "stone_colossus", 5);
    const colossus = b.units.find((u) => u.enemy === "stone_colossus" && u.partOf === undefined)!;
    const part = (id: string) => b.units.find((u) => u.partOf === colossus.id && u.part === id)!;
    return { b, colossus, part };
  };

  it("breaking the core while it charges Earthquake stops the quake for good", () => {
    const { b, colossus, part } = sc();
    colossus.charge = { ability: abilityOf(colossus, "earthquake")!, target: { side: "party", col: 0, row: 0 }, ticks: 300 };
    kill(b, part("colossus_core"));
    expect(colossus.charge).toBeUndefined();
    expect(colossus.lost).toContain("earthquake");
    expect(b.events.some((e) => e.t === "cancel" && e.unit === colossus.id)).toBe(true);
  });

  it("drops to one knee when a fist breaks, slower and with its Head open to aimed blows", () => {
    const { b, colossus, part } = sc();
    expect(colossus.weak).toBeUndefined();
    kill(b, part("left_fist"));
    checkEnd(b);
    expect(colossus.phase).toBe(1);
    expect(colossus.speed).toBe(5);
    expect(colossus.weak).toEqual({ location: "head", mult: 1.5 });
    expect(holds(b, colossus, "lost.left_slam && !lost.right_slam")).toBe(true);
  });
});

describe("the Village Evil God", () => {
  const veg = () => {
    const b = bossBattle(13, standardParty(13, 18), "village_evil_god", 6);
    const god = b.units.find((u) => u.enemy === "village_evil_god")!;
    const villagers = () => b.units.filter((u) => u.enemy === "city_fanatical_villager" && !u.dead);
    return { b, god, villagers };
  };
  const sanityLost = (villagersAlive: number) => {
    const { b, god, villagers } = veg();
    for (const v of villagers().slice(villagersAlive)) kill(b, v);
    const t = b.units.find((u) => u.side === "party" && u.col === 2)!;
    const before = t.sanity;
    resolve(b, createRng(1), god, { ...abilityOf(god, "gaze")!, accuracy: 999 }, cellOf(t));
    return before - t.sanity;
  };

  it("hits Sanity harder for each villager still standing", () => {
    expect(sanityLost(4) - sanityLost(0)).toBe(4);
  });

  it("turns a villager into a Flesh Mass at 30%", () => {
    const { b, god, villagers } = veg();
    god.hp = Math.floor(god.maxHp * 0.25);
    checkEnd(b);
    expect(god.phase).toBe(2);
    expect(b.units.some((u) => u.flags.includes("transformed"))).toBe(true);
    expect(b.units.filter((u) => u.enemy === "city_flesh_mass" && !u.dead)).toHaveLength(1);
    expect(villagers()).toHaveLength(5);
  });
});

describe("Divine Beast Fusion", () => {
  it("takes one element at a time, immune to it and twice as weak to its opposite", () => {
    const b = bossBattle(15, standardParty(15, 30), "divine_beast_fusion", 10);
    const fusion = b.units.find((u) => u.enemy === "divine_beast_fusion")!;
    const form = () => [affinityMult(fusion, "fire"), affinityMult(fusion, "water"), affinityMult(fusion, "earth"), affinityMult(fusion, "wind"), affinityMult(fusion, "dark"), affinityMult(fusion, "holy")];
    expect(form()).toEqual([0, 2, 1, 1, 1, 1]);
    fusion.hp = Math.floor(fusion.maxHp * 0.6);
    checkEnd(b);
    expect(form()).toEqual([1, 1, 0, 2, 1, 1]);
    fusion.hp = Math.floor(fusion.maxHp * 0.3);
    checkEnd(b);
    expect(form()).toEqual([1, 1, 1, 1, 0, 2]);
  });
});
