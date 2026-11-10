import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Content, sovereignPact as g } from "@vibepulse/shared/games/sovereign-pact";
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

  it("stands the battle under its region's sky and on its ground, with every bar labelled (Josh's playtest)", () => {
    const { view, replay } = setup();
    render(<BattleScreen replay={{ ...replay, pool: "pit" }} view={view} onClose={() => {}} />);
    const root = screen.getByRole("dialog", { name: "Battle: An Encounter" });
    expect(root.style.getPropertyValue("--sp-ground")).toContain("ground-pit.webp");
    expect(root.style.getPropertyValue("--sp-sky")).toContain("sky.webp");
    const party = screen.getByRole("region", { name: "The party" });
    for (const label of ["HP", "MP", "TP", "San"]) expect(party.querySelectorAll(`[role="meter"][aria-label="${label}"]`).length).toBeGreaterThan(0);
    const first = replay.units.find((u) => u.side === "party")!;
    expect(party.textContent).toContain(`${first.maxHp}/${first.maxHp}`);
  });

  it("marks each Scion with their House's arms in miniature", () => {
    const { view, replay } = setup();
    const owned = { ...replay, units: replay.units.map((u) => (u.side === "party" ? { ...u, house: 0 } : u)) };
    render(<BattleScreen replay={owned} view={view} onClose={() => {}} />);
    const party = owned.units.filter((u) => u.side === "party" && u.partOf === undefined).length;
    expect(party).toBeGreaterThan(0);
    expect(document.querySelectorAll(".sp-unit__house").length).toBe(party);
    // On the field (the log's lines carry the arms too).
    expect(screen.getAllByTitle(`House ${view.houses[0]!.name}`).filter((el) => el.classList.contains("sp-unit__house")).length).toBe(party);
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

  it("plays on from where a live battle's screen was when it ended, then shows the ending (Josh 2026-11-10)", () => {
    vi.useFakeTimers();
    const { view, replay } = setup();
    const from = Math.max(1, replay.frames.length - 2);
    render(<BattleScreen replay={replay} view={view} onClose={() => {}} from={from} />);
    // No pause before it: it was already seen; the last turns play, not the ending at once.
    expect(screen.queryByRole("region", { name: "Before the battle" })).toBe(null);
    expect(screen.getByText(`Turn ${from} of ${replay.frames.length}`)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Continue" })).toBe(null);
    for (let i = 0; i < 40 && !screen.queryByRole("button", { name: "Continue" }); i++) act(() => void vi.advanceTimersByTime(1500));
    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
    vi.useRealTimers();
  });

  it("waits on its owner to throw an injury's die, then shows where it landed and what it does (Josh's playtest)", () => {
    vi.useFakeTimers();
    const { view, replay } = setup();
    const scion = replay.units.find((u) => u.side === "party" && u.partOf === undefined)!;
    const head = Content.INJURY_TABLES.find((x) => x.id === "head")!;
    const hit = head.results.find((r) => r.band === "moderate")!;
    const frames = replay.frames.map((f, i) => (i === 0 ? { ...f, ev: [...f.ev, { t: "injury" as const, target: scion.id, table: "head", roll: hit.max, total: hit.max, result: hit.id }] } : f));
    const owned = { ...replay, frames, units: replay.units.map((u) => (u.side === "party" ? { ...u, house: 0 } : u)) };
    render(<BattleScreen replay={owned} view={view} onClose={() => {}} />);
    act(() => void vi.advanceTimersByTime(5000));
    act(() => void vi.advanceTimersByTime(3000));
    const die = screen.getByRole("button", { name: `Roll the d20 for ${scion.name}` });
    // It holds there until the die is thrown.
    act(() => void vi.advanceTimersByTime(20000));
    expect(screen.getByText(`Turn 1 of ${frames.length}`)).toBeTruthy();
    expect(screen.queryByText(hit.name)).toBe(null);
    fireEvent.click(die);
    expect(screen.getByText("The die tumbles…")).toBeTruthy();
    act(() => void vi.advanceTimersByTime(1600));
    expect(screen.getByText(hit.name)).toBeTruthy();
    expect(screen.getByText(hit.text)).toBeTruthy();
    act(() => void vi.advanceTimersByTime(4000));
    expect(screen.getByText(`Turn 2 of ${frames.length}`)).toBeTruthy();
    // The ending names it, and says what it does on hover.
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "End" });
    expect(screen.getByLabelText(`${hit.name}: ${hit.text}`).getAttribute("data-tip")).toBe(hit.text);
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
    // What the Omens decided is told first; put it away.
    const decided = screen.queryByRole("dialog", { name: "What was decided" });
    if (decided) fireEvent.click(within(decided).getByRole("button", { name: "Go on" }));
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
