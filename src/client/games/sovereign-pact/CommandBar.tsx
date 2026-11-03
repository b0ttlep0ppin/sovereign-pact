// The command bar (SPEC §15.5): when a battle waits on one of your Scions, what they can do from where
// they stand. A choice aimed at the Scion goes at once; one aimed at someone, or at an area, asks for
// the cell (click it, or move through them with the arrows and press Enter). Moving first keeps the turn.
import { areaCells, fitsPattern, type Aim, type Cell, type Choice, type ComboView, type Command, type TurnView } from "@vibepulse/shared/games/sovereign-pact";
import { Content } from "@vibepulse/shared/games/sovereign-pact";
import { useState } from "react";

/** A choice waiting for its cell: the cells it may go to, the one under the cursor, and what it sends. */
export interface Aiming {
  label: string;
  cells: Cell[];
  cursor: number;
  send: (at: Cell) => Command;
  /** For an area choice: the cells it covers when aimed at a cell, lit before it is cast. */
  covers?: (at: Cell) => Cell[];
}

const ALL = (side: Cell["side"]): Cell[] => Array.from({ length: 24 }, (_, i) => ({ side, col: i % 3, row: Math.floor(i / 3) }));

/** The cells a choice can be aimed at, or null when it needs none. */
export const cellsOf = (c: Aim): Cell[] | null => (c.aim === "unit" ? c.targets : c.aim === "area" ? ALL(c.side) : null);

