import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { sovereignPact as g, type SovState } from "@vibepulse/shared/games/sovereign-pact";
import { calm, campaign } from "../../../shared/games/sovereign-pact/testing.ts";
import { able, muster } from "../../../shared/games/sovereign-pact/expedition.ts";
import ChainMap from "./ChainMap";

/** A solo House just past a Camp, Pilgrim's Bread and Widow's Tea in the satchel. */
function camped(): SovState {
  let s = calm(campaign(1, 5));
  s.phase = "expedition";
  muster(s, { type: "resource", pool: "beast_lands", level: 1, size: 4 });
  const r = g.applyMove(s, "p1", { type: "field", people: able(s, 0).slice(0, 4).map((p) => p.id) });
  if (!r.ok) throw new Error(r.error);
  s = r.state;
  const e = s.expedition!;
  e.leader = e.party[0]![0]!;
  delete e.votes;
  e.chain = ["camp", "encounter", "boss"];
  e.at = 1;
  e.satchel = [{ id: "pilgrims_bread", house: 0 }, { id: "widows_tea", house: 0 }];
  return s;
}

describe("the satchel on the road (§13.7)", () => {
  it("opens what may be opened, naming a Scion where it goes to one", () => {
    const s = camped();
    const sendMove = vi.fn();
    render(<ChainMap view={g.view(s, "p1")} sendMove={sendMove} />);
    fireEvent.click(screen.getByRole("button", { name: "Use Pilgrim's Bread" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "use_item", id: "pilgrims_bread" });
    const second = s.expedition!.party[0]![1]!;
    fireEvent.change(screen.getByLabelText("Who takes Widow's Tea"), { target: { value: String(second) } });
    fireEvent.click(screen.getByRole("button", { name: "Use Widow's Tea" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "use_item", id: "widows_tea", person: second });
  });

  it("offers nothing to open away from a Camp", () => {
    const s = camped();
    s.expedition!.at = 2;
    render(<ChainMap view={g.view(s, "p1")} sendMove={() => {}} />);
    expect(screen.queryByRole("button", { name: /^Use / })).toBeNull();
  });
});

describe("the expedition's columns (Josh's playtest)", () => {
  it("lists the party with its wounds, the satchel and the haul side by side", () => {
    const s = camped();
    const e = s.expedition!;
    const hurt = e.party[0]![0]!;
    e.carry[hurt] = { ...e.carry[hurt]!, hurt: 9, hpMax: 30 };
    e.haul = { items: [{ id: 9001, base: "sword", tier: 3, ilvl: 2, house: -1 }], stores: { iron: 4 } };
    render(<ChainMap view={g.view(s, "p1")} />);
    const party = screen.getByRole("region", { name: "The party" });
    expect(party.textContent).toContain("HP 21/30");
    const satchel = screen.getByRole("region", { name: "The satchel" });
    expect(within(satchel).getByText("Pilgrim's Bread")).toBeTruthy();
    const haul = screen.getByRole("region", { name: "The haul" });
    expect(haul.textContent).toContain("Fine Sword");
    expect(haul.textContent).toContain("Iron ×4");
  });
});
