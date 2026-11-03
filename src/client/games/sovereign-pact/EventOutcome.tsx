// The outcome card (Josh's playtest, 2026-11-02: "these events feel like nothing, did he actually become
// younger?"): once an event lands, what was chosen, who it fell on, what happened, and every change it
// made that this House may see. It opens once for each event; the last one closed is remembered.
import { Content, type SovView } from "@vibepulse/shared/games/sovereign-pact";
import { useState } from "react";

const SEEN_KEY = "sovereign-pact:told";
const readSeen = (): string | null => {
  try {
    return globalThis.localStorage?.getItem(SEEN_KEY) ?? null;
  } catch {
    return null;
  }
};

/** Whether this seat should see what the last event did, and how to put it away. */
export function useTold(view: SovView) {
  const [seen, setSeen] = useState(readSeen);
  const e = view.expedition;
  const told = e?.told;
  const key = told ? `${view.year}:${e.card.pool}:${told.n}:${told.parts.length}:${told.parts.reduce((n, p) => n + p.lines.length, 0)}` : null;
  // Also open while the fight it started is on: the card comes first, so the outcome can be read before
  // steel is drawn (Josh 2026-11-03: "it's still not letting me process what happens in events").
  const open = !!told && !e.event && key !== seen;
  const close = () => {
    if (!key) return;
    setSeen(key);
    try {
      globalThis.localStorage?.setItem(SEEN_KEY, key);
    } catch {
      // Storage blocked: closed for this visit.
    }
  };
  return { open, close, fight: !!e?.fight };
}

export default function EventOutcome({ view, onClose, toArms = false }: { view: SovView; onClose: () => void; toArms?: boolean }) {
  const told = view.expedition!.told!;
  const def = Content.TRIP_EVENT_BY_ID.get(told.id);
  return (
    <div className="sp-told" role="dialog" aria-modal="true" aria-label="What happened">
      <div className="sp-told__card">
        <p className="sp-told__where">{def?.title ?? "The event"}</p>
        {told.parts.map((p, i) => (
          <section key={i} className="sp-told__part">
            <p className="sp-told__choice">
              {p.label}
              {p.who ? <span className="sp-told__who"> It fell on {p.who}.</span> : null}
            </p>
            <p className="sp-told__text">{p.text}</p>
            {p.lines.length ? (
              <ul className="sp-told__lines">
                {p.lines.map((l, j) => (
                  <li key={j} className={l.open ? undefined : "is-private"}>
                    {l.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sp-told__none">Nothing you can see has changed.</p>
            )}
          </section>
        ))}
        <div className="sp-told__buttons">
          {toArms ? <p className="sp-told__arms">Steel is drawn. The fight is upon you.</p> : null}
          <button type="button" className="sp-button" onClick={onClose} autoFocus>
            {toArms ? "To arms" : "Go on"}
          </button>
        </div>
      </div>
    </div>
  );
}
