// The expedition's chain (SPEC §9.3, §15.2): the places passed shown for what they were, the rest face
// down until reached, the boss waiting at the end. Beside it the party, its Leader, the satchel and
// the haul so far. A 2×4 card shows each party's road.
import { Content, itemName, TUNING, type SovMove, type SovView } from "@vibepulse/shared/games/sovereign-pact";
import ItemIcon from "./ItemIcon";
import { useState } from "react";
import { CARD_TYPES, quarryOf } from "./RiftGate";
import { HERALDRY_COLORS } from "./Emblem";

type Expedition = NonNullable<SovView["expedition"]>;
type Node = Expedition["chain"][number];

export const NODES: Record<Node, { name: string; glyph: string }> = {
  encounter: { name: "Encounter", glyph: "⚔" },
  event: { name: "Event", glyph: "❖" },
  camp: { name: "Camp", glyph: "⛺" },
  cache: { name: "Cache", glyph: "⛁" },
  boss: { name: "Boss", glyph: "☠" },
  gate: { name: "Gate", glyph: "⛓" },
  rally: { name: "Meeting place", glyph: "⚑" },
  raid: { name: "Raid", glyph: "⚔" },
  lair: { name: "Lair", glyph: "➹" },
  arcana: { name: "Arcana", glyph: "✶" },
  idol: { name: "Idol", glyph: "✧" },
  reflection: { name: "Reflection", glyph: "◐" },
};

/** One road: the places passed, where the party stands, and the ones still face down. */
function Road({ passed, length, here, end }: { passed: Node[]; length: number; here: boolean; end: Node }) {
  return (
    <ol className="sp-chain" aria-label={`${passed.length} of ${length} places passed`}>
      {Array.from({ length }, (_, i) => {
        const kind = passed[i];
        const last = i === length - 1;
        const shown = kind ?? (last ? end : undefined);
        const now = here && i === passed.length;
        return (
          <li key={i} className={`sp-node${kind ? " is-passed" : ""}${now ? " is-next" : ""}${shown ? ` sp-node--${shown}` : " is-hidden"}`} title={shown ? NODES[shown].name : "Unknown"}>
            <span aria-hidden="true">{shown ? NODES[shown].glyph : "?"}</span>
            <small>{shown ? NODES[shown].name : "\u00a0"}</small>
          </li>
        );
      })}
    </ol>
  );
}

