// The command bar (SPEC §15.5): when a battle waits on one of your Scions, what they can do from where
// they stand. A choice aimed at the Scion goes at once; one aimed at someone, or at an area, asks for
// the cell (click it, or move through them with the arrows and press Enter). Moving first keeps the turn.
import type { Aim, Cell, Choice, Command, TurnView } from "@vibepulse/shared/games/sovereign-pact";

/** A choice waiting for its cell: the cells it may go to, the one under the cursor, and what it sends. */
export interface Aiming {
  label: string;
  cells: Cell[];
  cursor: number;
  send: (at: Cell) => Command;
}

const ALL = (side: Cell["side"]): Cell[] => Array.from({ length: 24 }, (_, i) => ({ side, col: i % 3, row: Math.floor(i / 3) }));

/** The cells a choice can be aimed at, or null when it needs none. */
export const cellsOf = (c: Aim): Cell[] | null => (c.aim === "unit" ? c.targets : c.aim === "area" ? ALL(c.side) : null);

const cost = (c: Choice) => [c.mp ? `${c.mp} MP` : "", c.tp ? `${c.tp} TP` : ""].filter(Boolean).join(", ");

interface Props {
  turn: TurnView;
  name: string;
  /** Where the Scion stands, for a choice aimed at themself. */
  at: Cell;
  aiming: Aiming | null;
  aim: (a: Aiming | null) => void;
  send: (c: Command) => void;
}

export default function CommandBar({ turn, name, at, aiming, aim, send }: Props) {
  const pick = (c: Choice & Aim, act: (target: Cell) => Command) => {
    const cells = cellsOf(c);
    if (!cells) send(act(at));
    else aim({ label: c.name, cells, cursor: 0, send: act });
  };
  if (aiming)
    return (
      <div className="sp-command" role="group" aria-label="Choose a target">
        <span>
          <strong>{aiming.label}</strong>: choose {aiming.cells.length === 1 ? "the" : "a"} cell (arrows and Enter, or click).
        </span>
        <button type="button" className="sp-button" onClick={() => send(aiming.send(aiming.cells[aiming.cursor]!))}>
          Confirm
        </button>
        <button type="button" className="sp-button sp-button--quiet" onClick={() => aim(null)}>
          Back
        </button>
      </div>
    );
  return (
    <div className="sp-command" role="group" aria-label={`${name}'s turn`}>
      <span>
        <strong>{name}</strong>: what do they do?
      </span>
      <ul className="sp-command__choices">
        {turn.abilities.map((c) => (
          <li key={c.id}>
            <button type="button" className="sp-button" disabled={!!c.why} title={c.why ?? undefined} onClick={() => pick(c, (target) => ({ action: { do: "ability", ability: c.id, target } }))}>
              {c.name}
              {cost(c) ? <small> {cost(c)}</small> : null}
            </button>
          </li>
        ))}
        {turn.items.map((c) => (
          <li key={`item:${c.id}`}>
            <button type="button" className="sp-button sp-button--quiet" disabled={!!c.why} title={c.why ?? undefined} onClick={() => pick(c, (target) => ({ action: { do: "item", item: c.id, target } }))}>
              {c.name}
              <small> ×{c.left}</small>
            </button>
          </li>
        ))}
      </ul>
      <span className="sp-actions">
        {!turn.moved && turn.moves.length ? (
          <button type="button" className="sp-button sp-button--quiet" onClick={() => aim({ label: "Move", cells: turn.moves.map(([col, row]) => ({ side: "party", col, row })), cursor: 0, send: (c) => ({ move: [c.col, c.row] }) })}>
            Move
          </button>
        ) : null}
        <button type="button" className="sp-button sp-button--quiet" onClick={() => send({ action: { do: "defend" } })}>
          Defend
        </button>
        <button type="button" className="sp-button sp-button--quiet" onClick={() => send({ auto: "turn" })}>
          Gambits: this turn
        </button>
        <button type="button" className="sp-button sp-button--quiet" onClick={() => send({ auto: "battle" })}>
          Gambits: the rest of the battle
        </button>
      </span>
    </div>
  );
}
