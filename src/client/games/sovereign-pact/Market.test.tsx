import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Content, sovereignPact as g, itemName } from "@vibepulse/shared/games/sovereign-pact";
import { found, campaign } from "../../../shared/games/sovereign-pact/testing.ts";
import Market from "./Market";

function town() {
  const s = found(campaign(2, 4));
  s.houses[0]!.gold = 500;
  const base = Content.ITEM_BASES.find((b) => b.slot === "main")!.id;
  const shop = { item: { id: 9900, base, tier: 3 as const, ilvl: 1, house: -1 }, shop: "weaponsmith", price: 40, auction: false, bids: [null, null] };
  const sealed = { item: { id: 9901, base, tier: 4 as const, ilvl: 2, house: -1 }, shop: null, seller: 1, price: 30, auction: true, bids: [null, null] };
  s.market = [shop, sealed];
  // The first consumable sold where this House can buy it.
  const where = Content.CONSUMABLES.find((c) => c.sold.length)!.sold[0]!;
  s.houses[0]!.buildings[where.at] = Math.max(s.houses[0]!.buildings[where.at] ?? 0, where.level);
  return { s, shop, sealed, view: g.view(s, s.players[0]!) };
}

describe("the market (§8.6, §13.4a)", () => {
  it("sells a shop's goods at the House's price", () => {
    const { view, shop } = town();
    const sendMove = vi.fn();
    render(<Market view={view} sendMove={sendMove} canAct />);
    const lot = view.market.find((l) => l.item.id === shop.item.id)!;
    expect(lot.cost).toBeDefined();
    const row = screen.getAllByText(itemName(shop.item))[0]!.closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: `Buy, ${lot.cost} Gold` }));
    expect(sendMove).toHaveBeenCalledWith({ type: "buy", item: shop.item.id });
  });

  it("takes a sealed bid at or above the reserve", () => {
    const { view, sealed } = town();
    const sendMove = vi.fn();
    render(<Market view={view} sendMove={sendMove} canAct />);
    fireEvent.change(screen.getByLabelText(`Bid on ${itemName(sealed.item)}`), { target: { value: "45" } });
    fireEvent.click(screen.getByRole("button", { name: "Bid" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "bid", item: 9901, gold: 45 });
  });

  it("sells consumables the House can buy, at its price", () => {
    const { view } = town();
    const sendMove = vi.fn();
    render(<Market view={view} sendMove={sendMove} canAct />);
    const first = view.mine!.shop[0]!;
    const name = Content.CONSUMABLE_BY_ID.get(first.id)!.name;
    const row = screen.getByText(name).closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: `Buy, ${first.price} Gold` }));
    expect(sendMove).toHaveBeenCalledWith({ type: "buy_consumable", id: first.id });
  });
});
