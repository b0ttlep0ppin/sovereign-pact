import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { sovereignPact as g, type SovMove } from "@vibepulse/shared/games/sovereign-pact";
import { answerOwed, campaign, found } from "../../../shared/games/sovereign-pact/testing.ts";
import SovereignPact from "./index";

describe("sealing the Year (Josh 2026-11-02)", () => {
  it("asks first when Scions have no assignment, naming them", () => {
    const s = answerOwed(found(campaign(1, 2)), 0);
    const v = g.view(s, s.players[0]!);
    const idle = v.people.filter((p) => p.host === v.me && p.status === "scion" && !v.mine?.assign[p.id]);
    expect(v.phase).toBe("settlement");
    expect(idle.length).toBeGreaterThan(0);
    const sent: SovMove[] = [];
    render(<SovereignPact me="p1" players={[]} isMyTurn sendMove={(m: SovMove) => sent.push(m)} lastError={null} view={v} />);
    fireEvent.click(screen.getByRole("button", { name: "Seal the Year" }));
    expect(sent).toEqual([]);
    expect(screen.getByRole("alertdialog").textContent).toContain(idle[0]!.name);
    fireEvent.click(screen.getByRole("button", { name: "Seal anyway" }));
    expect(sent).toEqual([{ type: "seal" }]);
  });

  it("holds the Seal back while a town event waits on the House's choice, and says which (Josh 2026-11-03)", () => {
    const s = found(campaign(1, 2));
    const v = g.view(s, s.players[0]!);
    expect(v.mine!.owed).toBeTruthy();
    render(<SovereignPact me="p1" players={[]} isMyTurn sendMove={() => undefined} lastError={null} view={v} />);
    expect((screen.getByRole("button", { name: "Seal the Year" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(v.mine!.owed!)).toBeTruthy();
  });
});
