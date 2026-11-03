// Town events as trades (Josh 2026-11-03: "trade offs... recruits in exchange for items or consumables or
// resources... traits to your house or some of your scions", buildings "destroyed or gifted", Wards
// exchanged "like a marriage pact"): option prices, a named House, and what an outcome can give or take.
import { afterEach, describe, expect, it } from "vitest";
import { BUILDING_BY_ID, CONSUMABLE_BY_ID, HOUSE_TRAIT_BY_ID, NAMED_BY_ID, TOWN_EVENT_BY_ID, TOWN_EVENTS, type TownEventDef, type TownOption } from "./content.ts";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { cautious } from "./omens.ts";
import { calm, campaign } from "./testing.ts";

const g = sovereignPact;
const move = (s: SovState, player: string, m: SovMove): SovState => {
  const r = g.applyMove(s, player, m);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const error = (s: SovState, player: string, m: SovMove): string => {
  const r = g.applyMove(s, player, m);
  if (r.ok) throw new Error("expected a refusal");
  return r.error;
};

const events = TOWN_EVENT_BY_ID as Map<string, TownEventDef>;
afterEach(() => events.delete("test_trade"));

/** A calm campaign with a made-up event open for House 0 to decide. */
function trade(H: number, options: TownOption[]): SovState {
  events.set("test_trade", { id: "test_trade", scope: "settlement", weight: 1, years: [1, 20], title: "A Test Trade", text: "…", rule: "random_house", options });
  const s = calm(campaign(H, 3));
  s.events = [{ key: "test_trade", id: "test_trade", deciders: [0], choices: s.houses.map(() => null) }];
  return s;
}
const refuse: TownOption = { id: "refuse", label: "Refuse.", tags: ["cautious"], outcomes: [{ w: 1, text: "Nothing.", effects: [] }] };
const recruits = (s: SovState, h: number) => s.people.filter((p) => p.host === h && p.status === "recruit").length;

describe("town events as trades (Josh 2026-11-03)", () => {
  it("asks its price up front, offers it only to a House that can pay, and takes the recruits it asks for", () => {
    const sell: TownOption = { id: "sell", label: "Sell them.", cost: { resources: { grain: 5 }, recruits: 2 }, outcomes: [{ w: 1, text: "Paid.", effects: [{ consumable: { id: "tonic", n: 3 } }] }] };
    let s = trade(2, [sell, refuse]);
    s.houses[0]!.stores.grain = 4;
    expect(error(s, "p1", { type: "choose", event: "test_trade", option: 0 })).toMatch(/5 Grain/);
    s.houses[0]!.stores.grain = 9;
    const had = recruits(s, 0);
    s = move(s, "p1", { type: "choose", event: "test_trade", option: 0 });
    expect(s.houses[0]!.stores.grain).toBe(4);
    expect(recruits(s, 0)).toBe(had - 2);
    expect(s.houses[0]!.consumables?.tonic).toBe(3);
    expect(s.omensTold!.at(-1)!.lines.map((l) => l.text)).toContain(`House ${s.houses[0]!.name}: ${CONSUMABLE_BY_ID.get("tonic")!.name} ×3.`);
  });

  it("lets the chooser name another House, whom the outcome then touches: a fine, a gift of a building, a Ward exchange", () => {
    const bind: TownOption = { id: "bind", label: "Bind them to you.", target: true, outcomes: [{ w: 1, text: "Bound.", effects: [{ to: "target", resources: { gold: -10 } }, { gift: "farm" }, { ward_swap: true }] }] };
    let s = trade(3, [bind, refuse]);
    s.houses[0]!.buildings.farm = 2;
    const gold = s.houses[2]!.gold;
    expect(error(s, "p1", { type: "choose", event: "test_trade", option: 0 })).toBe("Name another House.");
    expect(error(s, "p1", { type: "choose", event: "test_trade", option: 0, target: 0 })).toBe("Name another House.");
    s = move(s, "p1", { type: "choose", event: "test_trade", option: 0, target: 2 });
    expect(s.houses[2]!.gold).toBe(gold - 10);
    expect(s.houses[1]!.gold).toBe(trade(3, [bind, refuse]).houses[1]!.gold);
    expect(s.houses[0]!.buildings.farm).toBe(1);
    expect(s.houses[2]!.buildings.farm).toBe(1);
    // Each gave its youngest Scion: two Wards, one each way.
    expect(s.people.filter((p) => p.house === 0 && p.host === 2)).toHaveLength(1);
    expect(s.people.filter((p) => p.house === 2 && p.host === 0)).toHaveLength(1);
    expect(s.omensTold!.at(-1)!.label).toContain(`(House ${s.houses[2]!.name})`);
  });

  it("gives artifacts and marks, tears buildings down and raises them, and falls on several Scions in turn", () => {
    const named = [...NAMED_BY_ID.values()].find((n) => !n.cure)!.id;
    const strange: TownOption = {
      id: "strange",
      label: "Take what is offered.",
      outcomes: [{ w: 1, text: "Taken.", effects: [{ item: { named } }, { item: { tier: 4 } }, { house_trait: "+wed_to_the_grave" }, { raze: "best" }, { raise: "chapel" }, { scion: { who: "youngest", count: 2, sanity: -20 } }] }],
    };
    let s = trade(2, [strange, refuse]);
    s.houses[0]!.buildings = { farm: 1, quarry: 3 };
    const before = s.people.filter((p) => p.host === 0 && p.status === "scion").map((p) => ({ id: p.id, sanity: p.sanity }));
    s = move(s, "p1", { type: "choose", event: "test_trade", option: 0 });
    const mine = s.items.filter((i) => i.house === 0);
    expect(mine.some((i) => i.named === named)).toBe(true);
    expect(mine.some((i) => !i.named && i.tier === 4)).toBe(true);
    expect(s.houses[0]!.traits).toContain("wed_to_the_grave");
    expect(s.houses[0]!.buildings).toEqual({ farm: 1, chapel: 1 });
    const hurt = s.people.filter((p) => before.some((b) => b.id === p.id && p.sanity < b.sanity));
    expect(hurt).toHaveLength(Math.min(2, before.length));
    const lines = s.omensTold!.at(-1)!.lines.map((l) => l.text);
    expect(lines).toContain(`House ${s.houses[0]!.name} is marked: Wed to the Grave.`);
    expect(lines.some((l) => l.includes(NAMED_BY_ID.get(named)!.name))).toBe(true);
    expect(lines).toContain(`House ${s.houses[0]!.name}'s quarry is destroyed.`);
  });

  it("has the bot pay only what it can and name a rival when asked", () => {
    const kind: TownOption = { id: "kind", label: "Help them.", tags: ["kind"], target: true, cost: { resources: { gold: 5 } }, outcomes: [{ w: 1, text: "Helped.", effects: [{ to: "target", resources: { gold: 5 } }] }] };
    const s = trade(2, [kind, refuse]);
    s.houses[0]!.gold = 200;
    expect(g.botMove!(s, "p1", undefined as never)).toEqual({ type: "choose", event: "test_trade", option: 0, target: 1, bot: true });
    s.houses[0]!.gold = 3;
    expect(g.botMove!(s, "p1", undefined as never)).toMatchObject({ type: "choose", option: 1 });
  });

  it("never lays a mark at founding", () => {
    const s = campaign(2, 4);
    for (const h of s.houses) expect(h.traits.some((t) => HOUSE_TRAIT_BY_ID.get(t)!.kind === "mark")).toBe(false);
  });
});

describe("champions, sealed bids and accusations (Josh 2026-11-03: drama amongst the Houses)", () => {
  const champ: TownOption = {
    id: "go",
    label: "Send your best.",
    champion: { stat: "might", dc: 12 },
    outcomes: [
      { w: 1, when: "pass", text: "They come back with it.", effects: [{ scion: { who: "champion", xp: 50 } }, { item: { tier: 3 } }] },
      { w: 1, when: "fail", text: "They come back wrong.", effects: [{ scion: { who: "champion", sanity: -40 } }] },
    ],
  };

  it("tests the champion a House puts forward, and what follows falls on them alone", () => {
    let pass = 0;
    for (let seed = 1; seed <= 30; seed++) {
      let s = trade(2, [champ, refuse]);
      s.rng = seed;
      const p = s.people.find((x) => x.host === 0 && x.status === "scion")!;
      const others = s.people.filter((x) => x.id !== p.id).map((x) => ({ id: x.id, sanity: x.sanity, xp: x.xp }));
      expect(error(s, "p1", { type: "choose", event: "test_trade", option: 0 })).toMatch(/Put forward/);
      s = move(s, "p1", { type: "choose", event: "test_trade", option: 0, person: p.id });
      const after = s.people.find((x) => x.id === p.id)!;
      const told = s.omensTold!.at(-1)!.text;
      if (told.startsWith(`${p.name} comes through.`)) {
        pass++;
        expect(after.xp).toBeGreaterThan(p.xp);
      } else {
        expect(told.startsWith(`${p.name} fails.`)).toBe(true);
        expect(after.sanity).toBeLessThan(p.sanity);
      }
      for (const o of others) expect(s.people.find((x) => x.id === o.id)).toMatchObject(o);
    }
    expect(pass).toBeGreaterThan(3);
    expect(pass).toBeLessThan(27);
  });

  it("takes every sealed bid and gives the prize to the highest", () => {
    events.set("test_trade", {
      id: "test_trade",
      scope: "settlement",
      weight: 1,
      years: [1, 20],
      title: "The Auction of Hands",
      text: "…",
      rule: "secret",
      options: [{ id: "bid", label: "Bid.", bid: { resource: "gold", min: 5 }, outcomes: [{ w: 1, text: "You bid.", effects: [] }] }, refuse],
      prize: { text: "It is yours. It moves when no one looks.", effects: [{ item: { tier: 4 } }] },
    });
    let s = calm(campaign(3, 3));
    for (const h of s.houses) h.gold = 100;
    s.events = [{ key: "test_trade", id: "test_trade", deciders: [0, 1, 2], choices: [null, null, null] }];
    expect(error(s, "p1", { type: "choose", event: "test_trade", option: 0, amount: 4 })).toMatch(/at least 5/);
    expect(error(s, "p1", { type: "choose", event: "test_trade", option: 0, amount: 101 })).toMatch(/more than you have/);
    s = move(s, "p1", { type: "choose", event: "test_trade", option: 0, amount: 20 });
    s = move(s, "p2", { type: "choose", event: "test_trade", option: 0, amount: 35 });
    s = move(s, "p3", { type: "choose", event: "test_trade", option: 1 });
    expect(s.houses.map((h) => h.gold)).toEqual([80, 65, 100]);
    expect(s.items.filter((i) => i.house === 1 && i.tier === 4)).toHaveLength(1);
    expect(s.items.filter((i) => i.house === 0 && i.tier === 4)).toHaveLength(0);
    expect(s.omensTold!.at(-1)!.label).toBe(`House ${s.houses[1]!.name} wins with 35.`);
  });

  it("lays the blame on the House most named, and on nobody when the fingers are split", () => {
    const accuse: TownOption = { id: "name", label: "Name the guilty House.", accuse: true, outcomes: [{ w: 1, text: "You point.", effects: [] }] };
    const def = (): TownEventDef => ({
      id: "test_trade",
      scope: "settlement",
      weight: 1,
      years: [1, 20],
      title: "The Flayed Steward",
      text: "…",
      rule: "secret",
      options: [accuse, refuse],
      blamed: { text: "The mob comes for them.", effects: [{ raze: "best" }, { accord: 2 }] },
    });
    events.set("test_trade", def());
    const open = () => {
      const s = calm(campaign(3, 3));
      for (const h of s.houses) h.buildings = { farm: 2 };
      s.events = [{ key: "test_trade", id: "test_trade", deciders: [0, 1, 2], choices: [null, null, null] }];
      return s;
    };
    let s = open();
    s = move(s, "p1", { type: "choose", event: "test_trade", option: 0, target: 2 });
    s = move(s, "p2", { type: "choose", event: "test_trade", option: 0, target: 2 });
    s = move(s, "p3", { type: "choose", event: "test_trade", option: 0, target: 0 });
    expect(s.houses[2]!.buildings.farm).toBeUndefined();
    expect(s.houses[0]!.buildings.farm).toBe(2);
    expect(s.omensTold!.at(-1)!.label).toBe(`House ${s.houses[2]!.name} is blamed.`);
    let split = open();
    const accord = split.accord;
    split = move(split, "p1", { type: "choose", event: "test_trade", option: 0, target: 1 });
    split = move(split, "p2", { type: "choose", event: "test_trade", option: 0, target: 2 });
    split = move(split, "p3", { type: "choose", event: "test_trade", option: 0, target: 0 });
    expect(split.houses.every((h) => h.buildings.farm === 2)).toBe(true);
    expect(split.accord).toBeLessThan(accord);
  });
});

describe("the town content's trades", () => {
  it("keeps the cautious way out free, names Houses only where one House chooses, and names only what exists", () => {
    for (const e of TOWN_EVENTS) {
      if (!e.options) continue;
      const out = e.options[cautious(e)]!;
      expect(out.cost, `${e.id}: the cautious option costs nothing`).toBeUndefined();
      expect(out.target, `${e.id}: the cautious option names no House`).toBeUndefined();
      for (const o of e.options) {
        if (o.target || o.accuse || o.champion || o.bid) expect(e.rule, `${e.id}.${o.id}`).not.toBe("vote");
        if (o.bid) expect(e.prize, `${e.id} has a prize`).toBeDefined();
        if (o.accuse) expect(e.blamed, `${e.id} says what blame brings`).toBeDefined();
        if (o.champion) expect(new Set(o.outcomes.map((x) => x.when)), `${e.id}.${o.id} says what follows a pass and a fail`).toEqual(new Set(["pass", "fail"]));
        for (const out of o.outcomes)
          for (const fx of out.effects) {
            if (fx.to === "target" || fx.gift || fx.ward_swap) expect(o.target, `${e.id}.${o.id} names a House`).toBe(true);
            if (fx.consumable) expect(CONSUMABLE_BY_ID.has(fx.consumable.id), fx.consumable.id).toBe(true);
            if (fx.item?.named) expect(NAMED_BY_ID.has(fx.item.named), fx.item.named).toBe(true);
            if (fx.house_trait) expect(HOUSE_TRAIT_BY_ID.has(fx.house_trait.slice(1)), fx.house_trait).toBe(true);
            for (const b of [fx.raze, fx.raise, fx.gift]) if (b && !["best", "any"].includes(b)) expect(BUILDING_BY_ID.has(b), b).toBe(true);
          }
      }
    }
  });
});
