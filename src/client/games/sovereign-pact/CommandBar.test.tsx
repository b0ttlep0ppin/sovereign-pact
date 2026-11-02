import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { sovereignPact as g, type TurnView } from "@vibepulse/shared/games/sovereign-pact";
import { warbandBattle } from "../../../shared/games/sovereign-pact/combat/fixtures.ts";
import { recorded } from "../../../shared/games/sovereign-pact/combat/replay.ts";
import { campaign, found } from "../../../shared/games/sovereign-pact/testing.ts";
import BattleScreen from "./BattleScreen";

/** A battle on screen at its last turn, waiting on one of the party: a hand-made turn to command. */
const setup = (turn: (scion: number, foe: { side: "enemy"; col: number; row: number }) => TurnView | null, waiting: string | null = null) => {
  const s = found(campaign(1, 2));
  const view = g.view(s, s.players[0]!);
  const { replay } = recorded(warbandBattle(3, 3), "An Encounter");
  const live = { ...replay, frames: replay.frames.slice(0, 2) };
  const scion = live.units.find((u) => u.side === "party")!.id;
  const foe = live.start.find((v) => live.units.find((u) => u.id === v[0])?.side === "enemy")!;
  const send = vi.fn();
  render(<BattleScreen replay={live} view={view} onClose={() => {}} live={{ turn: turn(scion, { side: "enemy", col: foe[5], row: foe[6] }), waiting, send }} />);
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "End" });
  return { send, foe: { side: "enemy" as const, col: foe[5], row: foe[6] } };
};

const turnOf = (unit: number, foe: { side: "enemy"; col: number; row: number }): TurnView => ({
  unit,
  moved: false,
  moves: [[1, 0]],
  abilities: [
    { id: "attack", name: "Attack", mp: 0, tp: 0, why: null, aim: "unit", targets: [foe] },
    { id: "rally", name: "Rally", mp: 6, tp: 0, why: null, aim: "self" },
    { id: "firestorm", name: "Firestorm", mp: 40, tp: 0, why: "not enough MP", aim: "area", side: "enemy", shape: "burst:3x3" },
  ],
  items: [],
});

describe("commanding a turn (§15.5)", () => {
  it("lists what the Scion can do, with costs, and greys out what they cannot", () => {
    setup(turnOf);
    expect(screen.getByRole("group", { name: /'s turn$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Rally/ }).textContent).toBe("Rally 6 MP");
    expect((screen.getByRole("button", { name: /^Firestorm/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps the waiting turn a click away while you watch the battle back", () => {
    setup(turnOf);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowLeft" });
    expect(screen.queryByRole("group", { name: /'s turn$/ })).toBe(null);
    fireEvent.click(screen.getByRole("button", { name: /^Back to .*'s turn$/ }));
    expect(screen.getByRole("group", { name: /'s turn$/ })).toBeTruthy();
  });

  it("aims at a target by keyboard: arrows, then Enter", () => {
    const { send, foe } = setup(turnOf);
    fireEvent.click(screen.getByRole("button", { name: "Attack" }));
    expect(screen.getByRole("group", { name: "Choose a target" })).toBeTruthy();
    expect(document.querySelectorAll(".sp-unit.is-targetable, .sp-cell.is-target").length).toBeGreaterThan(0);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });
    expect(send).toHaveBeenCalledWith({ action: { do: "ability", ability: "attack", target: foe } });
  });

  it("aims by clicking the cell, and backs out with Escape", () => {
    const { send } = setup(turnOf);
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("group", { name: "Choose a target" })).toBe(null);
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    fireEvent.click(document.querySelector(".sp-grid--party .sp-cell.is-target")!);
    expect(send).toHaveBeenCalledWith({ move: [1, 0] });
  });

  it("sends a self-aimed choice at once, and hands turns to the gambits", () => {
    const { send } = setup(turnOf);
    fireEvent.click(screen.getByRole("button", { name: /^Rally/ }));
    expect(send.mock.calls[0]![0]).toMatchObject({ action: { do: "ability", ability: "rally", target: { side: "party" } } });
    fireEvent.click(screen.getByRole("button", { name: "Gambits: the rest of the battle" }));
    expect(send).toHaveBeenLastCalledWith({ auto: "battle" });
  });

  it("says whom the battle waits on when it is not this seat", () => {
    setup(() => null, "House Varn");
    expect(screen.getByText("Waiting on House Varn.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Hide the battle" })).toBeTruthy();
  });

  it("builds a Pugilist's combo: moves chained with their TP, a finisher once its pattern is met, then the strike", () => {
    const combo = (unit: number, foe: { side: "enemy"; col: number; row: number }): TurnView => ({
      ...turnOf(unit, foe),
      combo: {
        tp: 60,
        mp: 0,
        repeatTp: 5,
        targets: [foe],
        moves: [
          { id: "jab", name: "Jab", tp: 5, mp: 0, tag: "jab", strike: true, why: null },
          { id: "low_kick", name: "Low Kick", tp: 10, mp: 0, tag: "kick", strike: true, why: null },
          { id: "flurry", name: "Flurry", tp: 20, mp: 0, tag: "finisher", finisher: "jab,jab,jab", strike: true, why: null },
        ],
      },
    });
    const { send, foe } = setup(combo);
    fireEvent.click(screen.getByRole("button", { name: /^Build a combo/ }));
    const flurry = () => screen.getByRole("button", { name: /^Flurry/ }) as HTMLButtonElement;
    const jab = () => screen.getByRole("button", { name: /^Jab/ });
    expect(flurry().disabled).toBe(true);
    fireEvent.click(jab());
    // A repeat costs 5 TP more each time.
    expect(jab().textContent).toMatch(/10 TP/);
    fireEvent.click(jab());
    fireEvent.click(jab());
    expect(flurry().disabled).toBe(false);
    fireEvent.click(flurry());
    expect((screen.getByRole("button", { name: /^Low Kick/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("list", { name: "The chain" }).textContent).toBe("JabJabJabFlurry");
    fireEvent.click(screen.getByRole("button", { name: /^Strike/ }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Enter" });
    expect(send).toHaveBeenCalledWith({ action: { do: "combo", moves: ["jab", "jab", "jab", "flurry"], target: foe } });
  });
});
