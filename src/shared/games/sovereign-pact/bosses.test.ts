// Scripted bosses (§10.10, §14.6): the fight's opening (CT 30, adds), phases entered once and in order
// when their conditions hold, with new gambits and Speed, a dispel, regrown Parts, adds, flight, and lines.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { checkEnd } from "./combat/battle.ts";
import { bossBattle, bossDef } from "./combat/bosses.ts";
import { decide, holds } from "./combat/gambits.ts";
import { standardParty } from "./combat/fixtures.ts";
import { kill } from "./combat/injury.ts";
import { realParty, BASELINE } from "./combat/roster.ts";
import { simulate } from "./combat/sim.ts";
import { addStatus } from "./combat/status.ts";
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
