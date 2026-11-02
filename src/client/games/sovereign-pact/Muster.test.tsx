import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { sovereignPact as g } from "@vibepulse/shared/games/sovereign-pact";
import { calm, campaign } from "../../../shared/games/sovereign-pact/testing.ts";
import { able, muster } from "../../../shared/games/sovereign-pact/expedition.ts";
import SovereignPact from "./index";

/** A solo House at the start of an expedition with two seats and more Scions than seats. */
function mustering() {
  const s = calm(campaign(1, 5));
  s.phase = "expedition";
  muster(s, { type: "resource", pool: "beast_lands", level: 1, size: 4 });
  s.expedition!.seats[0] = 2;
  const sendMove = vi.fn();
  render(<SovereignPact me="p1" players={[]} isMyTurn={true} sendMove={sendMove} lastError={null} view={g.view(s, "p1")} />);
  return { s, sendMove, ids: able(s, 0).map((p) => p.id) };
}

const grid = () => screen.getByRole("grid", { name: "The party's grid" });
const standing = () => within(grid()).queryAllByRole("gridcell").filter((c) => c.classList.contains("is-taken")).length;

describe("fielding your seats on an expedition (§9.2)", () => {
  it("shows each Scion as a card, counts the seats, and puts only the chosen in the formation", () => {
    const { sendMove } = mustering();
    const cards = within(screen.getByRole("group", { name: "Your Scions" })).getAllByRole("button");
    expect(cards.length).toBeGreaterThan(2);
    expect(screen.getByText(/seats filled/).textContent).toMatch(/^2 of 2/);
    expect(cards.filter((c) => c.getAttribute("aria-pressed") === "true")).toHaveLength(2);
    // Full: the others wait until someone is set down.
    const out = cards.find((c) => c.getAttribute("aria-pressed") === "false")!;
    expect((out as HTMLButtonElement).disabled).toBe(true);
    expect(standing()).toBe(2);
    fireEvent.click(cards.find((c) => c.getAttribute("aria-pressed") === "true")!);
    expect(screen.getByText(/seats filled/).textContent).toMatch(/^1 of 2/);
    expect(standing()).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Send 1 Scion on the expedition" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "field", people: [expect.any(Number)] });
  });

  it("declines the seats when no one is chosen", () => {
    const { sendMove } = mustering();
    for (const c of within(screen.getByRole("group", { name: "Your Scions" })).getAllByRole("button", { pressed: true })) fireEvent.click(c);
    expect(standing()).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Decline the seats" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "field", people: [] });
  });
});

describe("your stores", () => {
  it("shows gold and every basic resource in one band", () => {
    const { s } = mustering();
    const band = screen.getByRole("list", { name: "Your stores" });
    expect(within(band).getByText(/Gold/).textContent).toContain(String(s.houses[0]!.gold));
    for (const k of ["Grain", "Timber", "Stone", "Iron", "Essence"]) expect(within(band).getByText(new RegExp(k))).toBeTruthy();
  });
});
