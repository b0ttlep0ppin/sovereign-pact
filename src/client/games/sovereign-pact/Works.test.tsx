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
    fireEvent.change(within(row).getByLabelText("Gold"), { target: { value: "5" } });
    fireEvent.click(within(row).getByRole("button", { name: "Pledge" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "pledge", project: "granary", give: { gold: 5 } });
    fireEvent.click(within(row).getByRole("button", { name: "Propose the Commons pay" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "propose", project: "granary", host: 0 });
  });

  it("offers no buttons once sealed", () => {
    render(<Works view={g.view(town(), "p1")} sendMove={() => {}} canAct={false} />);
    const row = screen.getByText(FARM.name).closest("li")!;
    expect((within(row).getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Pledge" })).toBeNull();
  });
});

describe("the Altar of Offerings (Josh 2026-11-03: sacrifice small stuff for an expedition bonus)", () => {
  it("offers Grain, a recruit or blood once the altar stands, and then says what was laid", () => {
    const s = town();
    s.houses[0]!.stores.grain = 40;
    expect(g.view(s, "p1").mine!.altar).toBeNull();
    s.commons.built.altar_of_offerings = 1;
    const sendMove = vi.fn();
    const { rerender } = render(<Works view={g.view(s, "p1")} sendMove={sendMove} canAct />);
    const altar = screen.getByRole("region", { name: "The Altar of Offerings" });
    fireEvent.click(within(within(altar).getByText("Lay Grain").closest("li")!).getByRole("button", { name: "Offer" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "altar", gift: "grain" });
    const r = g.applyMove(s, "p1", { type: "altar", gift: "grain" });
    if (!r.ok) throw new Error(r.error);
    rerender(<Works view={g.view(r.state, "p1")} sendMove={sendMove} canAct />);
    expect(within(screen.getByRole("region", { name: "The Altar of Offerings" })).getByText(/Every battle opens with 15 TP/)).toBeTruthy();
  });
});

describe("the Commons Council (Josh 2026-11-03: debated by the players)", () => {
  it("proposes the Commons pay for a project sited in a chosen House's district, and moves a levy", () => {
    const s = town();
    const sendMove = vi.fn();
    render(<Works view={g.view(s, "p1")} sendMove={sendMove} canAct />);
    const row = screen.getByText(GRANARY.name).closest("li")!;
    expect(within(row).getByText(new RegExp(`Host's perk: ${GRANARY.host!.text.replace(/[+]/g, "\\+")}`))).toBeTruthy();
    fireEvent.change(within(row).getByLabelText("Site it in"), { target: { value: "1" } });
    fireEvent.click(within(row).getByRole("button", { name: "Propose the Commons pay" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "propose", project: "granary", host: 1 });
    fireEvent.click(screen.getByRole("button", { name: /Move a levy/ }));
    expect(sendMove).toHaveBeenCalledWith({ type: "levy" });
  });
});

describe("Year orders (Josh 2026-11-03: only Year orders)", () => {
  it("lists a standing building's orders with their price, and gives one for a chosen Scion", () => {
    const s = town();
    s.houses[0]!.buildings = { training_ground: 1, forge: 1 };
    s.houses[0]!.stores = { ...s.houses[0]!.stores, iron: 30 };
    const sendMove = vi.fn();
    render(<Works view={g.view(s, "p1")} sendMove={sendMove} canAct />);
    const forge = screen.getByRole("list", { name: "Forge orders" });
    expect(within(forge).getByText(/Craft a Common piece/)).toBeTruthy();
    expect(within(forge).queryByText(/Craft a Fine piece/)).toBeNull();
    fireEvent.click(within(forge).getByRole("button", { name: "Order" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "order", building: "forge", order: "craft" });
    const drill = screen.getByRole("list", { name: "Training Ground orders" });
    const mine = s.people.filter((p) => p.host === 0 && p.status === "scion");
    fireEvent.change(within(drill).getByLabelText("For"), { target: { value: String(mine[1]!.id) } });
    fireEvent.click(within(drill).getByRole("button", { name: "Order" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "order", building: "training_ground", order: "drill", person: mine[1]!.id });
  });
});
