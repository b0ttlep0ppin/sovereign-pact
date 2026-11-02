import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { sovereignPact as g } from "@vibepulse/shared/games/sovereign-pact";
import { createRng } from "../../../shared/rng.ts";
import { seats } from "../../../shared/games/sovereign-pact/testing.ts";
import type { SovState } from "../../../shared/games/sovereign-pact/index.ts";
import Volunteers from "./Volunteers";

/** Two Houses sworn, the muster open. */
function sworn(): SovState {
  let s = g.setup(seats(2), createRng(4), undefined, { battles: "gambits" });
  for (const p of s.players) {
    const r = g.applyMove(s, p, g.botMove!(s, p, undefined as never));
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  }
  return s;
}

describe("the muster", () => {
  it("lets the House whose pick it is choose a volunteer and a Job, then take them", () => {
    const s = sworn();
    const seat = s.muster!.order[0]!;
    const view = g.view(s, s.players[seat]!);
    const sendMove = vi.fn();
    render(<Volunteers view={view} sendMove={sendMove} />);
    expect(screen.getByRole("status").textContent).toMatch(/^Your pick/);
    const v = view.muster!.pool[0]!;
    const take = () => screen.getByRole("button", { name: /^(Take|Choose a|Choose their)/ });
    expect((take() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: `Choose ${v.name}` }));
    fireEvent.click(screen.getByRole("button", { name: /^Knight/ }));
    fireEvent.click(take());
    expect(sendMove).toHaveBeenCalledWith({ type: "muster", person: v.id, job: "knight" });
  });

  it("shows the others whose pick it is, and no buttons", () => {
    const s = sworn();
    const other = 1 - s.muster!.order[0]!;
    const view = g.view(s, s.players[other]!);
    render(<Volunteers view={view} sendMove={() => {}} />);
    expect(screen.getByRole("status").textContent).toMatch(/is choosing\.$/);
    expect(screen.queryByRole("button", { name: /^Choose / })).toBeNull();
    // Q94: everyone sees every volunteer in full.
    expect(view.muster!.pool.every((v) => v.base && v.potential && v.growth && v.tarot)).toBe(true);
    expect(view.muster!.pool.map((v) => v.traits)).toEqual(s.muster!.pool.map((p) => p.traits));
  });
});
