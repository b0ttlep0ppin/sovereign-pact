import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { SEATS } from "./content.ts";
import { econ, houseEffects } from "./houses.ts";
import { sovereignPact, type SovState } from "./index.ts";
import { calm, campaign, found, seats } from "./testing.ts";
import { upkeepDue } from "./town.ts";
import { TUNING } from "./tuning.ts";

/** A solo campaign whose House sits in `seat`, founded from scratch. */
function seated(seat: string): SovState {
  const s = sovereignPact.setup(seats(1), createRng(3), undefined, { battles: "gambits" });
  s.houses[0]!.seat = seat;
  return found(s);
}

describe("Seats (§5.5, DECISIONS 8ah)", () => {
  it("gives every Seat one advantage and one drawback, in words", () => {
    for (const seat of SEATS) {
      expect(seat.pro.length).toBeGreaterThan(5);
      expect(seat.con.length).toBeGreaterThan(5);
      expect(seat.start || seat.mods || seat.economy).toBeTruthy();
    }
  });

  it("starts the House with its Seat's building, or another recruit", () => {
    expect(seated("abbey").houses[0]!.buildings.infirmary).toBe(1);
    expect(seated("spire").houses[0]!.buildings.scriptorium).toBe(1);
    const people = (s: SovState) => s.people.filter((p) => p.host === 0).length;
    expect(people(seated("manor"))).toBe(people(seated("keep")) + 1);
  });

  it("reads its knobs like a House trait's", () => {
    const h = calm(campaign(1)).houses[0]!;
    expect(econ(h, "incomePct")).toBe(0);
    h.seat = "chateau";
    expect(econ(h, "incomePct")).toBe(10);
    h.seat = "spire";
    expect(houseEffects(h).mods.maxHpPct).toBe(-5);
  });

  it("keeps the Retired for nothing in a Catacomb Hall", () => {
    const s = calm(campaign(1));
    s.people.find((p) => p.host === 0 && p.status === "scion")!.status = "retired";
    const before = upkeepDue(s, 0).gold;
    s.houses[0]!.seat = "catacomb_hall";
    expect(upkeepDue(s, 0).gold).toBe(before - Math.ceil(TUNING.economy.upkeep.scionGold / 2));
  });
});
