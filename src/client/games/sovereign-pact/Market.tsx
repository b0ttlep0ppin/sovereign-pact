// The Commons' market in the Settlement Phase (SPEC §8.6, §13.4a, §13.7): the shops' goods at the
// House's price (first come), the lots that go to sealed bids (the viewer sees only its own bid), the
// consumables the House can buy, and its stash to put up for bids with a reserve.
import { Content, itemName, itemSheet, type SovMove, type SovView } from "@vibepulse/shared/games/sovereign-pact";
import { useState } from "react";
import Amount from "./Amount";

type Props = { view: SovView; sendMove: (m: SovMove) => void; canAct: boolean };
type Item = SovView["items"][number];

const shopName = (id: string | null) => (id ? (Content.PROJECT_BY_ID.get(id)?.name ?? id.replace(/_/g, " ")) : "A House's lot");

/** An item's line: its name, and what its properties do. */
export function ItemLine({ item }: { item: Item }) {
  const props = (item.props ?? []).map(([id]) => Content.PROPERTY_BY_ID.get(id)).filter((p) => !!p);
  return (
    <span className="sp-item" title={[itemSheet(item).stats.map((x) => `${x.label} ${x.value}${x.unit ?? ""}`).join(" · "), ...props.map((p) => `${p.name}: ${p.text}`)].filter(Boolean).join("\n") || undefined}>
      <strong>{itemName(item)}</strong> <small>ilvl {item.ilvl}</small>
      {item.cursed ? <small className="sp-item__curse"> cursed</small> : null}
      {props.length ? <small> · {props.map((p) => p.name).join(", ")}</small> : null}
    </span>
  );
}

export default function Market({ view, sendMove, canAct }: Props) {
  const mine = view.mine;
  const me = view.me;
  const [bids, setBids] = useState<Record<number, number>>({});
  const [reserve, setReserve] = useState<Record<number, number>>({});
  if (me === null || !mine) return null;
  const worn = new Set(view.people.flatMap((p) => Object.values(p.gear ?? {})));
  const stash = view.items.filter((i) => i.house === me && !worn.has(i.id));
  const shops = view.market.filter((l) => !l.auction);
  const sealed = view.market.filter((l) => l.auction);
  return (
    <section className="sp-panel sp-market" aria-label="The market">
      <h2>The market</h2>
      <p className="sp-market__purse">
        Your purse: <strong>{mine.gold} Gold</strong>
      </p>
      {!shops.length && !sealed.length && !mine.shop.length ? <p className="sp-event__status">Nothing is for sale yet: the Commons has built no shops, and no House has put anything up.</p> : null}
      {shops.length ? (
        <>
          <h3>In the shops</h3>
          <ul className="sp-lots">
            {shops.map((l) => (
              <li key={l.item.id}>
                <ItemLine item={l.item} />
                <small>{shopName(l.shop)}</small>
                <button type="button" className="sp-button sp-button--quiet" disabled={!canAct || (l.cost ?? l.price) > mine.gold} onClick={() => sendMove({ type: "buy", item: l.item.id })}>
                  Buy, {l.cost ?? l.price} Gold
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {sealed.length ? (
        <>
          <h3>Sealed bids</h3>
          <p className="sp-event__status">The highest bid wins at the seal; nobody sees another's bid.</p>
          <ul className="sp-lots">
            {sealed.map((l) => {
              const own = l.seller === me;
              const value = bids[l.item.id] ?? l.bids[me] ?? l.price;
              return (
                <li key={l.item.id}>
                  <ItemLine item={l.item} />
                  <small>
                    {l.seller !== undefined ? `House ${view.houses[l.seller]?.name}'s lot` : shopName(l.shop)}, reserve {l.price}
                  </small>
                  {own ? (
                    <small>Your lot</small>
                  ) : canAct ? (
                    <span className="sp-bid">
                      <Amount label={`Bid on ${itemName(l.item)}`} min={l.price} max={Math.max(l.price, mine.gold)} step={5} value={value} onChange={(n) => setBids({ ...bids, [l.item.id]: n })} />
                      <button type="button" className="sp-button sp-button--quiet" disabled={value < l.price || value > mine.gold} onClick={() => sendMove({ type: "bid", item: l.item.id, gold: value })}>
                        {l.bids[me] !== null && l.bids[me] !== undefined ? `Change bid (${l.bids[me]})` : "Bid"}
                      </button>
                    </span>
                  ) : l.bids[me] !== null ? (
                    <small>Your bid: {l.bids[me]}</small>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      {mine.shop.length ? (
        <>
          <h3>Consumables</h3>
          <ul className="sp-lots">
            {mine.shop.map((c) => {
              const def = Content.CONSUMABLE_BY_ID.get(c.id);
              return (
                <li key={c.id}>
                  <span className="sp-item" title={def?.text}>
                    <strong>{def?.name ?? c.id}</strong> {mine.consumables[c.id] ? <small>(you hold {mine.consumables[c.id]})</small> : null}
                  </span>
                  <small>{def?.text}</small>
                  <button type="button" className="sp-button sp-button--quiet" disabled={!canAct || c.price > mine.gold} onClick={() => sendMove({ type: "buy_consumable", id: c.id })}>
                    Buy, {c.price} Gold
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      {stash.length && canAct && (mine.sells || view.houses.length > 1) ? (
        <>
          <h3>Your stash</h3>
          <p className="sp-event__status">Gear nobody wears. The shops buy it for a fraction of its worth{view.houses.length > 1 ? "; another House may pay more at sealed bids" : ""}.</p>
          <ul className="sp-lots">
            {stash.map((i) => (
              <li key={i.id}>
                <ItemLine item={i} />
                {mine.sells?.[i.id] !== undefined ? (
                  <button type="button" className="sp-button sp-button--quiet" onClick={() => sendMove({ type: "sell", item: i.id })}>
                    Sell, {mine.sells[i.id]} Gold
                  </button>
                ) : null}
                {view.houses.length > 1 ? (
                  <span className="sp-bid">
                    <Amount label={`Reserve for ${itemName(i)}`} step={5} value={reserve[i.id] ?? 0} onChange={(n) => setReserve({ ...reserve, [i.id]: n })} />
                    <button type="button" className="sp-button sp-button--quiet" onClick={() => sendMove({ type: "auction", item: i.id, reserve: reserve[i.id] ?? 0 })}>
                      Put up for bids
                    </button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
