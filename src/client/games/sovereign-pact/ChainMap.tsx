// The expedition's chain (SPEC §9.3, §15.2): the places passed shown for what they were, the rest face
// down until reached, the boss waiting at the end. Beside it the party, its Leader, the satchel and
// the haul so far. A 2×4 card shows each party's road.
import { Content, type SovMove, type SovView } from "@vibepulse/shared/games/sovereign-pact";
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
  if (!e || e.leader === undefined) return null;
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
      <div className="sp-expedition__party">
        <ul aria-label="The party">
          {party.map((id) => {
            const p = person(id);
            if (!p) return null;
            const color = HERALDRY_COLORS.get(view.houses[p.house]?.colors[0] ?? "");
            return (
              <li key={id} style={{ borderColor: color }} className={e.out.includes(id) ? "is-out" : undefined}>
                {id === e.leader ? <span title="Leader">♛ </span> : null}
                {p.name} <small>L{p.level}</small>
                {e.out.includes(id) ? <small> out of the fight</small> : null}
              </li>
            );
          })}
        </ul>
        <p>
          <strong>Satchel:</strong> {satchel.length ? satchel.map(([id, n]) => `${n > 1 ? `${n} ` : ""}${Content.CONSUMABLE_BY_ID.get(id)?.name ?? id}`).join(", ") : "empty"}
        </p>
        {sendMove && view.opens.length ? (
          <div className="sp-actions sp-satchel" aria-label="Open the satchel">
            {view.opens.map((o) => (
              <Open key={o.id} open={o} view={view} sendMove={sendMove} />
            ))}
          </div>
        ) : null}
        <p>
          <strong>Haul:</strong> {haul ? `${e.haul!.items.length} item${e.haul!.items.length === 1 ? "" : "s"}${Object.keys(e.haul!.stores).length ? " and materials" : ""}, lost if the party falls` : "nothing yet"}
        </p>
      </div>
    </section>
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
        Use {name}
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
        Use {name}
      </button>
    </span>
  );
}
