import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { sovereignPact as g } from "@vibepulse/shared/games/sovereign-pact";
import { found, campaign } from "../../../shared/games/sovereign-pact/testing.ts";
import TownMap, { moveFor, placeOf } from "./TownMap";

const town = () => {
  const s = found(campaign(2, 4));
  return { s, view: g.view(s, s.players[0]!) };
};

describe("the Town Map (§15.6)", () => {
  it("shows every House's Seat, the Commons, the Gate and the walls", () => {
    const { view } = town();
    render(<TownMap view={view} sendMove={() => {}} canAssign />);
    for (const h of view.houses) expect(screen.getByLabelText(`House ${h.name}'s Seat`)).toBeTruthy();
    for (const name of ["The Commons", "The Rift Gate", "The walls"]) expect(screen.getByLabelText(name)).toBeTruthy();
  });

  it("assigns a picked chit to the place picked next", () => {
    const { view } = town();
    const sendMove = vi.fn();
    render(<TownMap view={view} sendMove={sendMove} canAssign />);
    const mine = view.people.find((p) => p.host === view.me && p.status === "scion")!;
    fireEvent.click(screen.getAllByTitle(new RegExp(`^${mine.name}`))[0]!);
    fireEvent.click(screen.getByLabelText("The walls"));
    expect(sendMove).toHaveBeenCalledWith({ type: "assign", person: mine.id, to: "guard" });
  });

  it("reads each building as the assignment it holds, and places chits back by it", () => {
    const { view } = town();
    const p = view.people.find((x) => x.host === view.me)!;
    expect(moveFor(view, p, { kind: "building", id: "farm" })).toEqual({ type: "assign", person: p.id, to: "work", at: "farm" });
    expect(moveFor(view, p, { kind: "building", id: "scriptorium" })).toMatchObject({ to: "study" });
    expect(moveFor(view, p, { kind: "building", id: "vault" })).toBe(null);
    expect(moveFor(view, p, { kind: "sortie" })).toMatchObject({ to: "sortie", at: expect.any(String) });
    expect(placeOf({ to: "work", at: "farm" })).toEqual({ kind: "building", id: "farm" });
    expect(placeOf({ to: "study" })).toEqual({ kind: "building", id: "scriptorium" });
    expect(placeOf(undefined)).toEqual({ kind: "rest" });
  });
});
