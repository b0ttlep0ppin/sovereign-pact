import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Content, sovereignPact as g } from "@vibepulse/shared/games/sovereign-pact";
import { calm, campaign } from "../../../shared/games/sovereign-pact/testing.ts";
import { mintNamed } from "../../../shared/games/sovereign-pact/items.ts";
import Roster from "./Roster";

/** A calm settlement: House 0 with Gold, a Retired Scion, a Tarot Token, and a Surgeon's Kit for an injured Scion. */
function town() {
  const s = calm(campaign(2, 3));
  const h = s.houses[0]!;
  h.gold = 100;
  h.consumables = { tarot_token: 1 };
  const [scion, other] = s.people.filter((p) => p.host === 0 && p.status === "scion");
  other!.status = "retired";
  scion!.injuries = [{ id: "head_concussion", years: 1 }];
  s.items.push(mintNamed(s, "surgeons_kit", 0, 5));
  const recruit = s.people.find((p) => p.host === 0 && p.status === "recruit")!;
  // Names nobody else carries, so each card is found by its own.
  [scion!.name, other!.name, recruit.name] = ["Aldous Testament", "Berenice Testament", "Cedric Testament"];
  return { s, scion: scion!, retired: other!, recruit };
}

describe("your people", () => {
  it("promotes a recruit into the base Job chosen", () => {
    const { s, recruit } = town();
    const sendMove = vi.fn();
    render(<Roster view={g.view(s, "p1")} sendMove={sendMove} canAct />);
    const card = screen.getByRole("listitem", { name: recruit.name });
    fireEvent.change(within(card).getByLabelText(`Job for ${recruit.name}`), { target: { value: "knight" } });
    fireEvent.click(within(card).getByRole("button", { name: /Promote/ }));
    expect(sendMove).toHaveBeenCalledWith({ type: "promote", person: recruit.id, job: "knight" });
  });

  it("shows the birth House's traits on a Scion's card, not on a recruit's (Josh 2026-11-10)", () => {
    const { s, scion, recruit } = town();
    s.houses[0]!.traits = ["sanguine"];
    render(<Roster view={g.view(s, "p1")} sendMove={vi.fn()} canAct />);
    const card = screen.getByRole("listitem", { name: scion.name });
    const line = within(card).getByText("Sanguine").closest("li")!;
    expect(line.getAttribute("data-kind")).toBe("Bloodline");
    expect(within(screen.getByRole("listitem", { name: recruit.name })).queryByText("Sanguine")).toBeNull();
  });

  it("tells what a recruit does with the Year and sets them to train or back to work (8ae)", () => {
    const { s, recruit } = town();
    delete s.assign[recruit.id];
    const sendMove = vi.fn();
    render(<Roster view={g.view(s, "p1")} sendMove={sendMove} canAct />);
    const card = screen.getByRole("listitem", { name: recruit.name });
    expect(within(card).getByText(/on their own|No free work/)).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "Train" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "assign", person: recruit.id, to: "train" });
  });

  it("retires a Scion, brings back the Retired, mends an injury and draws a Tarot", () => {
    const { s, scion, retired } = town();
    const sendMove = vi.fn();
    render(<Roster view={g.view(s, "p1")} sendMove={sendMove} canAct />);
    const card = screen.getByRole("listitem", { name: scion.name });
    expect(card.querySelector(".sp-person__injuries")!.textContent).toContain(Content.INJURY_BY_ID.get("head_concussion")!.name);
    fireEvent.click(within(card).getByRole("button", { name: "Retire" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "retire", person: scion.id });
    fireEvent.click(within(card).getByRole("button", { name: /^Mend .* with Surgeon/ }));
    expect(sendMove).toHaveBeenCalledWith(expect.objectContaining({ type: "cure", person: scion.id, injury: "head_concussion" }));
    fireEvent.click(within(card).getByRole("button", { name: "Draw a new Tarot" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "draw_tarot", person: scion.id });
    fireEvent.click(within(screen.getByRole("listitem", { name: retired.name })).getByRole("button", { name: "Return to arms" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "reinstate", person: retired.id });
  });

  it("only shows the House's people, without moves once sealed", () => {
    const { s, scion } = town();
    render(<Roster view={g.view(s, "p1")} sendMove={() => {}} canAct={false} />);
    expect(within(screen.getByRole("listitem", { name: scion.name })).queryByRole("button")).toBeNull();
    const rival = s.people.find((p) => p.host === 1)!;
    expect(screen.queryByRole("listitem", { name: rival.name })).toBeNull();
  });
});

describe("restyling on the card (§5.8)", () => {
  it("steps through hair and beard and sends each choice at once", () => {
    const { s, scion } = town();
    scion.sex = "m";
    scion.look = [...scion.look, "hair=plain"];
    const sendMove = vi.fn();
    render(<Roster view={g.view(s, "p1")} sendMove={sendMove} canAct />);
    const card = screen.getByRole("listitem", { name: scion.name });
    const hair = within(card).getByRole("group", { name: `Hair for ${scion.name}` });
    expect(within(hair).getByText("Plain")).toBeTruthy();
    fireEvent.click(within(hair).getByRole("button", { name: "Next hair" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "restyle", person: scion.id, hair: "parted_side_bangs" });
    fireEvent.click(within(card).getByRole("button", { name: "As they were born" }));
    expect(sendMove).toHaveBeenLastCalledWith({ type: "restyle", person: scion.id, hair: "", hair_color: "", beard: "", headwear: "" });
    const headwear = within(card).getByRole("switch", { name: `Headwear for ${scion.name}` });
    expect(headwear.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(headwear);
    expect(sendMove).toHaveBeenLastCalledWith({ type: "restyle", person: scion.id, headwear: "off" });
    expect(within(card).getByRole("group", { name: `Beard for ${scion.name}` })).toBeTruthy();
  });
});
