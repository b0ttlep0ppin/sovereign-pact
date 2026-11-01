// Enemy role behaviors (§14.3): a lurker's leap into the formation and its exposure there, the swarm's
// overrun, the necromancer's raise, a bruiser's aim at the weakest location, and casters on the densest row.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { advance, cannotUse, resolve } from "./combat/battle.ts";
import { enemyCombatant, newBattle } from "./combat/build.ts";
import { encounterBattle } from "./combat/encounter.ts";
import { standardParty } from "./combat/fixtures.ts";
import { aim, choose, decide, holds } from "./combat/gambits.ts";
import { hasStatus } from "./combat/grid.ts";
import { kill } from "./combat/injury.ts";
import { simulate } from "./combat/sim.ts";
import { cellOf, singleTargets } from "./combat/targets.ts";
import type { Combatant } from "./combat/types.ts";

const foe = (id: string, n: number, col: number, row: number, level = 5): Combatant => enemyCombatant(`barrow_${id}`, { id: n, level, col, row });
const ab = (u: Combatant, id: string) => u.abilities.find((a) => a.id === id)!;

describe("lurkers", () => {
  it("leap at the Back past the Front, then stand Exposed to every Scion's melee until their next turn", () => {
    const party = standardParty(1, 15);
    const d = { ...foe("dullahan", 10, 1, 0), hp: 9999, maxHp: 9999 };
    const blocker = foe("dead_soldier", 11, 0, 4);
    const b = newBattle(1, [...party, d, blocker]);
    const back = party.find((u) => u.col === 2)!;
    const leap = ab(d, "headless_charge");
    expect(singleTargets(b, d, leap)).toContain(back);
    resolve(b, createRng(1), d, leap, cellOf(back));
    expect(hasStatus(d, "exposed")).toBe(true);
    // The Knight in Middle with a spear, and even the Vagabond at the Back, can now reach it in melee.
    const attack = { id: "attack", shape: "single", side: "foe" as const, power: 1, reach: "melee" as const };
    for (const s of party.filter((u) => u.col >= 1)) expect(singleTargets(b, s, attack), s.name).toContain(d);
    for (const u of b.units) u.ct = 0;
    d.ct = 1000;
    expect(advance(b, createRng(2))).toBe(d);
    expect(hasStatus(d, "exposed")).toBe(false);
  });

  it("aim the leap at the Back through empty_cell", () => {
    const party = standardParty(2, 15);
    const d = foe("dullahan", 10, 1, 3);
    const b = newBattle(1, [...party, d]);
    const t = choose(createRng(1), d, party, "empty_cell")!;
    expect(t.col).toBe(2);
    expect(decide(b, createRng(1), { ...d, turns: 2 }).action).toMatchObject({ ability: "headless_charge" });
  });
});

describe("swarms", () => {
  it("overrun when five or more of them stand", () => {
    const party = standardParty(1, 9);
    const birds = Array.from({ length: 5 }, (_, i) => foe("skull_bird", 10 + i, i % 2, i + 1, 3));
    const b = newBattle(1, [...party, ...birds]);
    expect(holds(b, birds[0]!, "swarm>=5")).toBe(true);
    expect(decide(b, createRng(1), birds[0]!).action).toMatchObject({ ability: "overrun" });
    kill(b, birds[4]!);
    expect(holds(b, birds[0]!, "swarm>=5")).toBe(false);
  });
});

describe("raising the dead", () => {
  it("lifts a fallen fodder at half HP, and only when one has fallen", () => {
    const party = standardParty(1, 15);
    const necro = foe("dark_necromancer", 10, 2, 3);
    const z = foe("zombie", 11, 0, 3);
    const b = newBattle(1, [...party, necro, z]);
    const raise = ab(necro, "raise_dead");
    expect(aim(b, createRng(1), necro, raise)).toBeUndefined();
    kill(b, z);
    expect(holds(b, necro, "fallen>=1")).toBe(true);
    expect(cannotUse(necro, raise)).toBeNull();
    resolve(b, createRng(1), necro, raise, cellOf(necro));
    expect(z.dead).toBe(false);
    expect(z.hp).toBe(Math.round(z.maxHp / 2));
    expect(b.events.some((e) => e.t === "raise" && e.target === z.id)).toBe(true);
  });
});

describe("aiming", () => {
  it("bruisers go for the weakest location, casters for the densest row", () => {
    const party = standardParty(1, 9);
    const hurt = party[2]!;
    hurt.dur!.legs = 1;
    expect(choose(createRng(1), foe("ghoul", 10, 0, 3), party, "lowest_durability")).toBe(hurt);
    const rows = party.map((u, i) => ({ ...u, row: i < 3 ? 2 : 6 }));
    expect(choose(createRng(1), foe("lich", 10, 2, 3), rows, "densest_row")!.row).toBe(2);
  });
});

describe("the Barrows roster", () => {
  it("plays every template to the end at L2, L5 and L8", () => {
    for (const level of [2, 5, 8]) {
      for (const template of ["warband", "battery", "coven", "swarm", "stalkers", "behemoth", "elite_patrol"]) {
        if (level < 3 && (template === "stalkers" || template === "behemoth")) continue;
        const { battle } = encounterBattle(level, standardParty(level, level * 3), { pool: "barrows", level, template, modifier: null });
        expect(simulate(battle).outcome, `${template} L${level}`).toBeDefined();
      }
    }
  });
});

describe("the Forge Ruins' tricks", () => {
  const forge = (id: string, n: number, col: number, row: number, level = 5): Combatant => enemyCombatant(`forge_${id}`, { id: n, level, col, row });
  const sure = (u: Combatant, id: string) => ({ ...ab(u, id), accuracy: 999 });

  it("a Gremlin's sabotage takes TP from the Scion it hits", () => {
    const hit = (steal: boolean) => {
      const party = standardParty(3, 15);
      const g = forge("gremlin", 10, 0, 0);
      const b = newBattle(3, [...party, g]);
      party[0]!.tp = 50;
      const sabotage = sure(g, "sabotage");
      resolve(b, createRng(1), g, steal ? sabotage : { ...sabotage, tpSteal: undefined }, cellOf(party[0]!));
      return [party[0]!.tp, g.tp];
    };
    const [plain, stolen] = [hit(false), hit(true)];
    expect(plain[0]! - stolen[0]!).toBe(20);
    expect(stolen[1]! - plain[1]!).toBe(20);
  });

  it("a Bomb's burst destroys the Bomb, and a Gem Thief's vanish takes her off the field alive", () => {
    const party = standardParty(4, 15);
    const bomb = forge("bomb", 10, 0, 0);
    const thief = forge("gem_thief", 11, 1, 4);
    const b = newBattle(4, [...party, bomb, thief, forge("rock_golem", 12, 0, 7)]);
    resolve(b, createRng(1), bomb, sure(bomb, "detonate"), cellOf(party[0]!));
    expect(bomb.dead).toBe(true);
    resolve(b, createRng(1), thief, ab(thief, "vanish"), cellOf(thief));
    expect(thief.dead).toBe(true);
    expect(thief.flags).toContain("fled");
    expect(b.events.some((e) => e.t === "flee" && e.unit === thief.id)).toBe(true);
  });
});
