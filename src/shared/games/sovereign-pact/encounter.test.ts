// Encounter groups (§14.4): templates by level and weight, roles filled from the pool's roster at the
// level, placement by role, the counts for 4- and 8-parties, and the Ambush and Surprise openings.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { applyModifier, drawTemplate, encounter, encounterBattle, fill, place, rolesFor, rosterFor, templatesAt } from "./combat/encounter.ts";
import { standardParty } from "./combat/fixtures.ts";
import { simulate } from "./combat/sim.ts";
import { ENEMY_BY_ID, POOLS, TEMPLATE_BY_ID, TEMPLATES } from "./content.ts";

const t = (id: string) => TEMPLATE_BY_ID.get(id)!;

describe("encounter templates", () => {
  it("allow Patrols only at L1–4 and Stalkers and Behemoths from L3", () => {
    expect(templatesAt(1).map((x) => x.id)).toContain("patrol");
    expect(templatesAt(5).map((x) => x.id)).not.toContain("patrol");
    expect(templatesAt(2).map((x) => x.id)).not.toContain("stalkers");
    expect(templatesAt(3).map((x) => x.id)).toEqual(expect.arrayContaining(["stalkers", "behemoth"]));
    expect(templatesAt(1).map((x) => x.id)).not.toContain("elite_patrol");
  });

  it("are drawn by weight", () => {
    const rng = createRng(7);
    const n: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) {
      const id = drawTemplate(rng, 5).id;
      n[id] = (n[id] ?? 0) + 1;
    }
    expect(n.warband! / 4000).toBeGreaterThan(0.25);
    expect(n.warband! / 4000).toBeLessThan(0.38);
    expect(n.stalkers! / 4000).toBeLessThan(0.1);
  });

  it("keep §9.8's counts: 2–6 enemies for a 4-party and 4–10 for an 8-party, a swarm entity counting half", () => {
    const rng = createRng(3);
    for (const tpl of TEMPLATES) {
      for (let i = 0; i < 20; i++) {
        for (const [party, lo, hi] of [[4, 2, 6], [8, 4, 10]] as const) {
          const roles = rolesFor(rng, tpl, party);
          const weight = roles.reduce((n, r) => n + (r === "swarm" ? 0.5 : 1), 0);
          expect(weight, `${tpl.id} ${party}`).toBeGreaterThanOrEqual(lo);
          expect(weight, `${tpl.id} ${party}`).toBeLessThanOrEqual(hi);
        }
      }
    }
  });

  it("draw a swarm's count from its range", () => {
    const rng = createRng(1);
    const counts = new Set(Array.from({ length: 60 }, () => rolesFor(rng, t("swarm"), 4).filter((r) => r === "swarm").length));
    expect([...counts].sort()).toEqual([4, 5, 6]);
  });
});

describe("filling and placing a group", () => {
  it("fills each role from the pool's entries at the level, different ones first", () => {
    const got = fill(createRng(2), "barrows", 3, ["lurker", "lurker"]);
    expect(got.map((e) => e.role)).toEqual(["lurker", "lurker"]);
    expect(new Set(got.map((e) => e.id)).size).toBe(2);
    for (const e of got) expect(e.levels[0] <= 3 && 3 <= e.levels[1]).toBe(true);
  });

  it("stands another role in where the pool has none at the level", () => {
    expect(rosterFor("barrows", "fodder", 3).every((e) => e.role === "fodder")).toBe(true);
    const caster = rosterFor("barrows", "caster", 3);
    expect(caster.length).toBeGreaterThan(0);
    expect(caster.every((e) => e.role !== "caster")).toBe(true);
  });

  it("puts fodder and bruisers on E1 and artillery on E3, centered on the middle rows, never overlapping", () => {
    const defs = ["barrow_skeleton", "barrow_hollow_soldier", "barrow_cursed_archer", "barrow_ghost"].map((id) => ENEMY_BY_ID.get(id)!);
    const units = place(defs, 3);
    const at = (id: string) => units.find((u) => u.enemy === id)!;
    expect(at("barrow_skeleton").col).toBe(0);
    expect(at("barrow_hollow_soldier").col).toBe(0);
    expect(at("barrow_cursed_archer").col).toBe(2);
    expect(at("barrow_ghost").col).toBe(1);
    expect([3, 4]).toContain(at("barrow_skeleton").row);
    const cells = units.map((u) => `${u.col},${u.row}`);
    expect(new Set(cells).size).toBe(cells.length);
    expect(units.map((u) => u.id)).toEqual([101, 102, 103, 104]);
  });

  it("builds every allowed template for every level of a pool with enemies", () => {
    for (const pool of POOLS.filter((p) => p.id === "barrows")) {
      for (let level = pool.levels[0]; level <= pool.levels[1]; level++) {
        for (const tpl of templatesAt(level)) {
          const e = encounter(createRng(level), { pool: pool.id, level, party: 4, template: tpl.id, modifier: null });
          expect(e.enemies.length, `${tpl.id} L${level}`).toBeGreaterThanOrEqual(2);
          expect(e.enemies.every((u) => u.level === level)).toBe(true);
        }
      }
    }
  });
});

describe("openings", () => {
  it("Ambush: the party at CT 0, the enemy at 50, lurkers with a free first turn; Surprise the reverse", () => {
    const party = standardParty(1, 9);
    const { enemies } = encounter(createRng(1), { pool: "barrows", level: 3, party: 4, template: "warband", modifier: null });
    const all = [...party, ...enemies];
    applyModifier(all, "ambush");
    expect(party.every((u) => u.ct === 0)).toBe(true);
    expect(enemies.filter((u) => u.role !== "lurker").every((u) => u.ct === 50)).toBe(true);
    expect(enemies.filter((u) => u.role === "lurker").every((u) => u.ct === 100)).toBe(true);
    applyModifier(all, "surprise");
    expect(party.every((u) => u.ct === 50)).toBe(true);
    expect(enemies.every((u) => u.ct === 0)).toBe(true);
  });

  it("are rolled at the base odds, doubled for Stalkers", () => {
    const count = (template: string) => {
      let n = 0;
      for (let i = 0; i < 2000; i++) if (encounter(createRng(i), { pool: "barrows", level: 5, party: 4, template }).modifier === "ambush") n++;
      return n / 2000;
    };
    expect(count("warband")).toBeGreaterThan(0.06);
    expect(count("warband")).toBeLessThan(0.14);
    expect(count("stalkers")).toBeGreaterThan(0.15);
  });

  it("make a battle the bots play to the end", () => {
    const { battle, encounter: e } = encounterBattle(5, standardParty(5, 9), { pool: "barrows", level: 3, template: "coven", modifier: "ambush" });
    expect(e.template).toBe("coven");
    expect(simulate(battle).outcome).toBeDefined();
  });
});
