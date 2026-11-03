import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { sovereignPact as g, type SovMove, type SovState } from "@vibepulse/shared/games/sovereign-pact";
import { able, muster } from "../../../shared/games/sovereign-pact/expedition.ts";
import { pressOn } from "../../../shared/games/sovereign-pact/journey.ts";
import { calm, campaign } from "../../../shared/games/sovereign-pact/testing.ts";
import SovereignPact from "./index";

function atCamp(): SovState {
  let s = calm(campaign(1, 3));
  s.phase = "expedition";
  muster(s, { type: "delve", pool: "barrows", level: 2, size: 4 });
  const r = g.applyMove(s, "p1", { type: "field", people: able(s, 0).slice(0, 4).map((p) => p.id) });
  if (!r.ok) throw new Error(r.error);
  s = r.state;
  s.expedition!.chain = ["camp", "boss"];
  s.expedition!.at = 0;
  pressOn(s);
  return s;
}

describe("the camp (Josh's playtest)", () => {
  it("plays the fire's talk a line at a time, then breaks camp", () => {
    const s = atCamp();
    const lines = s.expedition!.camp!.lines;
    expect(lines.length).toBeGreaterThan(1);
    const v = g.view(s, "p1");
    render(<SovereignPact me="p1" players={[]} isMyTurn sendMove={(() => {}) as (m: SovMove) => void} lastError={null} view={v} />);
    const camp = screen.getByRole("dialog", { name: "The camp" });
    expect(camp.textContent).toContain(lines[0]!.text);
    expect(camp.textContent).not.toContain(lines.at(-1)!.text);
    fireEvent.click(screen.getByRole("button", { name: "Skip the talk" }));
    expect(camp.textContent).toContain(lines.at(-1)!.text);
    fireEvent.click(screen.getByRole("button", { name: "Break camp" }));
    expect(screen.queryByRole("dialog", { name: "The camp" })).toBeNull();
  });
});