/** What a choice does, in a line, for the panel under the buttons. */
const ABOUT: Record<string, string> = {
  attack: "A blow with the weapon in hand.",
  move: "Step to another cell. They can still act after moving.",
  defend: "Brace until their next turn: blows land softer.",
  combo: "Chain moves into one strike, paying TP for each; a finisher ends it.",
  gambits_turn: "Let their gambits choose this one turn for them.",
  gambits_battle: "Hand the rest of this battle to the gambits: it plays out on its own.",
  finale: "With all three songs playing: end them all at once in a blow of Sagacity to every enemy.",
};
export const aboutOf = (id: string): string => ABOUT[id] ?? Content.ACTIVE_BY_ID.get(id)?.text ?? Content.CONSUMABLE_BY_ID.get(id)?.text ?? "";

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
  // The choice under the pointer or the keyboard, described below the buttons.
  const [about, setAbout] = useState<{ name: string; text: string; why?: string | null; cost?: string } | null>(null);
  // A Job's abilities sit under its command set's name (Josh: "a sub menu for each job's commands"), as do the items.
  const [menu, setMenu] = useState<string | null>(null);
  const setOf = (id: string): string | null => {
    const job = Content.ACTIVE_BY_ID.get(id)?.job;
    return job ? (Content.JOB_BY_ID.get(job)?.set ?? null) : null;
  };
  const plain = turn.abilities.filter((c) => setOf(c.id) === null);
  const sets: [string, typeof turn.abilities][] = [];
  for (const c of turn.abilities) {
    const set = setOf(c.id);
    if (set === null) continue;
    const at = sets.find(([s]) => s === set);
    if (at) at[1].push(c);
    else sets.push([set, [c]]);
  }
  const abilityButton = (c: (typeof turn.abilities)[number]) => (
    <li key={c.id}>
      <button type="button" className="sp-button sp-command__choice" disabled={!!c.why} title={[aboutOf(c.id), c.why ? `Cannot: ${c.why}` : ""].filter(Boolean).join("\n") || undefined} {...tell(c.name, c.id, { why: c.why, cost: cost(c) })} onClick={() => pick(c, (target) => ({ action: { do: "ability", ability: c.id, target } }))}>
        {c.name}
        {cost(c) ? <small> {cost(c)}</small> : null}
      </button>
    </li>
  );
  const tell = (name: string, id: string, extra: { why?: string | null; cost?: string } = {}) => ({
    onMouseEnter: () => setAbout({ name, text: aboutOf(id), ...extra }),
    onFocus: () => setAbout({ name, text: aboutOf(id), ...extra }),
  });
  const pick = (c: Choice & Aim, act: (target: Cell) => Command) => {
    const cells = cellsOf(c);
    if (!cells) send(act(at));
    else aim({ label: c.name, cells, cursor: 0, send: act, ...(c.aim === "area" ? { covers: (at: Cell) => areaCells(c.shape, at) } : {}) });
  };
  if (aiming)
    return (
      <div className="sp-command" role="group" aria-label="Choose a target">
        <span>
          <strong>{aiming.label}</strong>: choose {aiming.cells.length === 1 ? "the" : "a"} target. Click one, or pick with the arrows and press Enter.
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
      <ul className="sp-command__choices" aria-label={menu ?? "Commands"}>
        {menu === null ? (
          <>
            {plain.map(abilityButton)}
            {sets.map(([set, list]) => (
              <li key={set}>
                <button type="button" className="sp-button sp-command__choice is-set" disabled={list.every((c) => !!c.why)} {...tell(set, "", { cost: `${list.length} ${list.length === 1 ? "ability" : "abilities"}` })} onClick={() => setMenu(set)}>
                  {set} ▸
                </button>
              </li>
            ))}
            {turn.items.length ? (
              <li>
                <button type="button" className="sp-button sp-command__choice is-item" {...tell("Items", "", { cost: `${turn.items.length} in the satchel` })} onClick={() => setMenu("Items")}>
                  Items ▸
                </button>
              </li>
            ) : null}
          </>
        ) : (
          <>
            <li>
              <button type="button" className="sp-button sp-command__choice is-plain" onClick={() => setMenu(null)}>
                ◂ Back
              </button>
            </li>
            {menu === "Items"
              ? turn.items.map((c) => (
                  <li key={`item:${c.id}`}>
                    <button type="button" className="sp-button sp-command__choice is-item" disabled={!!c.why} title={[aboutOf(c.id), c.why ? `Cannot: ${c.why}` : ""].filter(Boolean).join("\n") || undefined} {...tell(c.name, c.id, { why: c.why, cost: `${c.left} left` })} onClick={() => pick(c, (target) => ({ action: { do: "item", item: c.id, target } }))}>
                      {c.name}
                      <small> ×{c.left}</small>
                    </button>
                  </li>
                ))
              : (sets.find(([s]) => s === menu)?.[1] ?? []).map(abilityButton)}
          </>
        )}
      </ul>
      <span className="sp-actions">
        {turn.combo ? (
          <button type="button" className="sp-button sp-command__choice" {...tell("Build a combo", "combo", { cost: `${turn.combo.tp} TP` })} onClick={() => setChain([])}>
            Build a combo <small>{turn.combo.tp} TP</small>
          </button>
        ) : null}
        {!turn.moved && turn.moves.length ? (
          <button type="button" className="sp-button sp-command__choice is-plain" {...tell("Move", "move")} onClick={() => aim({ label: "Move", cells: turn.moves.map(([col, row]) => ({ side: "party", col, row })), cursor: 0, send: (c) => ({ move: [c.col, c.row] }) })}>
            Move
          </button>
        ) : null}
        <button type="button" className="sp-button sp-command__choice is-plain" {...tell("Defend", "defend")} onClick={() => send({ action: { do: "defend" } })}>
          Defend
        </button>
        <button type="button" className="sp-button sp-command__choice is-plain" {...tell("Gambits: this turn", "gambits_turn")} onClick={() => send({ auto: "turn" })}>
          Gambits: this turn
        </button>
        <button type="button" className="sp-button sp-command__choice is-plain" {...tell("Gambits: the rest of the battle", "gambits_battle")} onClick={() => send({ auto: "battle" })}>
          Gambits: the rest of the battle
        </button>
      </span>
      <p className="sp-command__about" aria-live="polite">
        {about ? (
          <>
            <strong>{about.name}</strong>
            {about.cost ? <small> {about.cost}</small> : null}
            {about.text ? <> · {about.text}</> : null}
            {about.why ? <em> Cannot now: {about.why}.</em> : null}
          </>
        ) : (
          "Point at an action to see what it does."
        )}
      </p>
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
