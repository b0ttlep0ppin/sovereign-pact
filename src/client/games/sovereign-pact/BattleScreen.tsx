// The battle screen (SPEC §15.5), first pass: plays back a battle the gambits fought. The enemy grid
// (E3 E2 E1) faces the party's (Front, Middle, Back) across the gap; the enemy panel is on the left,
// the party panel on the right, the turn and the log beneath. Damage numbers pop from the struck
// cell, colored by kind; an injury roll gets its own moment. Tokens are drawn in CSS until the sprite
// pipeline exists (HANDOFF §8). Space plays and pauses, the arrows step, Escape closes.
import { Content, FLAG, replayLine, type Cell, type Command, type Replay, type ReplayUnit, type SovView, type TurnView, type Vitals } from "@vibepulse/shared/games/sovereign-pact";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import CommandBar, { type Aiming } from "./CommandBar";
import { HERALDRY_COLORS } from "./Emblem";
import { spriteOf } from "./sprites";
import { playSounds, soundsOf } from "./sfx";
import "./BattleScreen.css";

type Event = Replay["frames"][number]["ev"][number];

const COLS = 3;
const ROWS = 8;
const LOCS = ["Head", "Body", "Arms", "Legs"];
/** Milliseconds a turn is shown at 1×. */
const TURN_MS = 900;
export const SPEEDS = [1, 2, 4] as const;

const words = (id: string) => id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
/** An ability's name: a Job's active or an item by its content name, anything else from its id. */
export const abilityName = (id: string): string => Content.ACTIVE_BY_ID.get(id)?.name ?? Content.CONSUMABLE_BY_ID.get(id)?.name ?? words(id.replace(/^item:/, ""));

/** The vitals of every combatant after each frame; index 0 is the start. */
export function framesOf(r: Replay): Map<number, Vitals>[] {
  const out = [new Map(r.start.map((v) => [v[0], v]))];
  for (const f of r.frames) {
    const next = new Map(out.at(-1)!);
    for (const v of f.vit) next.set(v[0], v);
    out.push(next);
  }
  return out;
}

/** Who takes the frame's turn, if anyone does. */
const actorOf = (ev: Event[]): number | undefined => ev.find((e) => e.t === "turn")?.unit;

/** The headline of a frame: what the actor did. */
function headline(r: Replay, ev: Event[], name: (id: number) => string): string {
  const end = ev.find((e) => e.t === "end");
  if (end?.t === "end") return end.outcome === "victory" ? "Victory" : end.outcome === "defeat" ? "The party falls" : "The party withdraws";
  for (const e of ev) {
    if (e.t === "use") return `${name(e.unit)}: ${abilityName(e.ability)}`;
    if (e.t === "charge") return `${name(e.unit)} begins ${abilityName(e.ability)}${e.telegraph ? "!" : ""}`;
    if (e.t === "defend" || e.t === "wait") return `${name(e.unit)} ${e.t === "defend" ? "defends" : "waits"}`;
  }
  if (ev.some((e) => e.t === "move")) return `${name(actorOf(ev) ?? -1)} moves`;
  const first = ev.find((e) => e.t !== "turn");
  return first ? replayLine(r, first) : "";
}

interface Pop {
  key: string;
  target: number;
  text: string;
  kind: "hit" | "crit" | "heal" | "sanity" | "miss";
  tag?: string;
}

/** The numbers a frame pops over its targets. */
function popsOf(ev: Event[], frame: number, units: Map<number, ReplayUnit>): Pop[] {
  const out: Pop[] = [];
  ev.forEach((e, i) => {
    const key = `${frame}:${i}`;
    if (e.t === "hit") {
      const scion = units.get(e.target)?.person !== undefined;
      const tag = e.weak ? "Weak!" : scion && e.loc ? `${words(e.loc)}!` : undefined;
      out.push({ key, target: e.target, text: String(e.damage), kind: e.crit ? "crit" : "hit", ...(tag ? { tag } : {}) });
    } else if (e.t === "heal") out.push({ key, target: e.target, text: `+${e.amount}`, kind: "heal" });
    else if (e.t === "sanity") out.push({ key, target: e.target, text: `-${e.amount}`, kind: "sanity" });
    else if (e.t === "miss") out.push({ key, target: e.target, text: "Miss", kind: "miss" });
  });
  return out;
}

