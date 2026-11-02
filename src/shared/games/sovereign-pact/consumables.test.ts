// Consumables (§13.7): the content, and buying them where they are sold.
import { describe, expect, it } from "vitest";
import { STATUSES } from "./combat/status.ts";
import { botBuyConsumable, consumablePrice, held, soldAt } from "./consumables.ts";
import { BUILDINGS, CONSUMABLES, CONSUMABLE_BY_ID, PROJECT_BY_ID } from "./content.ts";
import { sovereignPact as g } from "./index.ts";
import type { SovState } from "./state.ts";
import { calm, campaign } from "./testing.ts";
import { TUNING } from "./tuning.ts";

const after = (r: ReturnType<typeof g.applyMove>): SovState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

function town(): SovState {
  const s = calm(campaign(2, 4));
  s.phase = "settlement";
  s.houses[0]!.gold = 500;
  return s;
}

describe("the consumables' content", () => {
  it("has at least 35, each sold somewhere real and usable some way", () => {
    expect(CONSUMABLES.length).toBeGreaterThanOrEqual(35);
    const places = new Set([...BUILDINGS.map((b) => b.id), ...PROJECT_BY_ID.keys()]);
    for (const c of CONSUMABLES) {
      for (const x of c.sold) expect(places.has(x.at), `${c.id}: ${x.at}`).toBe(true);
      // An effect in battle is data or a hand-coded special; every other use is hand-coded.
      expect(c.battle || c.special, c.id).toBeTruthy();
      if (c.use !== "battle") expect(c.special, c.id).toBeTruthy();
      for (const st of c.battle?.statuses ?? []) expect(STATUSES[st.id], `${c.id}: ${st.id}`).toBeDefined();
    }
  });
});

describe("buying consumables", () => {
  it("needs a shop or building that sells them", () => {
    const s = town();
    expect(g.applyMove(s, s.players[0]!, { type: "buy_consumable", id: "tonic" })).toMatchObject({ ok: false, error: expect.stringMatching(/No shop/) });
  });

  it("sells from the Apothecary at its stock tier, and the Gold goes", () => {
    let s = town();
    s.commons.built.apothecary = 1;
    expect(soldAt(s, 0, CONSUMABLE_BY_ID.get("tonic")!)).toBe("commons");
    s = after(g.applyMove(s, s.players[0]!, { type: "buy_consumable", id: "tonic", n: 3 }));
    expect(held(s.houses[0]!, "tonic")).toBe(3);
    expect(s.houses[0]!.gold).toBe(500 - 3 * consumablePrice(s, 0, CONSUMABLE_BY_ID.get("tonic")!));
    expect(g.applyMove(s, s.players[0]!, { type: "buy_consumable", id: "strong_tonic" }).ok).toBe(false);
    s.commons.shopTiers = { ...s.commons.shopTiers, apothecary: 2 };
    expect(g.applyMove(s, s.players[0]!, { type: "buy_consumable", id: "strong_tonic" }).ok).toBe(true);
  });

  it("sells from the House's own buildings, to that House only", () => {
    const s = town();
    s.houses[0]!.buildings.workshop = 1;
    const bomb = CONSUMABLE_BY_ID.get("firebomb")!;
    expect(soldAt(s, 0, bomb)).toBe("home");
    expect(soldAt(s, 1, bomb)).toBe(null);
    expect(consumablePrice(s, 0, bomb)).toBe(bomb.price);
  });

  it("refuses odd counts and empty purses", () => {
    const s = town();
    s.commons.built.apothecary = 1;
    expect(g.applyMove(s, s.players[0]!, { type: "buy_consumable", id: "tonic", n: 0 }).ok).toBe(false);
    expect(g.applyMove(s, s.players[0]!, { type: "buy_consumable", id: "tonic", n: TUNING.consumables.perBuy + 1 }).ok).toBe(false);
    s.houses[0]!.gold = 1;
    expect(g.applyMove(s, s.players[0]!, { type: "buy_consumable", id: "tonic" })).toMatchObject({ ok: false, error: expect.stringMatching(/afford/) });
  });

  it("shows a House its own stock only", () => {
    let s = town();
    s.commons.built.apothecary = 1;
    s = after(g.applyMove(s, s.players[0]!, { type: "buy_consumable", id: "antidote", n: 2 }));
    expect(g.view(s, s.players[0]!).mine?.consumables).toEqual({ antidote: 2 });
    expect(JSON.stringify(g.view(s, s.players[1]!).houses)).not.toContain("antidote");
  });

  it("lets a bot keep a few tonics and salves while it has Gold to spare", () => {
    const s = town();
    s.commons.built.apothecary = 1;
    expect(botBuyConsumable(s, 0)).toEqual({ type: "buy_consumable", id: "tonic", n: 1 });
    s.houses[0]!.consumables = { tonic: TUNING.consumables.botKeeps.tonic! };
    expect(botBuyConsumable(s, 0)?.id).toBe("bone_salve");
    s.houses[0]!.gold = TUNING.consumables.botReserve;
    expect(botBuyConsumable(s, 0)).toBe(null);
  });
});
