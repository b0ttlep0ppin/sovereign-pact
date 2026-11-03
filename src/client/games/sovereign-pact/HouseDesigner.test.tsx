import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Content, sovereignPact as g } from "@vibepulse/shared/games/sovereign-pact";
import { seats } from "../../../shared/games/sovereign-pact/testing.ts";
import { createRng } from "../../../shared/rng.ts";
import HouseDesigner, { missingOf, toggleTrait, traitShape } from "./HouseDesigner";

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

  it("chooses a Settlement theme from the game's music", () => {
    const { view } = founding();
    const sendMove = vi.fn();
    render(<HouseDesigner view={view} sendMove={sendMove} />);
    fireEvent.click(screen.getByRole("tab", { name: "Theme" }));
    expect(screen.queryByRole("button", { name: /Reroll/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Winter Sky" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "design", house: { theme: "winter-sky" } });
  });

  it("keeps a set of traits only when it has a shape §5.7 allows, and the rules agree", () => {
    const { s, view } = founding();
    const h = view.houses[0]!;
    expect(traitShape(h.traits)).toBe(true);
    expect(traitShape(h.traits.slice(1))).toBe(false);
    const sendMove = vi.fn();
    render(<HouseDesigner view={view} sendMove={sendMove} />);
    fireEvent.click(screen.getByRole("tab", { name: "Traits" }));
    const major = h.traits.find((id) => Content.HOUSE_TRAIT_BY_ID.get(id)!.kind === "major")!;
    fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(`^${Content.HOUSE_TRAIT_BY_ID.get(major)!.name}`) }));
    expect(screen.getByRole("status").textContent).toBe("Still to choose: a Major Trait.");
    expect(sendMove).not.toHaveBeenCalled();
    // Swap in another Major Trait, without Elemental Bane's choice: a whole set again, kept at once.
    const swap = Content.HOUSE_TRAITS.find((t) => t.kind === "major" && !h.traits.includes(t.id) && !t.choice)!;
    fireEvent.click(screen.getByRole("checkbox", { name: new RegExp(`^${swap.name}`) }));
    const patch = sendMove.mock.calls.at(-1)![0];
    expect(patch.type).toBe("design");
    expect(g.applyMove(s, "p1", patch).ok).toBe(true);
  });

  it("never holds more of a kind than the set allows", () => {
    const { view } = founding();
    const h = view.houses[0]!;
    const kindOf = (id: string) => Content.HOUSE_TRAIT_BY_ID.get(id)!.kind;
    const plain = h.traits.some((id) => kindOf(id) === "bloodline") ? toggleTrait(h.traits, Content.HOUSE_TRAITS.find((t) => t.kind === "major_flaw")!.id) : h.traits;
    const of = (kind: string, ids: string[]) => Content.HOUSE_TRAITS.find((t) => t.kind === kind && !ids.includes(t.id) && !t.choice)!.id;
    // A third Major Trait does not fit; a second Minor Flaw swaps out the first.
    expect(toggleTrait(plain, of("major", plain))).toEqual(plain);
    const flaw = of("minor_flaw", plain);
    const swapped = toggleTrait(plain, flaw);
    expect(swapped.filter((id) => kindOf(id) === "minor_flaw")).toEqual([flaw]);
    expect(traitShape(swapped)).toBe(true);
    // A Bloodline makes room for itself: one Major Trait and no Major Flaw, still a whole set.
    const blood = toggleTrait(plain, of("bloodline", plain));
    expect(traitShape(blood)).toBe(true);
    expect(missingOf(blood)).toBe("");
    // And a Major Flaw gives it up again, leaving a Major Trait to choose.
    const back = toggleTrait(blood, of("major_flaw", blood));
    expect(back.some((id) => kindOf(id) === "bloodline")).toBe(false);
    expect(missingOf(back)).toBe("Still to choose: a Major Trait.");
  });
});
