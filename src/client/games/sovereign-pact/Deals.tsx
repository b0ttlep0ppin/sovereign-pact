// Deals between Houses (SPEC §8.9): instant trades of Gold, materials and stashed items, never
// promises. The offers on the table that the viewer may see, with Accept, Decline or Withdraw, and a
// form to put one of its own: to whom, what it gives, what it asks, and whether the deal is public.
import { Content, itemName, MATERIALS, type SovMove, type SovView } from "@vibepulse/shared/games/sovereign-pact";
import { useState } from "react";
import Amount from "./Amount";

type Props = { view: SovView; sendMove: (m: SovMove) => void; canAct: boolean };
type Side = SovView["deals"][number]["give"];

const KEYS = [...MATERIALS, ...Content.RARE_MATERIALS.map((m) => m.id)];
const word = (k: string) => Content.RARE_MATERIALS.find((m) => m.id === k)?.name ?? k[0]!.toUpperCase() + k.slice(1);

/** A side of a deal in words. */
export function sideText(view: SovView, side: Side): string {
  const parts = [
    ...(side.gold ? [`${side.gold} Gold`] : []),
    ...Object.entries(side.stores ?? {})
      .filter(([, n]) => (n ?? 0) > 0)
      .map(([k, n]) => `${n} ${word(k)}`),
    ...(side.items ?? []).map((id) => {
      const item = view.items.find((i) => i.id === id);
      return item ? itemName(item) : "an item";
    }),
    ...(side.wards ?? []).map((id) => `${view.people.find((p) => p.id === id)?.name ?? "a Scion"} as a Ward`),
  ];
  return parts.join(", ") || "nothing";
}

type Draft = { gold: number; stores: Record<string, number>; items: number[]; wards: number[] };
const blank = (): Draft => ({ gold: 0, stores: {}, items: [], wards: [] });

const clean = (side: Draft): Side => {
  const stores = Object.fromEntries(Object.entries(side.stores).filter(([, n]) => n > 0));
  return {
    ...(side.gold > 0 ? { gold: side.gold } : {}),
    ...(Object.keys(stores).length ? { stores } : {}),
    ...(side.items.length ? { items: side.items } : {}),
    ...(side.wards.length ? { wards: side.wards } : {}),
  };
};
const toggle = (list: number[], id: number, on: boolean) => (on ? [...list, id] : list.filter((x) => x !== id));

export default function Deals({ view, sendMove, canAct }: Props) {
  const me = view.me;
  const mine = view.mine;
  const others = view.houses.filter((h) => h.index !== me);
  const [to, setTo] = useState(others[0]?.index ?? -1);
  const [give, setGive] = useState(blank);
  const [get, setGet] = useState(blank);
  const [open, setOpen] = useState(true);
  if (me === null || !mine || !others.length) return null;
  const name = (h: number) => `House ${view.houses[h]?.name}`;
  const worn = new Set(view.people.flatMap((p) => Object.values(p.gear ?? {})));
  const stash = view.items.filter((i) => i.house === me && !worn.has(i.id));
  const held = KEYS.filter((k) => (mine.stores[k] ?? 0) > 0);
  const scions = (h: number) => view.people.filter((p) => p.host === h && p.status === "scion");
  const ready = canAct && to >= 0 && (Object.keys(clean(give)).length > 0 || Object.keys(clean(get)).length > 0);
  return (
    <section className="sp-panel sp-deals" aria-label="Deals">
      <h2>Deals</h2>
      {view.deals.length ? (
        <ul className="sp-lots">
          {view.deals.map((d) => (
            <li key={d.id}>
              <span>
                <strong>{d.from === me ? "You offer" : `${name(d.from)} offers`}</strong> {sideText(view, d.give)} <strong>for</strong> {sideText(view, d.get)}
                {d.to === me ? "" : d.from === me ? ` to ${name(d.to)}` : ` to ${name(d.to)}`}
              </span>
              <small>{d.open ? "public" : "private"}</small>
              <span className="sp-bid">
                {d.to === me ? (
                  <>
                    <button type="button" className="sp-button" onClick={() => sendMove({ type: "accept", deal: d.id })}>
                      Accept
                    </button>
                    <button type="button" className="sp-button sp-button--quiet" onClick={() => sendMove({ type: "decline", deal: d.id })}>
                      Decline
                    </button>
                  </>
                ) : d.from === me ? (
                  <button type="button" className="sp-button sp-button--quiet" onClick={() => sendMove({ type: "decline", deal: d.id })}>
                    Withdraw
                  </button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="sp-event__status">No offers on the table.</p>
      )}
      {canAct ? (
        <form
          className="sp-offer"
          aria-label="Make an offer"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ready) return;
            sendMove({ type: "offer", to, give: clean(give), get: clean(get), open });
            setGive(blank());
            setGet(blank());
          }}
        >
          <h3>Make an offer</h3>
          <label>
            To{" "}
            <select
              value={to}
              onChange={(e) => {
                setTo(Number(e.target.value));
                setGet({ ...get, wards: [] });
              }}
            >
              {others.map((h) => (
                <option key={h.index} value={h.index}>
                  House {h.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>You give</legend>
            <span className="sp-amount-row">
              <span>Gold</span> <Amount label="Gold" max={mine.gold} step={5} value={give.gold} onChange={(n) => setGive({ ...give, gold: n })} />
            </span>
            {held.map((k) => (
              <span key={k} className="sp-amount-row">
                <span>{word(k)}</span> <Amount label={word(k)} max={mine.stores[k] ?? 0} value={give.stores[k] ?? 0} onChange={(n) => setGive({ ...give, stores: { ...give.stores, [k]: n } })} />
              </span>
            ))}
            {stash.map((i) => (
              <label key={i.id}>
                <input type="checkbox" checked={give.items.includes(i.id)} onChange={(e) => setGive({ ...give, items: toggle(give.items, i.id, e.target.checked) })} /> {itemName(i)}
              </label>
            ))}
            {scions(me).map((p) => (
              <label key={p.id} title="As a Ward: they live and fight for the other House (§6.9)">
                <input type="checkbox" checked={give.wards.includes(p.id)} onChange={(e) => setGive({ ...give, wards: toggle(give.wards, p.id, e.target.checked) })} /> {p.name} as a Ward
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>You ask</legend>
            <span className="sp-amount-row">
              <span>Gold</span> <Amount label="Gold" step={5} value={get.gold} onChange={(n) => setGet({ ...get, gold: n })} />
            </span>
            {KEYS.map((k) => (
              <span key={k} className="sp-amount-row">
                <span>{word(k)}</span> <Amount label={word(k)} value={get.stores[k] ?? 0} onChange={(n) => setGet({ ...get, stores: { ...get.stores, [k]: n } })} />
              </span>
            ))}
            {scions(to).map((p) => (
              <label key={p.id} title="As a Ward: they would live and fight for you (§6.9)">
                <input type="checkbox" checked={get.wards.includes(p.id)} onChange={(e) => setGet({ ...get, wards: toggle(get.wards, p.id, e.target.checked) })} /> {p.name} as a Ward
              </label>
            ))}
          </fieldset>
          <label>
            <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} /> Public (logged for all, counts for Renown)
          </label>
          <button type="submit" className="sp-button" disabled={!ready}>
            Offer
          </button>
        </form>
      ) : null}
    </section>
  );
}
