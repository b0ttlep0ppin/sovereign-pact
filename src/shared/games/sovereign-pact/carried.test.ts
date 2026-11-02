// Carried consumables (§13.7): the Dice of the Marches and the Saint's Tooth on injury rolls, and the
// Tarot Token spent in town.
import { describe, expect, it } from "vitest";
import type { Rng } from "../../rng.ts";
import { carriedRoll, injure } from "./combat/injury.ts";
import { newBattle } from "./combat/build.ts";
import { standardParty } from "./combat/fixtures.ts";
import { sovereignPact as g } from "./index.ts";
import type { SovState } from "./state.ts";
import { calm, campaign } from "./testing.ts";

/** A die that lands where it is told: each `int` takes the next value. */
const loaded = (...xs: number[]): Rng => ({ int: () => xs.shift() ?? 10, next: () => 0.5, pick: (a) => a[0]!, shuffle: (a) => [...a], seed: () => 1 });
/** A satchel of `ids`, recording what is spent. */
const bag = (...ids: string[]) => {
  const spent: string[] = [];
  return { spent, has: (id: string) => ids.includes(id) && !spent.includes(id), spend: (id: string) => void spent.push(id) };
};

describe("the Dice of the Marches and the Saint's Tooth (§13.7)", () => {
  it("rerolls a low die once, and leaves a fair one alone", () => {
    const c = bag("dice_of_the_marches");
    const r = carriedRoll(loaded(0, 15), "arms", 0, c);
    expect([r.rerolled, r.roll, c.spent]).toEqual([1, 16, ["dice_of_the_marches"]]);
    expect(carriedRoll(loaded(0), "arms", 0, c).rerolled).toBeUndefined();
    expect(carriedRoll(loaded(12), "arms", 0, bag("dice_of_the_marches")).rerolled).toBeUndefined();
  });

  it("turns a Mortal wound into a severed arm, once", () => {
    const c = bag("saints_tooth");
    expect(carriedRoll(loaded(1), "body", 0).result.id).toBe("body_mortal_wound");
    const r = carriedRoll(loaded(1), "body", 0, c);
    expect([r.table, r.result.id, r.tooth, c.spent]).toEqual(["arms", "arms_severed", true, ["saints_tooth"]]);
    expect(carriedRoll(loaded(1), "body", 0, c).result.id).toBe("body_mortal_wound");
  });

  it("works from the satchel in battle, for a Scion, and the battle remembers it is spent", () => {
    const [p] = standardParty(1, 6, 1);
    const u = { ...p!, person: 1, resilience: 0, steps: 0 };
    const b = newBattle(3, [u]);
    b.satchel = ["saints_tooth"];
    expect(injure(b, loaded(1), b.units[0]!, "body", 0).id).toBe("arms_severed");
    expect(b.units[0]!.lastStand).toBeFalsy();
    expect(b.used).toEqual(["saints_tooth"]);
    expect(b.events.find((e) => e.t === "injury")).toMatchObject({ table: "arms", tooth: true });
  });
});

describe("the Tarot Token (§13.7)", () => {
  function town(): SovState {
    const s = calm(campaign(2, 4));
    s.phase = "settlement";
    s.houses[0]!.consumables = { tarot_token: 2 };
    return s;
  }
  it("draws a new Tarot for one Scion, once in their life", () => {
    const s = town();
    const p = s.people.find((x) => x.host === 0 && x.status === "scion")!;
    const before = p.tarot;
    const r = g.applyMove(s, s.players[0]!, { type: "draw_tarot", person: p.id });
    if (!r.ok) throw new Error(r.error);
    const q = r.state.people.find((x) => x.id === p.id)!;
    expect(q.tarot).not.toBe(before);
    expect(r.state.houses[0]!.consumables).toEqual({ tarot_token: 1 });
    expect(g.applyMove(r.state, s.players[0]!, { type: "draw_tarot", person: p.id })).toMatchObject({ ok: false, error: expect.stringMatching(/only once/) });
    const theirs = s.people.find((x) => x.host === 1 && x.status === "scion")!;
    expect(g.applyMove(r.state, s.players[0]!, { type: "draw_tarot", person: theirs.id })).toMatchObject({ ok: false });
  });
});
