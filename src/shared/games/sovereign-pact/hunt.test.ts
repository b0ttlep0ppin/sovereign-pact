// Hunts and the bestiary (§14.9, §14.3): named quarries in their Lairs, trophies, and kills counted.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { encounter } from "./combat/encounter.ts";
import { enemyCombatant } from "./combat/build.ts";
import { ENEMY_BY_ID, POOL_BY_ID, POOLS, QUARRIES, QUARRY_BY_ID } from "./content.ts";
import { muster } from "./expedition.ts";
import { offer } from "./gate.ts";
import { quarryFor, tally, withLair } from "./hunt.ts";
import { pressOn, rollChain } from "./journey.ts";
import { levelUp } from "./progression.ts";
import type { SovState } from "./state.ts";
import { calm, campaign } from "./testing.ts";
import { TUNING } from "./tuning.ts";

const H = TUNING.hunt;

function hunting(quarry = "old_scar", level = 3): SovState {
  const s = calm(campaign(2, 6));
  s.phase = "expedition";
  muster(s, { type: "hunt", pool: ENEMY_BY_ID.get(QUARRY_BY_ID.get(quarry)!.enemy)!.pool, level, size: 4, quarry });
  const e = s.expedition!;
  e.party = [0, 1].map((h) => s.people.filter((p) => p.host === h && p.status === "scion").slice(0, 2).map((p) => p.id));
  e.leader = e.party[0]![0]!;
  return s;
}

describe("the quarries' content", () => {
  it.each(QUARRIES.map((q) => [q.id, q] as const))("%s is an enemy of a pool that deals Hunt cards", (_, q) => {
    const e = ENEMY_BY_ID.get(q.enemy);
    expect(e, q.enemy).toBeDefined();
    expect(POOL_BY_ID.get(e!.pool)!.cards).toContain("hunt");
  });

  it("every pool that deals Hunt cards has quarries", () => {
    for (const p of POOLS.filter((x) => x.cards.includes("hunt"))) expect(QUARRIES.some((q) => ENEMY_BY_ID.get(q.enemy)!.pool === p.id), p.id).toBe(true);
  });
});

describe("Hunt cards", () => {
  it("name a quarry of their pool near their level", () => {
    let seen = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = campaign(2, seed);
      s.year = 1 + (seed % 19);
      for (const c of offer(s).filter((x) => x.type === "hunt" && !x.arcana)) {
        // An Arcana's Hunt card (7i) hunts the Arcana, not a quarry.
        expect(c.quarry, `${c.pool} L${c.level}`).toBeDefined();
        expect(ENEMY_BY_ID.get(QUARRY_BY_ID.get(c.quarry!)!.enemy)!.pool).toBe(c.pool);
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("turn one Encounter into the Lair, or put one before the boss", () => {
    const rng = createRng(3);
    const chain = withLair(rng, ["event", "encounter", "encounter", "boss"]);
    expect(chain.filter((k) => k === "lair")).toHaveLength(1);
    expect(chain.filter((k) => k === "encounter")).toHaveLength(1);
    expect(withLair(rng, ["event", "camp", "boss"])).toEqual(["event", "camp", "lair", "boss"]);
    const s = hunting();
    expect(rollChain(s).filter((k) => k === "lair")).toHaveLength(1);
  });

  it("a slain quarry is never named again", () => {
    const s = calm(campaign(2, 1));
    const rng = createRng(1);
    const left = QUARRIES.filter((q) => ENEMY_BY_ID.get(q.enemy)!.pool === "beast_lands").map((q) => q.id);
    for (const id of left.slice(1)) s.bestiary.quarries[id] = [0];
    for (let i = 0; i < 10; i++) expect(quarryFor(s, rng, "beast_lands", 3)).toBe(left[0]);
    s.bestiary.quarries[left[0]!] = [1];
    expect(quarryFor(s, rng, "beast_lands", 3)).toBeUndefined();
  });
});

describe("the Lair", () => {
  const lair = (id: string, seed = 1) => {
    const q = QUARRY_BY_ID.get(id)!;
    return encounter(createRng(seed), { pool: ENEMY_BY_ID.get(q.enemy)!.pool, level: 4, party: 4, quarry: { enemy: q.enemy, title: q.title, ability: q.ability } });
  };

  it("is led by the quarry: titled, a level up, half again its HP", () => {
    const { enemies } = lair("old_scar");
    const lead = enemies.find((u) => u.name === "Old Scar, the Sacred Bull")!;
    expect(lead.enemy).toBe("beast_sacred_bull");
    expect(lead.level).toBe(4 + H.levelUp);
    const plain = enemyCombatant("beast_sacred_bull", { id: 1, level: 4 + H.levelUp, col: 0, row: 0 });
    expect(lead.maxHp).toBe(Math.round((plain.maxHp * H.hpPct) / 100));
    expect(lead.statuses.some((x) => x.id === "enrage")).toBe(true);
  });

  it("an Ambusher's Lair opens with an ambush; a pack leader brings more kin", () => {
    expect(lair("the_striped_blade").modifier).toBe("ambush");
    const count = (id: string) => Array.from({ length: 20 }, (_, i) => lair(id, i + 1).enemies.filter((u) => u.partOf === undefined && !u.hazard).length).reduce((a, b) => a + b, 0);
    expect(count("the_tusked_mountain")).toBeGreaterThan(count("old_scar"));
  });

  it("pays its trophy when the quarry falls", () => {
    const s = hunting("old_scar", 1);
    for (const p of s.people) while (p.status === "scion" && p.level < 20) Object.assign(p, levelUp(p));
    s.expedition!.chain = ["lair", "boss"];
    const valor = s.houses.map((h) => h.score.valor);
    pressOn(s);
    const q = QUARRY_BY_ID.get("old_scar")!;
    expect(s.bestiary.quarries.old_scar).toEqual([0, 1]);
    // The trophy's Valor, on top of what any won battle pays.
    for (const [i, h] of s.houses.entries()) expect(h.score.valor - valor[i]!).toBe(q.trophy.valor + 2 * TUNING.journey.valor.battle);
    expect(s.expedition!.haul!.stores.grain).toBeGreaterThanOrEqual(q.trophy.stores!.grain!);
    expect(s.log.some((l) => l.includes("Old Scar, the Sacred Bull is slain"))).toBe(true);
  });
});

describe("the bestiary", () => {
  it("counts kills, and a first kill is an entry: Lore for each House in the fight", () => {
    const s = calm(campaign(2, 2));
    const dead = (enemy: string, id: number) => ({ ...enemyCombatant(enemy, { id, level: 2, col: 0, row: 0 }), dead: true });
    const b = { units: [dead("beast_goblin", 101), dead("beast_goblin", 102), dead("beast_orc", 103)] } as Parameters<typeof tally>[1];
    const lore = s.houses.map((h) => h.score.lore);
    tally(s, b, [0]);
    expect(s.bestiary.kills).toEqual({ beast_goblin: 2, beast_orc: 1 });
    expect(s.houses[0]!.score.lore - lore[0]!).toBe(2 * H.lorePerEntry);
    expect(s.houses[1]!.score.lore).toBe(lore[1]);
    tally(s, b, [0, 1]);
    expect(s.bestiary.kills.beast_goblin).toBe(4);
    expect(s.houses[1]!.score.lore).toBe(lore[1]);
  });
});
