// The command bar (SPEC §15.5): when a battle waits on one of your Scions, what they can do from where
// they stand. A choice aimed at the Scion goes at once; one aimed at someone, or at an area, asks for
// the cell (click it, or move through them with the arrows and press Enter). Moving first keeps the turn.
import { fitsPattern, type Aim, type Cell, type Choice, type ComboView, type Command, type TurnView } from "@vibepulse/shared/games/sovereign-pact";
import { useState } from "react";

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
  const [chain, setChain] = useState<string[] | null>(null);
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
  if (chain && turn.combo)
    return (
      <Combo
        combo={turn.combo}
        name={name}
        chain={chain}
        set={setChain}
        strike={(moves) => {
          const act = (target: Cell): Command => ({ action: { do: "combo", moves, target } });
          if (moves.some((id) => turn.combo!.moves.find((m) => m.id === id)?.strike)) aim({ label: "The combo", cells: turn.combo!.targets, cursor: 0, send: act });
          else send(act(at));
          setChain(null);
        }}
      />
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
        {turn.combo ? (
          <button type="button" className="sp-button" onClick={() => setChain([])}>
            Build a combo <small>{turn.combo.tp} TP</small>
          </button>
        ) : null}
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

/** What each move in the chain costs: its own TP, plus the repeat cost for each earlier use of it. */
export function chainCost(combo: ComboView, chain: readonly string[]): { tp: number; mp: number } {
  let tp = 0;
  let mp = 0;
  chain.forEach((id, i) => {
    const m = combo.moves.find((x) => x.id === id)!;
    tp += m.tp + combo.repeatTp * chain.slice(0, i).filter((x) => x === id).length;
    mp += m.mp;
  });
  return { tp, mp };
}

/** Why `id` cannot go next in the chain, or null. */
export function cannotChain(combo: ComboView, chain: readonly string[], id: string): string | null {
  const m = combo.moves.find((x) => x.id === id)!;
  const last = combo.moves.find((x) => x.id === chain.at(-1));
  if (m.why) return m.why;
  if (last?.finisher) return "the finisher ended the combo";
  const after = chainCost(combo, [...chain, id]);
  if (after.tp > combo.tp) return "not enough TP";
  if (after.mp > combo.mp) return "not enough MP";
  if (m.finisher && !fitsPattern(m.finisher, chain.map((x) => ({ id: x, move: { tag: combo.moves.find((y) => y.id === x)!.tag } })))) return `needs ${m.finisher.replace(/,/g, ", ").replace(/^distinct:(\d+)$/, "$1 different moves")} first`;
  return null;
}

/** A Pugilist's turn as a chain (§12.2): add moves one after another, each paying TP, then strike. */
function Combo({ combo, name, chain, set, strike }: { combo: ComboView; name: string; chain: string[]; set: (c: string[] | null) => void; strike: (moves: string[]) => void }) {
  const spent = chainCost(combo, chain);
  const nameOf = (id: string) => combo.moves.find((m) => m.id === id)?.name ?? id;
  const plain = combo.moves.filter((m) => !m.finisher);
  const finishers = combo.moves.filter((m) => m.finisher);
  const button = (m: ComboView["moves"][number]) => {
    const why = cannotChain(combo, chain, m.id);
    const tp = chainCost(combo, [...chain, m.id]).tp - spent.tp;
    return (
      <li key={m.id}>
        <button type="button" className={`sp-button${m.finisher ? "" : " sp-button--quiet"}`} disabled={!!why} title={why ?? undefined} onClick={() => set([...chain, m.id])}>
          {m.name}
          <small>
            {" "}
            {tp} TP{m.mp ? `, ${m.mp} MP` : ""} · {m.finisher ? m.finisher.replace(/,/g, " ").replace(/^distinct:(\d+)$/, "$1 different") : m.tag}
          </small>
        </button>
      </li>
    );
  };
  return (
    <div className="sp-command sp-combo" role="group" aria-label={`${name}'s combo`}>
      <span>
        <strong>{name}</strong>: chain moves, then strike. TP {combo.tp - spent.tp} of {combo.tp} left.
      </span>
      <ol className="sp-combo__chain" aria-label="The chain">
        {chain.length ? chain.map((id, i) => <li key={i}>{nameOf(id)}</li>) : <li className="is-empty">No moves yet</li>}
      </ol>
      <ul className="sp-command__choices" aria-label="Moves">
        {plain.map(button)}
      </ul>
      {finishers.length ? (
        <ul className="sp-command__choices" aria-label="Finishers">
          {finishers.map(button)}
        </ul>
      ) : null}
      <span className="sp-actions">
        <button type="button" className="sp-button" disabled={!chain.length} onClick={() => strike(chain)}>
          Strike{chain.length ? ` (${chain.length} move${chain.length === 1 ? "" : "s"})` : ""}
        </button>
        <button type="button" className="sp-button sp-button--quiet" disabled={!chain.length} onClick={() => set(chain.slice(0, -1))}>
          Undo
        </button>
        <button type="button" className="sp-button sp-button--quiet" onClick={() => set(null)}>
          Back
        </button>
      </span>
    </div>
  );
}
