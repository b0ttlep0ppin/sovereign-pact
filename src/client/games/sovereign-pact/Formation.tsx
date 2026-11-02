// The formation (§10.12, DECISIONS 8ag): where your Scions stand when a battle opens, on the party's grid
// as the battle screen draws it, Front nearest the foe on the left. Pick one of yours, then a cell; one
// of yours already there trades places. A Scion with no post stands in their Job's column.
import { deploy, type SovMove, type SovView } from "@vibepulse/shared/games/sovereign-pact";
import { useState } from "react";
import { HERALDRY_COLORS } from "./Emblem";
import ScionSprite, { lookOf } from "./ScionSprite";

type Person = SovView["people"][number];

const COLS = ["Front", "Middle", "Back"];
const ROWS = 8;

export default function Formation({ view, people, sendMove, canAct, title = "Formation" }: { view: SovView; people: Person[]; sendMove: (m: SovMove) => void; canAct: boolean; title?: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  const cells = deploy(people);
  const at = (col: number, row: number) => people.find((_, i) => cells[i]![0] === col && cells[i]![1] === row);
  const mine = (p: Person) => p.host === view.me;
  const chosen = people.find((p) => p.id === picked);
  const place = (col: number, row: number) => {
    if (!chosen) return;
    sendMove({ type: "post", person: chosen.id, col, row });
    setPicked(null);
  };
  return (
    <section className="sp-panel sp-formation" aria-label={title}>
      <h2>{title}</h2>
      <p className="sp-event__status">
        Where your Scions stand when a battle opens. The foe is to the left: the Front takes most blows, the Back the fewest.
        {canAct ? " Pick one of yours, then a cell." : ""}
      </p>
      <div className="sp-formation__grid" role="grid" aria-label="The party's grid">
        {COLS.map((c) => (
          <span key={c} className="sp-formation__col" role="columnheader">
            {c}
          </span>
        ))}
        {Array.from({ length: ROWS }, (_, row) =>
          COLS.map((c, col) => {
            const p = at(col, row);
            const own = !!p && mine(p);
            const colors = p ? view.houses[p.house]?.colors : undefined;
            const label = p ? `${p.name}, ${c}, row ${row + 1}` : `${c}, row ${row + 1}`;
            return (
              <button
                key={`${col}:${row}`}
                type="button"
                role="gridcell"
                className={`sp-formation__cell${p ? " is-taken" : ""}${own ? " is-mine" : ""}${p && p.id === picked ? " is-picked" : ""}`}
                style={p ? { borderColor: HERALDRY_COLORS.get(colors?.[0] ?? "") } : undefined}
                aria-label={label}
                aria-pressed={p ? p.id === picked : undefined}
                disabled={!canAct || (!own && !chosen) || (!!p && !own && !!chosen)}
                onClick={() => (own && (!chosen || chosen.id === p.id) ? setPicked(picked === p.id ? null : p.id) : place(col, row))}
              >
                {p ? (
                  <>
                    <ScionSprite look={lookOf(p, colors, view.items)} anim="idle" frame={0} size={44} />
                    <small>{p.name.split(" ")[0]}</small>
                  </>
                ) : null}
              </button>
            );
          }),
        )}
      </div>
      {canAct && chosen ? (
        <div className="sp-actions">
          <span>{chosen.name}: choose a cell.</span>
          {chosen.post ? (
            <button type="button" className="sp-button sp-button--quiet" onClick={() => (sendMove({ type: "post", person: chosen.id, col: null, row: null }), setPicked(null))}>
              Stand by their Job
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
