import { describe, expect, it } from "vitest";
import { eligible } from "./crisis.ts";
import { TOWN_EVENT_BY_ID, TOWN_EVENTS } from "./content.ts";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { cautious, openEvent } from "./omens.ts";
import { calm, campaign } from "./testing.ts";
import { TUNING } from "./tuning.ts";
import { view } from "./view.ts";

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
/** A calm campaign with one event opened by hand. */
function withEvent(H: number, id: string, house?: number): SovState {
  const s = calm(campaign(H, 2));
  for (const h of s.houses) h.gold = 300;
  openEvent(s, TOWN_EVENT_BY_ID.get(id)!, house);
  return s;
}
const opt = (id: string, option: string) => TOWN_EVENT_BY_ID.get(id)!.options!.findIndex((o) => o.id === option);

describe("the Omens (§8.8)", () => {
  it("draws a settlement event every Year, and House events about half the time", () => {
    let houseEvents = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = campaign(2, seed);
      expect(s.crisis || s.vote?.kind === "event" || s.events.some((e) => e.house === undefined), `seed ${seed}`).toBeTruthy();
      houseEvents += s.events.filter((e) => e.house !== undefined).length;
    }
    expect(houseEvents / 120).toBeGreaterThan(0.35);
    expect(houseEvents / 120).toBeLessThan(0.65);
    expect(TUNING.omens.houseEventPct).toBe(50);
  });

  it("gives a House event to its House, and checks its building against that House", () => {
    const s = withEvent(2, "cousins_claim", 1);
    expect(s.events[0]).toMatchObject({ key: "cousins_claim@1", deciders: [1] });
    expect(error(s, "p1", { type: "choose", event: "cousins_claim@1", option: 0 })).toMatch(/not yours/);
    const forge = TOWN_EVENT_BY_ID.get("forge_sings")!;
    s.houses[0]!.buildings.forge = 1;
    s.year = 5;
    expect([eligible(s, forge, 0), eligible(s, forge, 1)]).toEqual([true, false]);
  });

  it("lets the richest House decide a most_gold event, the outcome falling on it", () => {
    let s = withEvent(3, "debt_collector");
    s.houses[2]!.gold = 900;
    s = calm(campaign(3, 2));
    s.houses[2]!.gold = 900;
    openEvent(s, TOWN_EVENT_BY_ID.get("debt_collector")!);
    expect(s.events[0]!.deciders).toEqual([2]);
    s = move(s, "p3", { type: "choose", event: "debt_collector", option: opt("debt_collector", "pay") });
    expect(s.events).toEqual([]);
    expect(s.houses[2]!.gold).toBe(850);
  });

  it("gives the hungriest House the Mold in the Granary", () => {
    const s = calm(campaign(2, 2));
    s.houses[0]!.stores.grain = 3;
    openEvent(s, TOWN_EVENT_BY_ID.get("mold_in_the_granary")!);
    expect(s.events[0]!.deciders).toEqual([0]);
  });

  it("puts a vote event to the Houses, or to the solo House alone", () => {
    let s = withEvent(2, "plague_cart");
    expect(s.vote).toMatchObject({ kind: "event", subject: "plague_cart" });
    s = move(move(s, "p1", { type: "vote", choice: opt("plague_cart", "burn") }), "p2", { type: "vote", choice: opt("plague_cart", "burn") });
    expect(s.vote).toBeUndefined();
    expect(s.log.at(-1)).toMatch(/Burn it/);
    expect(withEvent(1, "plague_cart").events[0]!.deciders).toEqual([0]);
  });

  it("lets each House choose for itself, and the cautious option falls to those who do not by the seal", () => {
    let s = withEvent(2, "night_of_open_doors");
    s = move(s, "p1", { type: "choose", event: "night_of_open_doors", option: opt("night_of_open_doors", "guard") });
    expect(s.events[0]!.choices).toEqual([0, null]);
    s = move(move(s, "p1", { type: "seal" }), "p2", { type: "seal" });
    expect(s.log.some((l) => /Night of Open Doors: House .* Hide the stores/.test(l))).toBe(true);
    expect(cautious(TOWN_EVENT_BY_ID.get("night_of_open_doors")!)).toBe(opt("night_of_open_doors", "hide"));
  });

  it("keeps secret choices hidden until revealed together, and acts on none or all", () => {
    let s = withEvent(2, "bread_and_circuses");
    s = move(s, "p1", { type: "choose", event: "bread_and_circuses", option: opt("bread_and_circuses", "fund") });
    expect(view(s, "p2").events[0]!.choices).toEqual([-1, null]);
    expect(view(s, "p1").events[0]!.choices).toEqual([0, null]);
    const accord = s.accord;
    s = move(s, "p2", { type: "choose", event: "bread_and_circuses", option: opt("bread_and_circuses", "fund") });
    expect(s.accord).toBe(accord + 5);
    let none = withEvent(2, "bread_and_circuses");
    for (const p of ["p1", "p2"]) none = move(none, p, { type: "choose", event: "bread_and_circuses", option: opt("bread_and_circuses", "abstain") });
    expect(none.accord).toBe(accord - 10);
  });

  it("gives every event a cautious way out, and every House event options", () => {
    for (const e of TOWN_EVENTS.filter((x) => !x.crisis)) {
      expect(e.options!.length, e.id).toBeGreaterThanOrEqual(2);
      expect(e.options![cautious(e)], e.id).toBeDefined();
      if (e.scope === "house") expect(e.rule, e.id).toBe("house");
      for (const t of e.together ?? []) expect(e.options!.map((o) => o.id), e.id).toContain(t.option);
    }
  });
});
