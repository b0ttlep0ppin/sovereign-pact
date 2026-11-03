import { describe, expect, it } from "vitest";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { mint } from "./items.ts";
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
function table(H = 3): SovState {
  const s = calm(campaign(H, 3));
  for (const h of s.houses) Object.assign(h, { gold: 100, stores: { timber: 50, stone: 50 } });
  return s;
}

describe("deals between Houses (§8.9)", () => {
  it("executes at once when accepted: Gold, materials and stashed items change hands", () => {
    let s = table();
    const sword = mint(s, "sword", 0);
    s = move(s, "p1", { type: "offer", to: 1, give: { gold: 30, items: [sword.id] }, get: { stores: { stone: 20 } } });
    const id = s.deals[0]!.id;
    expect(error(s, "p3", { type: "accept", deal: id })).toMatch(/no such offer/);
    s = move(s, "p2", { type: "accept", deal: id });
    expect([s.houses[0]!.gold, s.houses[1]!.gold]).toEqual([70, 130]);
    expect([s.houses[0]!.stores.stone, s.houses[1]!.stores.stone]).toEqual([70, 30]);
    expect(s.items.find((i) => i.id === sword.id)!.house).toBe(1);
    expect(s.deals).toEqual([]);
    expect(s.houses[0]!.score.intrigue).toBe(TUNING.deals.intrigue);
    expect(s.houses[0]!.score.renown).toBe(0);
  });

  it("keeps a private deal between its two Houses, and shows and rewards a public one", () => {
    let s = table();
    s = move(s, "p1", { type: "offer", to: 1, give: { gold: 5 }, get: {} });
    expect(view(s, "p3").deals).toEqual([]);
    expect(view(s, "p2").deals).toHaveLength(1);
    s = move(s, "p1", { type: "offer", to: 2, give: { gold: 5 }, get: {}, open: true });
    expect(view(s, "p2").deals).toHaveLength(2);
    s = move(s, "p3", { type: "accept", deal: s.deals[1]!.id });
    expect(s.houses[2]!.score.renown).toBe(TUNING.deals.publicRenown);
    expect(s.log.at(-1)).toMatch(/public deal/);
  });

  it("refuses offers a House cannot pay, worn items, empty deals, itself and solo", () => {
    const s = table();
    const scion = s.people.find((p) => p.host === 0 && p.status === "scion")!;
    const worn = Object.values(scion.gear)[0]!;
    expect(error(s, "p1", { type: "offer", to: 1, give: { gold: 999 }, get: {} })).toMatch(/cannot pay/);
    expect(error(s, "p1", { type: "offer", to: 1, give: { items: [worn] }, get: {} })).toMatch(/stash/);
    expect(error(s, "p1", { type: "offer", to: 1, give: {}, get: {} })).toMatch(/must move/);
    expect(error(s, "p1", { type: "offer", to: 0, give: { gold: 1 }, get: {} })).toMatch(/another House/);
    expect(error(calm(campaign(1, 3)), "p1", { type: "offer", to: 0, give: { gold: 1 }, get: {} })).toMatch(/no other House/);
  });

  it("checks both sides again at acceptance, and drops offers that can no longer be paid", () => {
    let s = table();
    s = move(s, "p1", { type: "offer", to: 1, give: { gold: 80 }, get: { gold: 1 } });
    s = move(s, "p1", { type: "offer", to: 2, give: { gold: 80 }, get: {} });
    s.houses[1]!.gold = 0;
    expect(error(s, "p2", { type: "accept", deal: s.deals[0]!.id })).toMatch(/cannot pay/);
    s = move(s, "p3", { type: "accept", deal: s.deals[1]!.id });
    expect(s.deals).toEqual([]);
  });

  it("can be declined by its House or withdrawn by its maker, and lapses at the seal", () => {
    let s = table();
    s = move(s, "p1", { type: "offer", to: 1, give: { gold: 1 }, get: {} });
    s = move(s, "p1", { type: "decline", deal: s.deals[0]!.id });
    expect(s.deals).toEqual([]);
    s = move(s, "p1", { type: "offer", to: 1, give: { gold: 1 }, get: {} });
    expect(error(s, "p3", { type: "decline", deal: s.deals[0]!.id })).toMatch(/no such/);
    for (const p of ["p1", "p2", "p3"]) s = move(s, p, { type: "seal" });
    expect(s.deals).toEqual([]);
  });

  it("is answered by the bot: it takes a fair or better trade and refuses a bad one", () => {
    let s = table(2);
    s = move(s, "p1", { type: "offer", to: 1, give: { gold: 10 }, get: { stores: { timber: 10 } } });
    expect(g.botMove!(s, "p2", undefined as never)).toEqual({ type: "accept", deal: s.deals[0]!.id, bot: true });
    s = move(s, "p1", { type: "decline", deal: s.deals[0]!.id });
    s = move(s, "p1", { type: "offer", to: 1, give: { gold: 1 }, get: { stores: { timber: 10 } } });
    expect(g.botMove!(s, "p2", undefined as never)).toEqual({ type: "decline", deal: s.deals[0]!.id, bot: true });
  });
});
