import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { sovereignPact as g } from "@vibepulse/shared/games/sovereign-pact";
import { found, campaign } from "../../../shared/games/sovereign-pact/testing.ts";
import Deals, { sideText } from "./Deals";

function town() {
  const s = found(campaign(2, 4));
  s.houses[0]!.gold = 100;
  s.houses[0]!.stores.timber = 6;
  s.deals = [
    { id: 801, from: 1, to: 0, give: { gold: 20 }, get: { stores: { timber: 3 } }, open: false },
    { id: 802, from: 0, to: 1, give: { gold: 5 }, get: { stores: { grain: 2 } }, open: true },
  ];
  return { s, view: g.view(s, s.players[0]!) };
}

describe("deals (§8.9)", () => {
  it("accepts or declines an offer made to you, and withdraws your own", () => {
    const { view } = town();
    const sendMove = vi.fn();
    render(<Deals view={view} sendMove={sendMove} canAct />);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "accept", deal: 801 });
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "decline", deal: 802 });
  });

  it("reads a side in words", () => {
    const { view } = town();
    expect(sideText(view, { gold: 20, stores: { timber: 3 } })).toBe("20 Gold, 3 Timber");
    expect(sideText(view, {})).toBe("nothing");
  });

  it("makes an offer from what the House holds", () => {
    const { view } = town();
    const sendMove = vi.fn();
    render(<Deals view={view} sendMove={sendMove} canAct />);
    const form = screen.getByRole("form", { name: "Make an offer" });
    const [giveSet, getSet] = within(form).getAllByRole("group");
    fireEvent.change(within(giveSet!).getByLabelText("Timber"), { target: { value: "9" } });
    fireEvent.change(within(getSet!).getByLabelText("Gold"), { target: { value: "15" } });
    fireEvent.click(within(form).getByRole("button", { name: "Offer" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "offer", to: 1, give: { stores: { timber: 6 } }, get: { gold: 15 }, open: true });
  });
});
