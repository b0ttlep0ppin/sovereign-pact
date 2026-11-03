import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { sovereignPact as g, type SovMove } from "@vibepulse/shared/games/sovereign-pact";
import { campaign, found } from "../../../shared/games/sovereign-pact/testing.ts";
import SovereignPact from "./index";

describe("the homecoming (Josh's playtest)", () => {
  it("shows what the expedition gave each Scion and what the House took, once", () => {
    const s = found(campaign(1, 2));
    const p = s.people.find((x) => x.status === "scion")!;
    s.homecoming = {
      year: 1,
      card: { type: "delve", pool: "barrows", level: 2, size: 4, boss: "tree_king" },
      result: "won",
      people: [
        { id: p.id, name: p.name, house: 0, levelFrom: 1, levelTo: 2, xp: 140, jp: 200, injuries: [] },
        { id: 999, name: "Ser Gone", house: 0, levelFrom: 2, levelTo: 2, xp: 0, jp: 0, injuries: [], fate: "fell" },
      ],
      claims: [{ house: 0, text: "4 Iron" }],
    };
    const v = g.view(s, s.players[0]!);
    const props = { me: "p1", players: [], isMyTurn: true, sendMove: (() => {}) as (m: SovMove) => void, lastError: null };
    const { rerender } = render(<SovereignPact {...props} view={v} />);
    const card = screen.getByRole("dialog", { name: "The homecoming" });
    expect(card.textContent).toContain("Home in triumph");
    expect(card.textContent).toContain("Level 1 → 2");
    expect(card.textContent).toContain("+140 XP");
    expect(card.textContent).toContain("Fell in the otherworld");
    expect(card.textContent).toContain("took 4 Iron");
    fireEvent.click(screen.getByRole("button", { name: "Back to the town" }));
    expect(screen.queryByRole("dialog", { name: "The homecoming" })).toBeNull();
    rerender(<SovereignPact {...props} view={{ ...v }} />);
    expect(screen.queryByRole("dialog", { name: "The homecoming" })).toBeNull();
  });
});
