// The account of what was just decided (Josh 2026-11-03: "when decisions are resolved be it expeditions or
// events or anything else, there is another modal or prompt where people can see what the effects are...
// Maybe even an house sigil flare"): every Omen, Crisis, Council vote, Year order and offering resolved since
// this seat last looked, each under the sigil of the House that chose it. Expeditions keep their own cards.
import { Content, type SovView } from "@vibepulse/shared/games/sovereign-pact";
import { useState } from "react";
import { Emblem } from "./Emblem";

type Omen = SovView["omens"][number];

const SEEN_KEY = "sovereign-pact:resolved";
const keyOf = (o: Omen) => `${o.year}:${o.id}:${o.house ?? ""}:${o.by ?? ""}:${o.label}:${o.text.length}:${o.lines.length}`;

/** What an account is about: the event or Crisis, the Council's motion, the building's order, the altar. */
export function toldTitle(id: string): string {
  if (id === "council:levy") return "The Commons Council: the levy";
  if (id.startsWith("council:")) return `The Commons Council: the ${Content.PROJECT_BY_ID.get(id.slice(8))?.name ?? id.slice(8)}`;
  if (id.startsWith("order:")) return `Year order: the ${Content.BUILDING_BY_ID.get(id.slice(6))?.name ?? id.slice(6)}`;
  if (id.startsWith("altar:")) return "The Altar of Offerings";
  return Content.TOWN_EVENT_BY_ID.get(id)?.title ?? id;
}

const readSeen = (): string[] => {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(SEEN_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
};

/** The accounts this seat has not yet read, and how to put them away. */
export function useResolved(view: SovView) {
  const [seen, setSeen] = useState<string[]>(readSeen);
  const fresh = (view.omens ?? []).filter((o) => o.year >= view.year - 1 && !seen.includes(keyOf(o)));
  const close = () => {
    // Only the last two Years' keys are kept: older accounts are never shown again.
    const keep = [...seen, ...fresh.map(keyOf)].filter((k) => Number(k.split(":")[0]) >= view.year - 1);
    setSeen(keep);
    try {
      globalThis.localStorage?.setItem(SEEN_KEY, JSON.stringify(keep));
    } catch {
      // Storage blocked: put away for this visit.
    }
  };
  return { fresh, open: fresh.length > 0, close };
}

export default function Resolved({ view, fresh, onClose }: { view: SovView; fresh: Omen[]; onClose: () => void }) {
  return (
    <div className="sp-told sp-resolved" role="dialog" aria-modal="true" aria-label="What was decided">
      <div className="sp-told__card">
        <p className="sp-told__where">What was decided</p>
        {fresh.map((o, i) => {
          const who = o.by ?? o.house;
          const h = who !== null && who !== undefined ? view.houses[who] : undefined;
          return (
            <section key={i} className={`sp-told__part${o.house !== undefined ? " is-private" : ""}`} aria-label={toldTitle(o.id)}>
              <header className="sp-resolved__head">
                {h ? (
                  <span className="sp-sigil-flare" aria-label={`House ${h.name}`}>
                    <Emblem emblem={h.emblem} colors={h.colors} size={34} />
                  </span>
                ) : (
                  <span className="sp-sigil-flare sp-sigil-flare--city" aria-hidden="true">
                    ✦
                  </span>
                )}
                <span>
                  <strong>{toldTitle(o.id)}</strong>
                  {o.label ? (
                    <span className="sp-told__choice">
                      {" "}
                      {o.by !== null && o.house === undefined && view.houses.length > 1 ? `House ${view.houses[o.by]?.name}: ` : ""}
                      {o.label}
                    </span>
                  ) : null}
                </span>
              </header>
              {o.text ? <p className="sp-told__text">{o.text}</p> : null}
              {o.lines.length ? (
                <ul className="sp-told__lines">
                  {o.lines.map((l, j) => (
                    <li key={j} className={l.open ? undefined : "is-private"}>
                      {l.text}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="sp-told__none">Nothing you can see has changed.</p>
              )}
            </section>
          );
        })}
        <div className="sp-told__buttons">
          <button type="button" className="sp-button" onClick={onClose} autoFocus>
            Go on
          </button>
        </div>
      </div>
    </div>
  );
}
