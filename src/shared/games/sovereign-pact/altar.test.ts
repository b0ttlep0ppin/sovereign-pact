// The Altar of Offerings (a Commons project; Josh 2026-11-03: "some let you sacrifice small stuff for an
// expedition bonus"): one offering a Year, what it costs, and what the House's Scions carry for it.
import { describe, expect, it } from "vitest";
import { offeringMods } from "./altar.ts";
import { sovereignPact as g, type SovMove, type SovState } from "./index.ts";
import { calm, campaign } from "./testing.ts";
import { TUNING } from "./tuning.ts";
import { openYear } from "./year.ts";

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
const town = () => {
  const s = calm(campaign(2, 4));
  s.houses[0]!.stores.grain = 40;
  return s;
};

describe("the Altar of Offerings", () => {
  it("takes nothing until it stands in the Commons", () => {
    expect(error(town(), "p1", { type: "altar", gift: "grain" })).toMatch(/does not stand/);
  });

  it("takes one offering a Year, at its price, and the House's Scions carry what it gives", () => {
    let s = town();
    s.commons.built.altar_of_offerings = 1;
    s = move(s, "p1", { type: "altar", gift: "grain" });
    expect(s.houses[0]!.stores.grain).toBe(40 - TUNING.commons.altar.grain.grain);
    expect(offeringMods(s, 0)).toEqual(TUNING.commons.altar.grain.mods);
    expect(offeringMods(s, 1)).toEqual({});
    expect(error(s, "p1", { type: "altar", gift: "blood" })).toMatch(/made its offering/);
    s.year += 1;
    openYear(s);
    expect(offeringMods(s, 0)).toEqual({});
  });

  it("takes the last-sworn recruit, or blood from every Scion", () => {
    let s = town();
    s.commons.built.altar_of_offerings = 1;
    const recruits = s.people.filter((p) => p.host === 0 && p.status === "recruit");
    s = move(s, "p1", { type: "altar", gift: "recruit" });
    expect(s.people.filter((p) => p.host === 0 && p.status === "recruit")).toHaveLength(recruits.length - 1);
    expect(s.people.some((p) => p.id === recruits.at(-1)!.id)).toBe(false);
    const scions = s.people.filter((p) => p.host === 1 && p.status === "scion").map((p) => ({ id: p.id, sanity: p.sanity }));
    s = move(s, "p2", { type: "altar", gift: "blood" });
    for (const { id, sanity } of scions) expect(s.people.find((p) => p.id === id)!.sanity).toBe(Math.max(0, sanity - TUNING.commons.altar.blood.sanity));
  });
});
