import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { sovereignPact as g, type SovMove, type SovState } from "@vibepulse/shared/games/sovereign-pact";
import { able, muster } from "../../../shared/games/sovereign-pact/expedition.ts";
import { calm, campaign } from "../../../shared/games/sovereign-pact/testing.ts";
import SovereignPact from "./index";

function atChapel(): SovState {
  let s = calm(campaign(1, 3));
  s.phase = "expedition";
  muster(s, { type: "delve", pool: "barrows", level: 2, size: 4 });
  const r = g.applyMove(s, "p1", { type: "field", people: able(s, 0).slice(0, 4).map((p) => p.id) });
  if (!r.ok) throw new Error(r.error);
  s = r.state;
  s.expedition!.seen.push("collapsed_chapel");
  s.expedition!.event = { id: "collapsed_chapel", votes: [null] };
  return s;
}

describe("events (Josh's playtest: name your own Scion; then see what it did)", () => {
  it("names a Scion for the dig, then tells what happened to them", () => {
    let s = atChapel();
    const moves: SovMove[] = [];
    const { unmount } = render(<SovereignPact me="p1" players={[]} isMyTurn sendMove={(m) => moves.push(m)} lastError={null} view={g.view(s, "p1")} />);
    const pick = s.expedition!.party[0]!.at(-1)!;
    const name = s.people.find((p) => p.id === pick)!.name;
    fireEvent.change(screen.getByRole("combobox"), { target: { value: String(pick) } });
    fireEvent.click(screen.getByRole("button", { name: "The strongest digs for the light." }));
    expect(moves.at(-1)).toEqual({ type: "decide", option: 0, person: pick });
    unmount();
    const r = g.applyMove(s, "p1", moves.at(-1)!);
    if (!r.ok) throw new Error(r.error);
    s = r.state;
    render(<SovereignPact me="p1" players={[]} isMyTurn sendMove={() => {}} lastError={null} view={g.view(s, "p1")} />);
    const card = screen.getByRole("dialog", { name: "What happened" });
    expect(card.textContent).toContain("The Collapsed Chapel");
    expect(card.textContent).toContain(`It fell on ${name}.`);
    expect(card.textContent).toContain(s.expedition!.told!.parts[0]!.text);
    fireEvent.click(screen.getByRole("button", { name: "Go on" }));
    expect(screen.queryByRole("dialog", { name: "What happened" })).toBeNull();
  });
});
