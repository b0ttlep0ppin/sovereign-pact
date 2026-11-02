// Consumables in battle (§13.7): a Scion's action from the party satchel, and the bots' use of it.
import { describe, expect, it } from "vitest";
import { createRng } from "../../../rng.ts";
import { TUNING } from "../tuning.ts";
import { act } from "./battle.ts";
import { enemyCombatant, newBattle } from "./build.ts";
import { standardParty } from "./fixtures.ts";
import { decide } from "./gambits.ts";
import { itemAbility, itemPlan } from "./items.ts";
import { addStatus } from "./status.ts";
import { cellOf } from "./targets.ts";
import type { Battle, Combatant } from "./types.ts";

function scion(id: number, col: number, row: number, extra: Partial<Combatant> = {}): Combatant {
  const [p] = standardParty(id, 6, id);
  return { ...p!, id, col, row, person: id, ...extra };
}
const enemy = (id: number, col: number, row: number) => enemyCombatant("barrow_skeleton", { id, level: 2, col, row });

/** A battle with `satchel`, waiting on unit 1. */
function fight(satchel: string[], ...units: Combatant[]): Battle {
  const b = newBattle(3, units);
  b.satchel = [...satchel];
  b.actor = 1;
  b.acted = false;
  b.moved = false;
  return b;
}
const rng = () => createRng(9);
const unitOf = (b: Battle, id: number) => b.units.find((u) => u.id === id)!;

describe("using a consumable (§13.7)", () => {
  it("heals from the satchel for 100 CT, and the satchel remembers", () => {
    const b = fight(["tonic", "tonic"], scion(1, 0, 0), scion(2, 0, 1), enemy(9, 0, 0));
    const t = unitOf(b, 2);
    t.hp = 10;
    unitOf(b, 1).ct = 200;
    act(b, rng(), unitOf(b, 1), { do: "item", item: "tonic", target: cellOf(t) });
    expect(t.hp).toBe(10 + Math.round(t.maxHp * 0.25));
    expect(b.satchel).toEqual(["tonic"]);
    expect(b.used).toEqual(["tonic"]);
    expect(unitOf(b, 1).ct).toBe(100);
  });

  it("costs 60 CT under Quick Hands and heals more with Herb Lore", () => {
    const u = scion(1, 0, 0, { mods: { itemCt: 60, itemHealPct: 30 } });
    const ab = itemAbility(u, "tonic")!;
    expect(ab.cost).toBe(60);
    expect(ab.restore?.hpPct).toBe(Math.round(25 * 1.3));
  });

  it("refuses what the satchel lacks, and anyone but a Scion", () => {
    const b = fight(["tonic"], scion(1, 0, 0), enemy(9, 0, 0));
    expect(() => act(b, rng(), unitOf(b, 1), { do: "item", item: "ether", target: cellOf(unitOf(b, 1)) })).toThrow(/holds none/);
    expect(() => act(b, rng(), unitOf(b, 1), { do: "item", item: "lantern", target: cellOf(unitOf(b, 1)) })).toThrow(/holds none/);
  });

  it("revives, restores MP and cures like the abilities it is shaped as", () => {
    const b = fight(["smelling_salts", "ether", "antidote"], scion(1, 0, 0), scion(2, 0, 1), enemy(9, 0, 0));
    const down = unitOf(b, 2);
    down.hp = 0;
    down.down = true;
    act(b, rng(), unitOf(b, 1), { do: "item", item: "smelling_salts", target: cellOf(down) });
    expect(down.down).toBe(false);
    expect(down.hp).toBe(Math.max(1, Math.round(down.maxHp * 0.1)));
    const u = unitOf(b, 1);
    u.mp = 0;
    b.actor = 1;
    b.acted = false;
    act(b, rng(), u, { do: "item", item: "ether", target: cellOf(u) });
    expect(u.mp).toBe(Math.round(u.maxMp * 0.25));
    addStatus(b, u, "poison", 300);
    b.actor = 1;
    b.acted = false;
    act(b, rng(), u, { do: "item", item: "antidote", target: cellOf(u) });
    expect(u.statuses.some((s) => s.id === "poison")).toBe(false);
  });
});

describe("bots and the satchel", () => {
  it("raise the Down first, then heal the badly hurt", () => {
    const b = fight(["tonic", "smelling_salts"], scion(1, 0, 0), scion(2, 0, 1), scion(3, 1, 0), enemy(9, 0, 0));
    expect(itemPlan(b, unitOf(b, 1))).toBe(undefined);
    unitOf(b, 3).hp = 1;
    unitOf(b, 2).down = true;
    unitOf(b, 2).hp = 0;
    expect(itemPlan(b, unitOf(b, 1))).toMatchObject({ do: "item", item: "smelling_salts", target: cellOf(unitOf(b, 2)) });
    b.satchel = ["tonic"];
    expect(itemPlan(b, unitOf(b, 1))).toMatchObject({ do: "item", item: "tonic", target: cellOf(unitOf(b, 3)) });
    unitOf(b, 3).hp = unitOf(b, 3).maxHp;
    expect(itemPlan(b, unitOf(b, 1))).toBe(undefined);
  });

  it("throw a bomb once the foes bunch up, and leave the satchel alone with gambits of their own", () => {
    const foes = Array.from({ length: TUNING.consumables.bots.bombFoes }, (_, i) => enemy(9 + i, 0, i));
    const b = fight(["firebomb"], scion(1, 0, 0), ...foes);
    expect(decide(b, rng(), unitOf(b, 1)).action).toMatchObject({ do: "item", item: "firebomb" });
    unitOf(b, 1).gambits = [{ do: "attack" }];
    expect(decide(b, rng(), unitOf(b, 1)).action.do).not.toBe("item");
    unitOf(b, 1).gambits = [{ do: "item:firebomb" }];
    expect(decide(b, rng(), unitOf(b, 1)).action).toMatchObject({ do: "item", item: "firebomb" });
  });
});
