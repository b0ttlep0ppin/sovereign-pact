import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { sovereignPact as g, type SovMove, type SovState } from "@vibepulse/shared/games/sovereign-pact";
import { calm, campaign } from "../../../shared/games/sovereign-pact/testing.ts";
import Readying from "./Readying";

const apply = (s: SovState, m: SovMove): SovState => {
  const r = g.applyMove(s, "p1", m);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

describe("a Scion's gambits on the Readying screen", () => {
  it("adds a rule, then changes when, what and at whom", () => {
    let s = calm(campaign(1, 3));
    const p = s.people.find((x) => x.host === 0 && x.status === "scion")!;
    const sendMove = vi.fn();
    const { rerender } = render(<Readying view={g.view(s, "p1")} sendMove={sendMove} canAct />);
    fireEvent.click(screen.getByRole("button", { name: "Add a gambit" }));
    expect(sendMove).toHaveBeenLastCalledWith({ type: "gambits", person: p.id, rules: [{ do: "attack" }] });
    s = apply(s, sendMove.mock.lastCall![0]);
    rerender(<Readying view={g.view(s, "p1")} sendMove={sendMove} canAct />);
    const list = screen.getByRole("list", { name: "Gambits" });
    fireEvent.change(within(list).getByLabelText("Gambit 1: when"), { target: { value: "self.hp<0.3" } });
    expect(sendMove).toHaveBeenLastCalledWith({ type: "gambits", person: p.id, rules: [{ if: "self.hp<0.3", do: "attack" }] });
    fireEvent.change(within(list).getByLabelText("Gambit 1: at"), { target: { value: "nearest" } });
    expect(sendMove).toHaveBeenLastCalledWith({ type: "gambits", person: p.id, rules: [{ do: "attack", target: "nearest" }] });
    // Defend aims at no one: the target goes with it.
    fireEvent.change(within(list).getByLabelText("Gambit 1: do"), { target: { value: "defend" } });
    expect(sendMove).toHaveBeenLastCalledWith({ type: "gambits", person: p.id, rules: [{ do: "defend" }] });
    // Every move the screen sends, the rules take.
    for (const [m] of sendMove.mock.calls) apply(s, m);
    fireEvent.click(within(list).getByRole("button", { name: "Remove gambit 1" }));
    expect(sendMove).toHaveBeenLastCalledWith({ type: "gambits", person: p.id, rules: [] });
  });
});
