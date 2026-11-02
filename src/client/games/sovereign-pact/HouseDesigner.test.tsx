import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Content, sovereignPact as g } from "@vibepulse/shared/games/sovereign-pact";
import { seats } from "../../../shared/games/sovereign-pact/testing.ts";
import { createRng } from "../../../shared/rng.ts";
import HouseDesigner, { traitShape } from "./HouseDesigner";

const founding = () => {
  const s = g.setup(seats(2), createRng(3), undefined, undefined);
  return { s, view: g.view(s, "p1") };
};

describe("founding a House (§5.1)", () => {
  it("renames the House and keeps its motto", () => {
    const { view } = founding();
    const sendMove = vi.fn();
    render(<HouseDesigner view={view} sendMove={sendMove} />);
    fireEvent.change(screen.getByLabelText("House name"), { target: { value: "Vellacourt" } });
    fireEvent.click(screen.getByRole("button", { name: "Keep this name" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "design", house: { name: "Vellacourt", motto: view.houses[0]!.motto } });
  });

  it("picks a color and a Seat, and rerolls a step with the dice", () => {
    const { view } = founding();
    const h = view.houses[0]!;
    const sendMove = vi.fn();
    render(<HouseDesigner view={view} sendMove={sendMove} />);
    fireEvent.click(screen.getByRole("tab", { name: "Colors" }));
    const other = Content.HERALDRY.palette.find((c) => !h.colors.includes(c.id))!;
    fireEvent.click(screen.getByRole("button", { name: `First color: ${other.name}` }));
    expect(sendMove).toHaveBeenCalledWith({ type: "design", house: { colors: [other.id, h.colors[1]] } });
    fireEvent.click(screen.getByRole("button", { name: /Reroll colors/ }));
    expect(sendMove).toHaveBeenCalledWith({ type: "random_house", step: "colors" });
    fireEvent.click(screen.getByRole("tab", { name: "Seat" }));
    const seat = Content.SEATS.find((x) => x.id !== h.seat)!;
    fireEvent.click(screen.getByText(seat.name).closest("li")!.querySelector("button")!);
    expect(sendMove).toHaveBeenCalledWith({ type: "design", house: { seat: seat.id } });
  });

  it("keeps a set of traits only when it has a shape §5.7 allows, and the rules agree", () => {
    const { s, view } = founding();
    const h = view.houses[0]!;
    expect(traitShape(h.traits)).toBe(true);
    expect(traitShape(h.traits.slice(1))).toBe(false);
    const sendMove = vi.fn();
    render(<HouseDesigner view={view} sendMove={sendMove} />);
    fireEvent.click(screen.getByRole("tab", { name: "Traits" }));
    const first = Content.HOUSE_TRAIT_BY_ID.get(h.traits[0]!)!;
    fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(`^${first.name}`) }));
    expect((screen.getByRole("button", { name: "Not a full set yet" }) as HTMLButtonElement).disabled).toBe(true);
    // Swap in another trait of the same kind, without Elemental Bane's choice.
    const swap = Content.HOUSE_TRAITS.find((t) => t.kind === first.kind && !h.traits.includes(t.id) && !t.choice)!;
    fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(`^${swap.name}`) }));
    fireEvent.click(screen.getByRole("button", { name: "Keep these traits" }));
    const patch = sendMove.mock.calls.at(-1)![0];
    expect(patch.type).toBe("design");
    expect(g.applyMove(s, "p1", patch).ok).toBe(true);
  });
});
