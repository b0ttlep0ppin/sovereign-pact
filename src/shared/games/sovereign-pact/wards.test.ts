// Wards and Loyalty (§6.9): given in deals, Loyalty hidden, leaks, Sworn and Estranged, the score split.
import { describe, expect, it } from "vitest";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { mint } from "./items.ts";
import { calm, campaign } from "./testing.ts";
import { TUNING } from "./tuning.ts";
import { view } from "./view.ts";
import { creditWard, wardYear } from "./wards.ts";

const g = sovereignPact;
const W = TUNING.wards;
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
const scionOf = (s: SovState, house: number) => s.people.find((p) => p.host === house && p.house === house && p.status === "scion")!;
/** House 0 gives one of its Scions to House 1 for a Gold. */
function given(H = 3): { s: SovState; id: number } {
  let s = calm(campaign(H, 3));
  const id = scionOf(s, 0).id;
  s = move(s, "p1", { type: "offer", to: 1, give: { wards: [id] }, get: { gold: 1 } });
  s = move(s, "p2", { type: "accept", deal: s.deals[0]!.id });
  return { s, id };
}

describe("giving a Ward (§6.9)", () => {
  it("moves a Scion to the host at the starting Loyalty, the gear home but a cursed piece with them", () => {
    let s = calm(campaign(2, 3));
    const p = scionOf(s, 0);
    const cursed = mint(s, "ring", 0, 3);
    cursed.cursed = true;
    p.gear.acc1 = cursed.id;
    const worn = Object.values(p.gear);
    s = move(s, "p1", { type: "offer", to: 1, give: { wards: [p.id] }, get: {} });
    s = move(s, "p2", { type: "accept", deal: s.deals[0]!.id });
    const w = s.people.find((x) => x.id === p.id)!;
    expect([w.house, w.host, w.loyalty, w.wardSince]).toEqual([0, 1, W.start, s.year]);
    expect(w.gear).toEqual({ acc1: cursed.id });
    expect(s.items.find((i) => i.id === cursed.id)!.house).toBe(1);
    expect(worn.filter((i) => i !== cursed.id).every((i) => s.items.find((x) => x.id === i)!.house === 0)).toBe(true);
  });

  it("starts lower from a Bad Blood House and higher with a Hound-Loyal host", () => {
    for (const [house, trait, loyalty] of [[0, "bad_blood", W.badBlood], [1, "hound_loyal", W.houndLoyal]] as const) {
      let s = calm(campaign(2, 3));
      s.houses[house]!.traits = [trait];
      const id = scionOf(s, 0).id;
      s = move(s, "p1", { type: "offer", to: 1, give: { wards: [id] }, get: {} });
      s = move(s, "p2", { type: "accept", deal: s.deals[0]!.id });
      expect(s.people.find((x) => x.id === id)!.loyalty).toBe(loyalty);
    }
  });

  it("refuses recruits, others' people, a return within 3 Years and a third House unless Sworn", () => {
    const { s, id } = given();
    const recruit = s.people.find((p) => p.host === 0 && p.status === "recruit")!;
    expect(error(s, "p1", { type: "offer", to: 1, give: { wards: [recruit.id] }, get: {} })).toMatch(/Only a Scion/);
    expect(error(s, "p1", { type: "offer", to: 1, give: { wards: [id] }, get: {} })).toMatch(/Only a Scion/);
    expect(error(s, "p2", { type: "offer", to: 0, give: { wards: [id] }, get: {} })).toMatch(/within 3 Years/);
    expect(error(s, "p2", { type: "offer", to: 2, give: { wards: [id] }, get: {} })).toMatch(/Sworn/);
    s.people.find((p) => p.id === id)!.loyalty = W.sworn;
    const t = move(s, "p2", { type: "offer", to: 2, give: { wards: [id] }, get: {} });
    const u = move(t, "p3", { type: "accept", deal: t.deals.at(-1)!.id });
    expect(u.people.find((p) => p.id === id)).toMatchObject({ host: 2, loyalty: W.sworn });
    s.year += W.noReturnYears;
    let home = move(s, "p2", { type: "offer", to: 0, give: { wards: [id] }, get: {} });
    home = move(home, "p1", { type: "accept", deal: home.deals.at(-1)!.id });
    const back = home.people.find((p) => p.id === id)!;
    expect([back.host, back.loyalty, back.wardSince]).toEqual([0, undefined, undefined]);
  });

  it("is never given by the bot, which gladly takes one", () => {
    const s = calm(campaign(2, 3));
    const mine = scionOf(s, 1).id;
    s.houses[0]!.gold = 500;
    const ask = move(s, "p1", { type: "offer", to: 1, give: { gold: 500 }, get: { wards: [mine] } });
    expect(g.botMove!(ask, "p2", undefined as never)).toMatchObject({ type: "decline" });
    const gift = move(s, "p1", { type: "offer", to: 1, give: { wards: [scionOf(s, 0).id] }, get: { gold: 10 } });
    expect(g.botMove!(gift, "p2", undefined as never)).toMatchObject({ type: "accept" });
  });
});

describe("Loyalty (§6.9)", () => {
  it("is hidden from both Houses, except from a host with Insight 3", () => {
    const { s, id } = given();
    const seen = (p: string) => view(s, p).people.find((x) => x.id === id)!.loyalty;
    expect([seen("p1"), seen("p2"), seen("p3")]).toEqual([undefined, undefined, undefined]);
    s.houses[1]!.buildings.scriptorium = 3;
    expect(seen("p2")).toBe(W.start);
  });

  it("leaks the host's secrets to the birth House below 50, never once Sworn", () => {
    const { s, id } = given(2);
    let leaks = 0;
    for (let n = 0; n < 200; n++) {
      s.notes = [[], []];
      wardYear(s);
      leaks += s.notes[0]!.length;
    }
    expect(leaks / 200).toBeGreaterThan(0.15);
    expect(leaks / 200).toBeLessThan(0.35);
    s.people.find((p) => p.id === id)!.loyalty = W.sworn;
    s.notes = [[], []];
    for (let n = 0; n < 50; n++) wardYear(s);
    expect(s.notes[0]).toEqual([]);
  });

  it("lets an Estranged Ward slip home", () => {
    const { s, id } = given(2);
    s.people.find((p) => p.id === id)!.loyalty = W.estranged;
    for (let n = 0; n < 20 && s.people.find((p) => p.id === id)!.host === 1; n++) wardYear(s);
    expect(s.people.find((p) => p.id === id)).toMatchObject({ host: 0 });
    expect(s.people.find((p) => p.id === id)!.loyalty).toBeUndefined();
    expect(s.log.at(-1)).toMatch(/slips away/);
  });

  it("splits a Ward's Valor by Loyalty, and gives it all to the host once Sworn", () => {
    const { s, id } = given(2);
    const p = s.people.find((x) => x.id === id)!;
    creditWard(s, p, "valor", 10);
    expect([s.houses[1]!.score.valor, s.houses[0]!.score.valor]).toEqual([4, 6]);
    p.loyalty = W.sworn;
    creditWard(s, p, "valor", 10);
    expect([s.houses[1]!.score.valor, s.houses[0]!.score.valor]).toEqual([14, 6]);
  });
});
