import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { sovereignPact as g } from "@vibepulse/shared/games/sovereign-pact";
import { warbandBattle } from "../../../shared/games/sovereign-pact/combat/fixtures.ts";
import { recorded } from "../../../shared/games/sovereign-pact/combat/replay.ts";
import { found, campaign } from "../../../shared/games/sovereign-pact/testing.ts";
import BattleScreen, { abilityName, framesOf } from "./BattleScreen";
import SovereignPact from "./index";

const setup = () => {
  const s = found(campaign(1, 2));
  const view = g.view(s, s.players[0]!);
  const { replay } = recorded(warbandBattle(3, 3), "An Encounter");
  return { s, view, replay };
};

describe("the battle screen (§15.5)", () => {
  it("draws both sides from the replay's start", () => {
    const { view, replay } = setup();
    render(<BattleScreen replay={replay} view={view} onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: "Battle: An Encounter" })).toBeTruthy();
    for (const u of replay.units.filter((x) => x.side === "party")) expect(screen.getAllByText(u.name).length).toBeGreaterThan(0);
    expect(screen.getByText(`Turn 0 of ${replay.frames.length}`)).toBeTruthy();
  });

  it("marks each Scion with their House's arms in miniature", () => {
    const { view, replay } = setup();
    const owned = { ...replay, units: replay.units.map((u) => (u.side === "party" ? { ...u, house: 0 } : u)) };
    render(<BattleScreen replay={owned} view={view} onClose={() => {}} />);
    const party = owned.units.filter((u) => u.side === "party" && u.partOf === undefined).length;
    expect(party).toBeGreaterThan(0);
    expect(document.querySelectorAll(".sp-unit__house").length).toBe(party);
    expect(screen.getAllByTitle(`House ${view.houses[0]!.name}`).length).toBe(party);
  });

  it("plays turn by turn, steps by keyboard, and skips to the end", () => {
    vi.useFakeTimers();
    const { view, replay } = setup();
    const onClose = vi.fn();
    render(<BattleScreen replay={replay} view={view} onClose={onClose} />);
    // The pause before the fight (an omen), then the first turn.
    expect(screen.getByRole("region", { name: "Before the battle" })).toBeTruthy();
    act(() => void vi.advanceTimersByTime(5000));
    act(() => void vi.advanceTimersByTime(2000));
    expect(screen.queryByRole("region", { name: "Before the battle" })).toBe(null);
    const dialog = screen.getByRole("dialog");
    expect(screen.queryByText(`Turn 0 of ${replay.frames.length}`)).toBe(null);
    fireEvent.keyDown(dialog, { key: "End" });
    expect(screen.getByText(`Turn ${replay.frames.length} of ${replay.frames.length}`)).toBeTruthy();
    expect(screen.getAllByText(replay.outcome === "victory" ? "Victory" : /The party/).length).toBeGreaterThan(0);
    // The ending: how it went, and Continue.
    expect(screen.getByRole("region", { name: replay.outcome === "victory" ? "Victory" : "Defeat" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "ArrowLeft" });
    expect(screen.getByText(`Turn ${replay.frames.length - 1} of ${replay.frames.length}`)).toBeTruthy();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("folds the frames into each turn's vitals", () => {
    const { replay } = setup();
    const states = framesOf(replay);
    expect(states).toHaveLength(replay.frames.length + 1);
    const lastHit = [...replay.frames].reverse().find((f) => f.vit.length)!;
    const i = replay.frames.lastIndexOf(lastHit) + 1;
    for (const v of lastHit.vit) expect(states[i]!.get(v[0])).toEqual(v);
  });

  it("names abilities by their content names", () => {
    expect(abilityName("attack")).toBe("Attack");
    expect(abilityName("item:tonic")).not.toMatch(/item:/);
  });
});

describe("battles in the campaign screen", () => {
  it("opens a new battle on its own, and lists it to watch again", () => {
    const { view, replay } = setup();
    const props = { me: "p1", players: [], isMyTurn: false, sendMove: () => {}, lastError: null };
    const { rerender } = render(<SovereignPact {...props} view={view} />);
    expect(screen.queryByRole("dialog")).toBe(null);
    rerender(<SovereignPact {...props} view={{ ...view, battles: [{ ...replay, key: "1:9:0" }] }} />);
    expect(screen.getByRole("dialog", { name: "Battle: An Encounter" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBe(null);
    // The next move drops the replay from the view; the screen keeps it.
    rerender(<SovereignPact {...props} view={{ ...view, battles: [] }} />);
    // In town the list sits under its own tab.
    const tab = screen.queryByRole("tab", { name: "Battles" });
    if (tab) fireEvent.click(tab);
    fireEvent.click(screen.getByRole("button", { name: "Watch" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
