// The homecoming (Josh's playtest, 2026-11-02): when the party is home, a card tells what the
// expedition did to each Scion who went and what each House took from the haul. It opens once for each
// expedition; the last one seen is remembered in the browser.
import { Content, type SovView } from "@vibepulse/shared/games/sovereign-pact";
import { useState } from "react";
import { Emblem } from "./Emblem";
import { CARD_TYPES, quarryOf } from "./RiftGate";
import ScionSprite, { lookOf } from "./ScionSprite";

type Account = NonNullable<SovView["homecoming"]>;

const SEEN_KEY = "sovereign-pact:homecoming";
const keyOf = (h: Account) => `${h.year}:${h.card.pool}:${h.card.level}`;
function readSeen(): string | null {
  try {
    return globalThis.localStorage?.getItem(SEEN_KEY) ?? null;
  } catch {
    return null;
  }
}

const HEADLINE: Record<Account["result"], string> = {
  won: "Home in triumph",
  retreated: "Home, turned back",
  wiped: "The party is overrun",
  unanswered: "No one went",
  stayed: "The Gate stayed shut",
};

/** The card for the last expedition, if this seat has not dismissed it yet. */
export function useHomecoming(view: SovView) {
  const [seen, setSeen] = useState(readSeen);
  const h = view.homecoming;
  const open = !!h && view.phase !== "expedition" && keyOf(h) !== seen;
  const close = () => {
    if (!h) return;
    setSeen(keyOf(h));
    try {
      globalThis.localStorage?.setItem(SEEN_KEY, keyOf(h));
    } catch {
      // Storage blocked: it stays closed for this visit.
    }
  };
  return { open, close };
}

export default function Homecoming({ view, onClose }: { view: SovView; onClose: () => void }) {
  const h = view.homecoming;
  if (!h) return null;
  const pool = Content.POOL_BY_ID.get(h.card.pool)?.name ?? h.card.pool;
  const boss = quarryOf(h.card) ?? (h.card.boss ? Content.BOSS_BY_ID.get(h.card.boss)?.name : undefined);
  const byHouse = view.houses.map((house) => ({ house, took: h.claims.filter((c) => c.house === house.index).map((c) => c.text) })).filter((x) => x.took.length);
  const person = (id: number) => view.people.find((p) => p.id === id);
  return (
    <div className={`sp-homecoming is-${h.result}`} role="dialog" aria-modal="true" aria-label="The homecoming">
      <div className="sp-homecoming__card">
        <p className="sp-homecoming__where">
          Year {h.year} · {CARD_TYPES[h.card.type].name} · {pool} · level {h.card.level}
        </p>
        <h2>{HEADLINE[h.result]}</h2>
        {h.result === "won" && boss ? <p className="sp-homecoming__boss">{boss} is slain.</p> : null}
        <ul className="sp-homecoming__party" aria-label="The party">
          {h.people.map((p) => {
            const now = person(p.id);
            const colors = view.houses[p.house]?.colors;
            return (
              <li key={p.id} className={p.fate ? `is-${p.fate}` : undefined}>
                <span className="sp-homecoming__face">{now && !p.fate ? <ScionSprite look={lookOf(now, colors, view.items)} size={40} /> : <span aria-hidden="true">{p.fate === "fell" ? "✝" : "?"}</span>}</span>
                <span className="sp-homecoming__who">
                  <strong>{p.name}</strong>
                  <small>House {view.houses[p.house]?.name}</small>
                </span>
                {p.fate ? (
                  <span className="sp-homecoming__fate">{p.fate === "fell" ? "Fell in the otherworld" : "Lost in the otherworld; a Rescue may yet find them"}</span>
                ) : (
                  <span className="sp-homecoming__gain">
                    {/* §9.9: a wiped party's Scions not left behind crawl home (Josh 2026-11-11: "None came home" read as all lost). */}
                    {h.result === "wiped" ? <b className="sp-homecoming__crawled">Crawled home</b> : null}
                    {p.levelTo > p.levelFrom ? (
                      <b className="sp-homecoming__level">
                        Level {p.levelFrom} → {p.levelTo}
                      </b>
                    ) : (
                      <span>Level {p.levelTo}</span>
                    )}
                    <span>+{p.xp} XP</span>
                    <span>+{p.jp} JP</span>
                    {p.injuries.map((id, i) => (
                      <em key={i}>{Content.INJURY_BY_ID.get(id)?.name ?? id.replace(/_/g, " ")}</em>
                    ))}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        {byHouse.length ? (
          <section className="sp-homecoming__haul" aria-label="The haul">
            <h3>The haul</h3>
            {byHouse.map(({ house, took }) => (
              <p key={house.index}>
                <Emblem emblem={house.emblem} colors={house.colors} size={22} /> <strong>House {house.name}</strong> took {took.join(", ")}.
              </p>
            ))}
          </section>
        ) : h.result === "wiped" ? (
          <p className="sp-homecoming__sub">Everything the party carried is lost with it.</p>
        ) : h.result === "won" || h.result === "retreated" ? (
          <p className="sp-homecoming__sub">The party carried nothing home.</p>
        ) : null}
        <button type="button" className="sp-button" onClick={onClose} autoFocus>
          Back to the town
        </button>
      </div>
    </div>
  );
}