interface Props {
  replay: Replay;
  view: SovView;
  onClose: () => void;
  /** Battles waiting after this one. */
  waiting?: number;
  /** Show every turn's lines so far, to read instead of watch (§15.8). */
  fullLog?: boolean;
  /** The battle's sound effects (§16.1): off, or their volume. */
  sound?: number;
  /** A battle being fought now (§10.4): its turn's choices for this seat, or whom it waits on. */
  live?: Live;
}

export interface Live {
  turn: TurnView | null;
  /** Whom the battle waits on, when not on this seat. */
  waiting: string | null;
  send: (c: Command) => void;
}

const same = (a: Cell, b: Cell) => a.side === b.side && a.col === b.col && a.row === b.row;

export default function BattleScreen({ replay, view, onClose, waiting = 0, fullLog = false, sound = 0, live }: Props) {
  const states = useMemo(() => framesOf(replay), [replay]);
  const units = useMemo(() => new Map(replay.units.map((u) => [u.id, u])), [replay]);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const last = replay.frames.length;
  const vit = states[at]!;
  const ev = at > 0 ? replay.frames[at - 1]!.ev : [];
  // A turn waiting on this seat's command is the one on screen.
  const commanding = live?.turn && at >= last ? live.turn : null;
  const actor = commanding?.unit ?? actorOf(ev);
  const name = (id: number) => units.get(id)?.name ?? "someone";
  const pops = popsOf(ev, at, units);
  const injury = ev.find((e) => e.t === "injury");
  const charges = ev.filter((e) => e.t === "charge" && e.telegraph);
  const root = useRef<HTMLDivElement>(null);
  const log = useRef<HTMLOListElement>(null);
  // The full log (§15.8): every turn so far, to read instead of watch; else this turn's lines.
  const lines = (fullLog ? replay.frames.slice(0, at).flatMap((f, i) => f.ev.map((e) => [i + 1, e] as const)) : ev.map((e) => [at, e] as const)).filter(([, e]) => e.t !== "turn");

  useEffect(() => {
    if (!playing || at >= last) return;
    const t = setTimeout(() => setAt((i) => Math.min(last, i + 1)), (TURN_MS * (injury ? 2 : 1)) / speed);
    return () => clearTimeout(t);
  }, [playing, at, last, speed, injury]);
  // A command aimed at a cell; it is dropped once the battle moves on.
  const [aiming, setAiming] = useState<Aiming | null>(null);
  const [aimedAt, setAimedAt] = useState(last);
  if (aimedAt !== last) {
    setAimedAt(last);
    setAiming(null);
  }
  const aimable = (c: Cell) => (aiming ? aiming.cells.findIndex((x) => same(x, c)) : -1);
  /** The cell a click on `u` aims at: the first of theirs the choice can go to. */
  const aimOn = (u: ReplayUnit): Cell | undefined => {
    const [, , , , , col, row] = vit.get(u.id)!;
    return aiming?.cells.find((c) => c.side === u.side && c.col >= col && c.col < col + u.size[0] && c.row >= row && c.row < row + u.size[1]);
  };
  const fire = (c: Cell) => {
    if (!aiming || !live) return;
    live.send(aiming.send(c));
    setAiming(null);
  };
  // Each turn sounds as it comes on screen, stepping forward; stepping back is silent.
  const heard = useRef(0);
  useEffect(() => {
    const forward = at === heard.current + 1;
    heard.current = at;
    if (!forward || !sound) return;
    return playSounds(soundsOf(replay.frames[at - 1]!.ev, units), sound, speed);
  }, [at, replay, units, sound, speed]);
  // The keys go to the screen: on opening, and when a choice asks for its cell (its button is gone).
  const aimingNow = aiming !== null;
  useEffect(() => root.current?.focus(), [aimingNow]);
  useEffect(() => {
    if (fullLog && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [fullLog, at]);

  const color = (u: ReplayUnit) => (u.house !== undefined ? HERALDRY_COLORS.get(view.houses[u.house]?.colors[0] ?? "") : undefined);
  const shown = (u: ReplayUnit) => {
    const v = vit.get(u.id);
    if (!v) return false;
    // The dead and the fled leave the field a turn after they fall; a dead Scion stays, faded.
    const before = states[Math.max(0, at - 1)]!.get(u.id);
    const gone = (x?: Vitals) => !!x && (x[7] & (FLAG.dead | FLAG.fled)) !== 0;
    return u.side === "party" && u.person !== undefined ? true : !(gone(v) && gone(before) && at > 0);
  };
  const side = (s: "enemy" | "party") => replay.units.filter((u) => u.side === s && u.partOf === undefined && shown(u));

  const token = (u: ReplayUnit) => {
    const v = vit.get(u.id)!;
    const [, hp, , , , col, row, flags] = v;
    const x = u.side === "enemy" ? COLS - col - u.size[0] : col;
    const style: CSSProperties = {
      left: `${(x / COLS) * 100}%`,
      top: `${(row / ROWS) * 100}%`,
      width: `${(u.size[0] / COLS) * 100}%`,
      height: `${(u.size[1] / ROWS) * 100}%`,
      ...(color(u) ? { ["--ring" as string]: color(u) } : {}),
    };
    const state = flags & FLAG.dead ? " is-dead" : flags & FLAG.down ? " is-down" : flags & FLAG.lastStand ? " is-last-stand" : "";
    const mine = pops.filter((p) => p.target === u.id);
    const sprite = spriteOf(u);
    const aimed = aimOn(u);
    return (
      <div
        key={u.id}
        onClick={aimed ? () => fire(aimed) : undefined}
        className={`sp-unit sp-unit--${u.side}${aimed ? " is-targetable" : ""}${aimed && aiming && same(aimed, aiming.cells[aiming.cursor]!) ? " is-cursor" : ""}${u.boss ? " is-boss" : ""}${u.hazard ? " is-hazard" : ""}${actor === u.id ? " is-acting" : ""}${flags & FLAG.charging ? " is-charging" : ""}${state}`}
        style={style}
        title={`${u.name}: ${hp}/${u.maxHp} HP`}
      >
        {sprite ? (
          <img className={`sp-unit__sprite${sprite.flip ? " is-flipped" : ""}`} src={sprite.url} alt="" draggable={false} />
        ) : (
          <span className="sp-unit__body">{u.hazard ? "⚠" : initials(u.name)}</span>
        )}
        <span className="sp-unit__hp" aria-hidden="true">
          <span style={{ width: `${pct(hp, u.maxHp)}%` }} />
        </span>
        {mine.map((p, i) => (
          <span key={p.key} className={`sp-pop sp-pop--${p.kind}`} style={{ ["--i" as string]: i }}>
            {p.text}
            {p.tag ? <small>{p.tag}</small> : null}
          </span>
        ))}
      </div>
    );
  };

  const grid = (s: "enemy" | "party") => (
    <div className={`sp-grid sp-grid--${s}`} aria-label={s === "enemy" ? "The enemy" : "The party"}>
      {Array.from({ length: COLS * ROWS }, (_, i) => {
        const x = i % COLS;
        const row = Math.floor(i / COLS);
        const col = s === "enemy" ? COLS - 1 - x : x;
        const marked = charges.some((c) => c.t === "charge" && c.target.side === s && c.target.col === col && c.target.row === row);
        const k = aimable({ side: s, col, row });
        const cls = `sp-cell${marked ? " is-telegraphed" : ""}${k >= 0 ? " is-target" : ""}${k >= 0 && k === aiming?.cursor ? " is-cursor" : ""}`;
        return <span key={i} className={cls} style={{ gridColumn: x + 1, gridRow: row + 1 }} onClick={k >= 0 ? () => fire({ side: s, col, row }) : undefined} />;
      })}
      {side(s).map(token)}
    </div>
  );

  const step = (by: number) => {
    setPlaying(false);
    setAt((i) => Math.max(0, Math.min(last, i + by)));
  };
  const keys = (e: KeyboardEvent) => {
    if (aiming) {
      const n = aiming.cells.length;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") setAiming({ ...aiming, cursor: (aiming.cursor + 1) % n });
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") setAiming({ ...aiming, cursor: (aiming.cursor + n - 1) % n });
      else if (e.key === "Enter") fire(aiming.cells[aiming.cursor]!);
      else if (e.key === "Escape") setAiming(null);
      else return;
      e.preventDefault();
      return;
    }
    if (e.key === " ") setPlaying((p) => !p);
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "End") setAt(last);
    else if (e.key === "Escape") onClose();
    else return;
    e.preventDefault();
  };

  return (
    <div className="sp-battle" role="dialog" aria-modal="true" aria-label={`Battle: ${replay.title}`} tabIndex={-1} ref={root} onKeyDown={keys}>
      <header className="sp-battle__top">
        <strong>{replay.title}</strong>
        {replay.pool ? <span>{Content.POOL_BY_ID.get(replay.pool)?.name ?? words(replay.pool)}</span> : null}
        <span className="sp-battle__turn">
          Turn {at} of {last}
        </span>
        <button type="button" className="sp-button sp-button--quiet" onClick={onClose}>
          {live ? "Hide the battle" : waiting ? `Next battle (${waiting} more)` : "Close"}
        </button>
      </header>
      <p className="sp-battle__headline" aria-live="polite">
        {commanding ? `${name(commanding.unit)}'s turn` : at === 0 ? "The battle is joined." : headline(replay, ev, name)}
      </p>
      <div className="sp-battle__field">
        <Panel title="Enemies" units={side("enemy").filter((u) => !u.hazard)} vit={vit} actor={actor} />
        <div className="sp-battle__planes">
          {grid("enemy")}
          <div className="sp-battle__gap" aria-hidden="true" />
          {grid("party")}
          {injury && injury.t === "injury" ? <Injury e={injury} name={name(injury.target)} /> : null}
        </div>
        <Panel title="The party" units={side("party")} vit={vit} actor={actor} color={color} />
      </div>
      <div className="sp-battle__controls">
        <button type="button" className="sp-button sp-button--quiet" onClick={() => step(-1)} aria-label="Previous turn">
          ◀
        </button>
        <button type="button" className="sp-button" onClick={() => {
            if (at < last) return setPlaying((p) => !p);
            setAt(0);
            setPlaying(true);
          }}>
          {at >= last ? "Replay" : playing ? "Pause" : "Play"}
        </button>
        <button type="button" className="sp-button sp-button--quiet" onClick={() => step(1)} aria-label="Next turn">
          ▶
        </button>
        <span className="sp-battle__speeds" role="group" aria-label="Speed">
          {SPEEDS.map((x) => (
            <button key={x} type="button" aria-pressed={speed === x} className={`sp-button sp-button--quiet${speed === x ? " is-on" : ""}`} onClick={() => setSpeed(x)}>
              {x}×
            </button>
          ))}
        </span>
        <button type="button" className="sp-button sp-button--quiet" onClick={() => setAt(last)}>
          Skip to the end
        </button>
        <input type="range" min={0} max={last} value={at} aria-label="Turn" onChange={(e) => step(Number(e.target.value) - at)} />
      </div>
      {live && at >= last ? (
        commanding ? (
          <CommandBar
            turn={commanding}
            name={name(commanding.unit)}
            at={{ side: "party", col: vit.get(commanding.unit)?.[5] ?? 0, row: vit.get(commanding.unit)?.[6] ?? 0 }}
            aiming={aiming}
            aim={setAiming}
            send={(c) => {
              setAiming(null);
              live.send(c);
            }}
          />
        ) : (
          <p className="sp-command" role="status">
            {live.waiting ? `Waiting on ${live.waiting}.` : "The battle runs on."}
          </p>
        )
      ) : null}
      <ol className={`sp-battle__log${fullLog ? " is-full" : ""}`} aria-label="Battle log" ref={log}>
        {lines.map(([turn, e], i) => (
          <li key={`${turn}:${i}`}>
            {fullLog ? <small>{turn}. </small> : null}
            {replayLine(replay, e).replace(/\b(uses|begins) ([a-z_:]+)/, (_, v: string, id: string) => `${v} ${abilityName(id)}`)}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Panel({ title, units, vit, actor, color }: { title: string; units: ReplayUnit[]; vit: Map<number, Vitals>; actor?: number; color?: (u: ReplayUnit) => string | undefined }) {
  return (
    <section className="sp-battle__panel" aria-label={title}>
      <h3>{title}</h3>
      <ul>
        {units.map((u) => {
          const [, hp, mp, tp, sanity, , , flags, dur, statuses] = vit.get(u.id)!;
          return (
            <li key={u.id} className={`${actor === u.id ? "is-acting" : ""}${flags & FLAG.dead ? " is-dead" : ""}`} style={color?.(u) ? { borderColor: color(u) } : undefined}>
              <strong>{u.name}</strong>
              <small>{flags & FLAG.dead ? (flags & FLAG.fled ? "Fled" : "Dead") : flags & FLAG.down ? "Down" : flags & FLAG.lastStand ? "Last Stand" : `${hp}/${u.maxHp}`}</small>
              <Bar kind="hp" value={hp} max={u.maxHp} />
              {u.person !== undefined ? (
                <>
                  <Bar kind="mp" value={mp} max={u.maxMp} />
                  <Bar kind="tp" value={tp} max={100} />
                  <Bar kind="sanity" value={sanity} max={u.maxSanity} />
                  <span className="sp-dur" aria-label="Durability">
                    {dur.map((d, i) => (
                      <span key={i} title={`${LOCS[i]}: ${d < 0 ? "Broken" : `${d}/${u.maxDur?.[i] ?? 0}`}`} className={d < 0 ? "is-broken" : d < (u.maxDur?.[i] ?? 0) / 2 ? "is-cracked" : undefined} />
                    ))}
                  </span>
                </>
              ) : null}
              {statuses.length ? <span className="sp-statuses">{[...new Set(statuses)].map(words).join(", ")}</span> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Bar({ kind, value, max }: { kind: string; value: number; max: number }) {
  return (
    <span className={`sp-bar sp-bar--${kind}`} role="meter" aria-label={kind.toUpperCase()} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span style={{ width: `${pct(value, max)}%` }} />
    </span>
  );
}

/** The injury roll's moment (§15.4): the d20, the total, and the result in its band's color. */
function Injury({ e, name }: { e: Extract<Event, { t: "injury" }>; name: string }) {
  const res = Content.INJURY_BY_ID.get(e.result);
  return (
    <div className={`sp-injury sp-injury--${res?.band ?? "mild"}`} role="status">
      <span className="sp-injury__die">{e.roll}</span>
      <span>
        {name}, {e.table === "sanity" ? "Sanity" : words(e.table)}: {e.total}
        {e.rerolled !== undefined ? ` (rerolled a ${e.rerolled})` : ""}
      </span>
      <strong>{res?.name ?? words(e.result)}</strong>
    </div>
  );
}

const pct = (v: number, max: number) => (max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0);
const initials = (n: string) =>
  n
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
