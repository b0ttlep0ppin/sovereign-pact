import { describe, expect, it } from "vitest";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { change } from "./change.ts";
import { styleOf } from "./style.ts";
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

describe("restyling (§5.8)", () => {
  it("keeps the House's choice of hair, color and beard in the look, and can go back to how they were born", () => {
    let s = calm(campaign(2, 3));
    const man = s.people.find((p) => p.host === 0 && p.status === "scion" && p.sex === "m") ?? s.people.find((p) => p.host === 0)!;
    man.sex = "m";
    const traits = [...man.look];
    s = move(s, "p1", { type: "restyle", person: man.id, hair: "wavy", hair_color: "ginger", beard: "medium" });
    const after = s.people.find((p) => p.id === man.id)!;
    expect(styleOf(after)).toEqual({ hair: "wavy", hair_color: "ginger", beard: "medium" });
    s = move(s, "p1", { type: "restyle", person: man.id, hair: "page" });
    expect(styleOf(s.people.find((p) => p.id === man.id)!)).toEqual({ hair: "page", hair_color: "ginger", beard: "medium" });
    s = move(s, "p1", { type: "restyle", person: man.id, hair: "", hair_color: "", beard: "" });
    expect(s.people.find((p) => p.id === man.id)!.look).toEqual(traits);
  });

  it("restyles only your own, from the lists, and leaves a Changed body alone", () => {
    const s = calm(campaign(2, 3));
    const mine = s.people.find((p) => p.host === 0 && p.status === "scion")!;
    const theirs = s.people.find((p) => p.host === 1)!;
    expect(error(s, "p1", { type: "restyle", person: theirs.id, hair: "wavy" })).toMatch(/your own/);
    expect(error(s, "p1", { type: "restyle", person: mine.id, hair: "mohawk" })).toMatch(/no such hair/);
    expect(error(s, "p1", { type: "restyle", person: mine.id })).toMatch(/Choose/);
    mine.sex = "f";
    expect(error(s, "p1", { type: "restyle", person: mine.id, beard: "trimmed" })).toMatch(/beards/);
    change(s, mine, "wyrmling");
    expect(error(s, "p1", { type: "restyle", person: mine.id, hair: "wavy" })).toMatch(/Changed/);
  });
});
