import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Content, sovereignPact as g } from "@vibepulse/shared/games/sovereign-pact";
import { calm, campaign } from "../../../shared/games/sovereign-pact/testing.ts";
import Works, { costText } from "./Works";

const FARM = Content.BUILDING_BY_ID.get("farm")!;
const GRANARY = Content.PROJECT_BY_ID.get("granary")!;

function town() {
  const s = calm(campaign(2, 3));
  s.houses[0]!.gold = 500;
  s.houses[0]!.stores = { ...s.houses[0]!.stores, timber: 40, stone: 40 };
  s.commons.gold = 100;
  return s;
}

describe("building", () => {
  it("builds a House building at its price, and cancels this Year's work", () => {
    const s = town();
    const sendMove = vi.fn();
    const view = g.view(s, "p1");
    const { rerender } = render(<Works view={view} sendMove={sendMove} canAct />);
    const farm = view.mine!.builds.find((b) => b.id === "farm")!;
    const row = screen.getByText(FARM.name).closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: `Build, ${costText(farm.cost!)}` }));
    expect(sendMove).toHaveBeenCalledWith({ type: "build", building: "farm" });
    const r = g.applyMove(s, "p1", { type: "build", building: "farm" });
    if (!r.ok) throw new Error(r.error);
    rerender(<Works view={g.view(r.state, "p1")} sendMove={sendMove} canAct />);
    fireEvent.click(within(screen.getByText(FARM.name).closest("li")!).getByRole("button", { name: /Cancel/ }));
    expect(sendMove).toHaveBeenCalledWith({ type: "unbuild", building: "farm" });
  });

  it("pledges to a Commons project and proposes spending the Commons on it", () => {
    const s = town();
    const sendMove = vi.fn();
    render(<Works view={g.view(s, "p1")} sendMove={sendMove} canAct />);
    const row = screen.getByText(GRANARY.name).closest("li")!;
    fireEvent.change(within(row).getByLabelText(/Gold/), { target: { value: "5" } });
    fireEvent.click(within(row).getByRole("button", { name: "Pledge" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "pledge", project: "granary", give: { gold: 5 } });
    fireEvent.click(within(row).getByRole("button", { name: "Propose the Commons pay" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "propose", project: "granary" });
  });

  it("offers no buttons once sealed", () => {
    render(<Works view={g.view(town(), "p1")} sendMove={() => {}} canAct={false} />);
    const row = screen.getByText(FARM.name).closest("li")!;
    expect((within(row).getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Pledge" })).toBeNull();
  });
});
