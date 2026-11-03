// The camp (Josh's playtest, 2026-11-02): at a Camp node the party sits around a fire and talks. The
// scene's lines come from the rules (banter.ts); they play one at a time, the speaker lit by the fire.
// It opens once for each Camp; the last one closed is remembered in the browser.
import { Content, type SovView } from "@vibepulse/shared/games/sovereign-pact";
import { useState } from "react";
import ScionSprite, { lookOf } from "./ScionSprite";

const SEEN_KEY = "sovereign-pact:camp";
const readSeen = (): string | null => {
  try {
    return globalThis.localStorage?.getItem(SEEN_KEY) ?? null;
  } catch {
    return null;
  }
};

/** Whether this seat should see the camp just made, and how to put it away. */
export function useCamp(view: SovView) {
  const [seen, setSeen] = useState(readSeen);
  const e = view.expedition;
  const key = e?.camp ? `${view.year}:${e.card.pool}:${e.camp.at}:${e.talked?.length ?? 0}` : null;
  const open = !!e?.camp && e.camp.at === e.at && !e.fight && !e.event && !e.result && key !== seen;
  const close = () => {
    if (!key) return;
    setSeen(key);
    try {
      globalThis.localStorage?.setItem(SEEN_KEY, key);
    } catch {
      // Storage blocked: closed for this visit.
    }
  };
  return { open, close };
}

export default function CampScene({ view, onClose }: { view: SovView; onClose: () => void }) {
  const e = view.expedition!;
  const lines = e.camp?.lines ?? [];
  const [shown, setShown] = useState(Math.min(1, lines.length));
  const marching = e.party.flatMap((x) => x ?? []).filter((id) => !e.out.includes(id) && view.people.some((p) => p.id === id && p.status === "scion"));
  const people = marching.flatMap((id) => view.people.filter((p) => p.id === id));
  const speaking = lines[shown - 1]?.who ?? null;
  const done = shown >= lines.length;
  const pool = Content.POOL_BY_ID.get(e.card.pool)?.name ?? e.card.pool;
  const nameOf = (id: number | null) => (id === null ? null : (view.people.find((p) => p.id === id)?.name ?? null));
  const half = Math.ceil(people.length / 2);
  return (
    <div className="sp-camp" role="dialog" aria-modal="true" aria-label="The camp">
      <div className="sp-camp__card">
        <p className="sp-camp__where">A camp in {pool}</p>
        <div className="sp-camp__scene" aria-hidden="true">
          <div className="sp-camp__side">
            {people.slice(0, half).map((p) => (
              <span key={p.id} className={`sp-camp__scion${p.id === speaking ? " is-speaking" : ""}`}>
                <ScionSprite look={lookOf(p, view.houses[p.host]?.colors, view.items)} anim="idle" frame={0} size={96} />
              </span>
            ))}
          </div>
          <div className="sp-camp__fire">
            <span className="sp-camp__flame sp-camp__flame--a" />
            <span className="sp-camp__flame sp-camp__flame--b" />
            <span className="sp-camp__flame sp-camp__flame--c" />
            <span className="sp-camp__logs" />
          </div>
          <div className="sp-camp__side is-facing">
            {people.slice(half).map((p) => (
              <span key={p.id} className={`sp-camp__scion${p.id === speaking ? " is-speaking" : ""}`}>
                <ScionSprite look={lookOf(p, view.houses[p.host]?.colors, view.items)} anim="idle" frame={0} size={96} />
              </span>
            ))}
          </div>
        </div>
        <ol className="sp-camp__talk" aria-live="polite">
          {lines.slice(0, shown).map((l, i) => {
            const who = nameOf(l.who);
            return (
              <li key={i} className={who ? undefined : "is-fire"}>
                {who ? <strong>{who}:</strong> : null} {who ? `“${l.text}”` : <em>{l.text}</em>}
              </li>
            );
          })}
        </ol>
        {done ? <p className="sp-camp__rest">The party rests. Wounds close a little, armor is mended, nerves settle.</p> : null}
        <div className="sp-camp__buttons">
          {done ? (
            <button type="button" className="sp-button" onClick={onClose} autoFocus>
              Break camp
            </button>
          ) : (
            <>
              <button type="button" className="sp-button" onClick={() => setShown(shown + 1)} autoFocus>
                Go on
              </button>
              <button type="button" className="sp-button sp-button--quiet" onClick={() => setShown(lines.length)}>
                Skip the talk
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