export default function ChainMap({ view, sendMove }: { view: SovView; sendMove?: (m: SovMove) => void }) {
  const e = view.expedition;
  // Before a Leader is chosen it shows the card and the road still face down, and who has been sent.
  if (!e) return null;
  const person = (id: number) => view.people.find((p) => p.id === id);
  const t = CARD_TYPES[e.card.type];
  const end = quarryOf(e.card);
  const party = e.party.flatMap((p) => p ?? []);
  const satchel = Object.entries((e.satchel ?? []).reduce<Record<string, number>>((n, x) => ((n[x.id] = (n[x.id] ?? 0) + 1), n), {}));
  const haul = e.haul ? e.haul.items.length + Object.values(e.haul.stores).filter((n) => (n ?? 0) > 0).length : 0;
  const split = e.split && !e.split.united ? e.split : null;
  return (
    <section className="sp-panel sp-expedition" aria-label="The expedition">
      <h2>
        {t.name} into {Content.POOL_BY_ID.get(e.card.pool)?.name ?? e.card.pool}, level {e.card.level}
      </h2>
      {end ? <p className="sp-expedition__end">At the end: {end}</p> : null}
      {split ? (
        split.chains.map((chain, i) => (
          <div key={i} className="sp-expedition__road">
            <span>
              {person(split.leaders[i]!)?.name}'s party{split.turn === i ? " (walking)" : ` (${{ walking: "waiting", rallied: "at the meeting place", retreated: "turned back", wiped: "gone" }[split.state[i]!]})`}
            </span>
            {/* The walking party's road is `chain`; the other's is its own, as far as it has walked. */}
            <Road passed={split.turn === i ? e.chain : chain} length={split.turn === i ? e.length : Math.max(chain.length + 1, split.at[i]! + 1)} here={split.turn === i} end="rally" />
          </div>
        ))
      ) : (
        <Road passed={e.chain} length={e.length} here end="boss" />
      )}
      <div className="sp-expedition__columns">
        <section className="sp-expedition__col" aria-label="The party">
          <h3>The party</h3>
          <ul className="sp-expedition__party">
            {party.map((id) => {
              const p = person(id);
              if (!p) return null;
              const color = HERALDRY_COLORS.get(view.houses[p.house]?.colors[0] ?? "");
              const [hp, max] = p.hp ?? [1, 1];
              return (
                <li key={id} style={{ borderColor: color }} className={e.out.includes(id) ? "is-out" : undefined}>
                  <span className="sp-expedition__who">
                    {id === e.leader ? <span title="Leader">♛ </span> : null}
                    {p.name} <small>L{p.level}</small>
                    {p.hp ? <small> · HP {hp}/{max}</small> : null}
                    {e.out.includes(id) ? <small> out of the fight</small> : null}
                  </span>
                  <span className="sp-expedition__hp" title={p.hp ? `HP ${hp} of ${max}` : "Unhurt"}>
                    <span style={{ width: `${Math.round((100 * hp) / Math.max(1, max))}%` }} />
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="sp-expedition__col" aria-label="The satchel">
          <h3>Satchel</h3>
          <SatchelGrid kinds={satchel} />
          {sendMove && view.opens.length ? (
            <div className="sp-actions sp-satchel" aria-label="Open the satchel">
              {view.opens.map((o) => (
                <Open key={o.id} open={o} view={view} sendMove={sendMove} />
              ))}
            </div>
          ) : null}
        </section>
        <section className="sp-expedition__col" aria-label="The haul">
          <h3>Haul</h3>
          {haul ? (
            <ul className="sp-expedition__list">
              {e.haul!.items.map((i) => (
                <li key={i.id}>{itemName(i)}</li>
              ))}
              {Object.entries(e.haul!.stores)
                .filter(([, n]) => (n ?? 0) > 0)
                .map(([k, n]) => (
                  <li key={k}>
                    {k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())} <small>×{n}</small>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="sp-expedition__empty">Nothing yet.</p>
          )}
          <p className="sp-expedition__note">Lost if the party falls.</p>
        </section>
      </div>
    </section>
  );
}

/**
 * The satchel's slots as a grid (Josh 2026-11-11: "a grid that showed items with icons in it"): one item
 * to a slot, alike kept together, the empty slots left showing. Pointing at one names it beneath.
 */
function SatchelGrid({ kinds }: { kinds: [string, number][] }) {
  const slots = kinds.flatMap(([id, n]) => Array.from({ length: n }, () => id));
  const [shown, setShown] = useState<string | undefined>(undefined);
  const id = shown && slots.includes(shown) ? shown : slots[0];
  const def = id ? Content.CONSUMABLE_BY_ID.get(id) : undefined;
  const count = id ? (kinds.find(([k]) => k === id)?.[1] ?? 0) : 0;
  return (
    <>
      <ul className="sp-satchel-grid" aria-label={`${slots.length} of ${TUNING.consumables.satchel} slots filled`}>
        {Array.from({ length: Math.max(TUNING.consumables.satchel, slots.length) }, (_, i) => {
          const at = slots[i];
          const name = at ? (Content.CONSUMABLE_BY_ID.get(at)?.name ?? at) : undefined;
          return (
            <li key={i} className={at ? (at === id ? "is-shown" : "") : "is-empty"}>
              {at ? (
                <button type="button" title={name} aria-label={name} aria-pressed={at === id} onClick={() => setShown(at)} onMouseEnter={() => setShown(at)} onFocus={() => setShown(at)}>
                  <ItemIcon id={at} size={26} />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {def ? (
        <p className="sp-satchel-grid__about">
          <strong>{def.name}</strong>
          {count > 1 ? <small> ×{count}</small> : null} <span>{def.text}</span>
        </p>
      ) : (
        <p className="sp-expedition__empty">Empty.</p>
      )}
    </>
  );
}

/** One kind from the satchel: a button, with a Scion to name when it goes to one. */
function Open({ open, view, sendMove }: { open: SovView["opens"][number]; view: SovView; sendMove: (m: SovMove) => void }) {
  const [who, setWho] = useState(open.people?.[0] ?? -1);
  const def = Content.CONSUMABLE_BY_ID.get(open.id);
  const name = def?.name ?? open.id;
  if (!open.people) {
    return (
      <button type="button" className="sp-button sp-button--quiet" title={def?.text} onClick={() => sendMove({ type: "use_item", id: open.id })}>
        <ItemIcon id={open.id} size={16} /> Use {name}
      </button>
    );
  }
  return (
    <span className="sp-bid" title={def?.text}>
      <select value={who} aria-label={`Who takes ${name}`} onChange={(e) => setWho(Number(e.target.value))}>
        {open.people.map((id) => (
          <option key={id} value={id}>
            {view.people.find((p) => p.id === id)?.name ?? `Scion ${id}`}
          </option>
        ))}
      </select>
      <button type="button" className="sp-button sp-button--quiet" onClick={() => sendMove({ type: "use_item", id: open.id, person: who })}>
        <ItemIcon id={open.id} size={16} /> Use {name}
      </button>
    </span>
  );
}
