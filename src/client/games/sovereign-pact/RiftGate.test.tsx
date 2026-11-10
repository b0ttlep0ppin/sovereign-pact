import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { sovereignPact as g, type SovState } from "@vibepulse/shared/games/sovereign-pact";
import { openGate } from "../../../shared/games/sovereign-pact/gate.ts";
import { found, campaign } from "../../../shared/games/sovereign-pact/testing.ts";
import ChainMap from "./ChainMap";
import RiftGate from "./RiftGate";

const settled = () => {
  const s = found(campaign(2, 4));
  s.gate = {
    cards: [
      { type: "resource", pool: "beast_lands", level: 2, size: 4 },
      { type: "hunt", pool: "beast_lands", level: 3, size: 4 },
    ],
    votes: [null, 1],
  };
  return s;
};

describe("the Rift Gate's cards (§9.1)", () => {
  it("says when the Gate stays shut and no expedition goes", () => {
    const s = found(campaign(2, 4));
    s.flags.push("expedition_delayed");
    openGate(s);
    expect(s.gate?.cards).toEqual([]);
    render(<RiftGate view={g.view(s, s.players[0]!)} sendMove={() => {}} canVote />);
    expect(screen.getByText(/No expedition this Year/).textContent).toContain("walls are manned");
  });

  it("lays out each card with its type, pool and level, and the votes cast", () => {
    const s = settled();
    render(<RiftGate view={g.view(s, s.players[0]!)} sendMove={() => {}} canVote />);
    expect(screen.getByText("Resource")).toBeTruthy();
    expect(screen.getByText("Hunt")).toBeTruthy();
    expect(screen.getAllByText("The Beast Lands").length).toBe(2);
    expect(screen.getByLabelText("level 3")).toBeTruthy();
    expect(screen.getByLabelText("1 vote")).toBeTruthy();
  });

  it("votes for a card", () => {
    const s = settled();
    const sendMove = vi.fn();
    render(<RiftGate view={g.view(s, s.players[0]!)} sendMove={sendMove} canVote />);
    fireEvent.click(screen.getAllByRole("button", { name: "Vote" })[0]!);
    expect(sendMove).toHaveBeenCalledWith({ type: "pick_card", card: 0 });
  });

  it("offers no vote when there is nothing to choose", () => {
    const s = settled();
    s.gate!.cards = s.gate!.cards.slice(0, 1);
    render(<RiftGate view={g.view(s, s.players[0]!)} sendMove={() => {}} canVote />);
    expect(screen.queryByRole("button")).toBe(null);
  });
});

describe("the expedition's chain (§9.3)", () => {
  /** Plays bots until the party has passed a node or two. */
  function underway(): SovState {
    let s = found(campaign(1, 6));
    for (let i = 0; i < 5000; i++) {
      const e = s.expedition;
      if (s.phase === "expedition" && e?.leader !== undefined && e.at >= 2 && !e.event && !e.result) return s;
      const p = g.activePlayers(s)[0]!;
      const r = g.applyMove(s, p, g.botMove!(s, p, undefined as never));
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    throw new Error("no expedition got under way");
  }

  it("shows the places passed, the rest face down, and the boss at the end", () => {
    const s = underway();
    const view = g.view(s, s.players[0]!);
    render(<ChainMap view={view} />);
    const e = view.expedition!;
    expect(screen.getByLabelText(`${e.at} of ${e.length} places passed`)).toBeTruthy();
    expect(screen.getAllByTitle("Unknown").length).toBe(e.length - e.at - 1);
    expect(screen.getByTitle("Boss")).toBeTruthy();
    expect(screen.getByTitle("Leader")).toBeTruthy();
  });
});
