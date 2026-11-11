// Packing the party satchel at the muster (§9.10; Josh 2026-11-11: "when choosing your scions you should be
// able to fill your satchel with items for the expedition"). A House fills its share of the slots, which
// grows with the Scions it fields, from the consumables it holds at home; what goes unused comes home.
import { Content, type SovView } from "@vibepulse/shared/games/sovereign-pact";
import Amount from "./Amount";
import ItemIcon from "./ItemIcon";

export type Pack = Record<string, number>;

/** The consumables a House may pack: everything it holds that works away from town. */
export function packable(view: SovView): [string, number][] {
  return Object.entries(view.mine?.consumables ?? {}).filter(([id, n]) => (n ?? 0) > 0 && Content.CONSUMABLE_BY_ID.get(id)?.use !== "town") as [string, number][];
}

/** What of `pack` fits `room` slots, in the order it was chosen. */
export function fitted(pack: Pack, room: number): Pack {
  const out: Pack = {};
  let left = room;
  for (const [id, n] of Object.entries(pack)) {
    const k = Math.min(n, left);
    if (k > 0) out[id] = k;
    left -= k;
  }
  return out;
}

export default function Satchel({ view, fielded, pack, setPack }: { view: SovView; fielded: number; pack: Pack; setPack: (p: Pack) => void }) {
  const room = view.expedition?.packRoom?.[fielded] ?? 0;
  const items = packable(view);
  const packed = Object.values(fitted(pack, room)).reduce((a, n) => a + n, 0);
  const already = view.expedition?.satchel?.length ?? 0;
  return (
    <section className="sp-satchel-pack" aria-label="Pack the satchel">
      <h3>
        The satchel <small>{fielded ? `${packed} of your ${room} slot${room === 1 ? "" : "s"}` : "choose who goes first"}</small>
      </h3>
      {already ? <p className="sp-event__status">The other Houses have packed {already} already.</p> : null}
      {!items.length ? (
        <p className="sp-event__status">Your House holds nothing to pack. The Quartermaster and the shops sell supplies in town.</p>
      ) : (
        <ul className="sp-satchel-pack__list">
          {items.map(([id, held]) => {
            const def = Content.CONSUMABLE_BY_ID.get(id);
            const mine = pack[id] ?? 0;
            const others = packed - Math.min(mine, packed);
            return (
              <li key={id} title={def?.text}>
                <ItemIcon id={id} size={26} />
                <span className="sp-satchel-pack__what">
                  <strong>{def?.name ?? id}</strong> <small>you hold {held}</small>
                  <span className="sp-ability__text">{def?.text}</span>
                </span>
                <Amount label={`Pack ${def?.name ?? id}`} max={Math.max(0, Math.min(held, room - others))} value={Math.min(mine, Math.max(0, room - others))} onChange={(n) => setPack({ ...pack, [id]: n })} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
