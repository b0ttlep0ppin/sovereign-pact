// The battle screen (SPEC §15.5), first pass: plays back a battle the gambits fought. The enemy grid
// (E3 E2 E1) faces the party's (Front, Middle, Back) across the gap; the enemy panel is on the left,
// the party panel on the right, the turn and the log beneath. Damage numbers pop from the struck
// cell, colored by kind; an injury roll gets its own moment. Tokens are drawn in CSS until the sprite
// pipeline exists (HANDOFF §8). Space plays and pauses, the arrows step, Escape closes.
import { Content, FLAG, replayLine, type Cell, type Command, type Replay, type ReplayUnit, type SovView, type TurnView, type Vitals } from "@vibepulse/shared/games/sovereign-pact";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import BattleFx, { landsAt, ScreenFx, strikesOf } from "./BattleFx";
import CommandBar, { type Aiming } from "./CommandBar";
import { Emblem, HERALDRY_COLORS } from "./Emblem";
import ScionSprite, { animFor, lookOf, type Anim } from "./ScionSprite";
import { spriteOf } from "./sprites";
import { playSounds, soundsOf } from "./sfx";
import "./BattleScreen.css";

type Event = Replay["frames"][number]["ev"][number];

const COLS = 3;
const ROWS = 8;
const LOCS = ["Head", "Body", "Arms", "Legs"];
/** Milliseconds a turn is shown at 1×: the wind-up, the blow, and a beat to read it. */
const TURN_MS = 1300;
/** Milliseconds at 1× an attack's frames take before the Scion is back at the ready. */
const ACT_MS = 700;
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

const NONE: Event[] = [];
const same = (a: Cell, b: Cell) => a.side === b.side && a.col === b.col && a.row === b.row;

export default function BattleScreen({ replay, view, onClose, waiting = 0, fullLog = false, sound = 0, live }: Props) {
  const states = useMemo(() => framesOf(replay), [replay]);
  const units = useMemo(() => new Map(replay.units.map((u) => [u.id, u])), [replay]);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const last = replay.frames.length;
  const vit = states[at]!;
  const ev = at > 0 ? replay.frames[at - 1]!.ev : NONE;
  // A turn waiting on this seat's command is the one on screen.
  const commanding = live?.turn && at >= last ? live.turn : null;
  const actor = commanding?.unit ?? actorOf(ev);
  const name = (id: number) => units.get(id)?.name ?? "someone";
  const pops = popsOf(ev, at, units);
  const injury = ev.find((e) => e.t === "injury");
  const charges = ev.filter((e) => e.t === "charge" && e.telegraph);
  const strikes = useMemo(() => strikesOf(ev, units), [ev, units]);
  // A number pops as the blow that made it lands; the turn lasts until the last blow has been read.
  const landed = new Map<number, number>();
  for (const s of strikes) if (!landed.has(s.to)) landed.set(s.to, landsAt(s));
  const turnMs = Math.max(TURN_MS, ...strikes.map((s) => landsAt(s) + 900));
  const root = useRef<HTMLDivElement>(null);
  const planes = useRef<HTMLDivElement>(null);
  // A Scion swings once and is back at the ready, not frozen on the swing's last frame.
  const [settled, setSettled] = useState(-1);
  useEffect(() => {
    const t = setTimeout(() => setSettled(at), ACT_MS / speed);
    return () => clearTimeout(t);
  }, [at, speed]);
  const log = useRef<HTMLOListElement>(null);
  // The full log (§15.8): every turn so far, to read instead of watch; else this turn's lines.
  const lines = (fullLog ? replay.frames.slice(0, at).flatMap((f, i) => f.ev.map((e) => [i + 1, e] as const)) : ev.map((e) => [at, e] as const)).filter(([, e]) => e.t !== "turn");

  useEffect(() => {
    if (!playing || at >= last) return;
    const t = setTimeout(() => setAt((i) => Math.min(last, i + 1)), (turnMs * (injury ? 4 : 1)) / speed);
    return () => clearTimeout(t);
  }, [playing, at, last, speed, injury, turnMs]);
  // A command aimed at a cell; it is dropped once the battle moves on.
  const [aiming, setAiming] = useState<Aiming | null>(null);
  const [aimedAt, setAimedAt] = useState(last);
  if (aimedAt !== last) {
    setAimedAt(last);
    setAiming(null);
  }
  const aimable = (c: Cell) => (aiming ? aiming.cells.findIndex((x) => same(x, c)) : -1);
  // An area choice lights everything it would cover from the cell under the cursor.
  const splash = aiming?.covers ? aiming.covers(aiming.cells[aiming.cursor]!) : [];
  const splashed = (c: Cell) => splash.some((x) => same(x, c));
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
    // A Scion is drawn from their own pieces: casting, shooting or swinging what they use, chanting while
    // a spell charges, fallen when down, and otherwise at the ready.
    const who = u.person !== undefined ? view.people.find((p) => p.id === u.person) : undefined;
    const scion = who ? lookOf(who, view.houses[who.house]?.colors, view.items) : null;
    const used = settled === at ? undefined : ev.find((e) => e.t === "use" && e.unit === u.id);
    const scionAnim: Anim | null = !scion
      ? null
      : flags & (FLAG.dead | FLAG.down)
        ? "hurt"
        : used?.t === "use"
          ? animFor(scion, Content.ACTIVE_BY_ID.get(used.ability))
          : flags & FLAG.charging
            ? "chant"
            : "idle";
    const aimed = aimOn(u);
    const cursor = !!aimed && !!aiming && (aiming.covers ? splash.some((c) => c.side === u.side && c.col >= vit.get(u.id)![5] && c.col < vit.get(u.id)![5] + u.size[0] && c.row >= vit.get(u.id)![6] && c.row < vit.get(u.id)![6] + u.size[1]) : same(aimed, aiming.cells[aiming.cursor]!));
    return (
      <div
        key={u.id}
        data-unit={u.id}
        onClick={aimed ? () => fire(aimed) : undefined}
        onMouseEnter={aimed && aiming ? () => setAiming({ ...aiming, cursor: aiming.cells.findIndex((c) => same(c, aimed)) }) : undefined}
        className={`sp-unit sp-unit--${u.side}${aimed ? " is-targetable" : ""}${cursor ? " is-cursor" : ""}${u.boss ? " is-boss" : ""}${u.hazard ? " is-hazard" : ""}${actor === u.id ? " is-acting" : ""}${flags & FLAG.charging ? " is-charging" : ""}${state}`}
        style={style}
        title={`${u.name}: ${hp}/${u.maxHp} HP`}
      >
        {scion ? (
          <ScionSprite
            key={`${scionAnim}-${used ? at : 0}`}
            className="sp-unit__scion"
            look={scion}
            anim={scionAnim!}
            size="fit"
            play={scionAnim === "idle" || scionAnim === "chant" ? "loop" : "hold"}
          />
        ) : sprite ? (
          <img className={`sp-unit__sprite${sprite.flip ? " is-flipped" : ""}`} src={sprite.url} alt="" draggable={false} />
        ) : (
          <span className="sp-unit__body">{u.hazard ? "⚠" : initials(u.name)}</span>
        )}
        {cursor ? (
          // Whom the choice will strike, by name, with what they have left.
          <span className="sp-unit__aim">
            {u.name} <small>{hp}/{u.maxHp}</small>
          </span>
        ) : null}
        {actor === u.id && !(flags & FLAG.dead) ? <span className="sp-unit__marker" aria-hidden="true" /> : null}
        <span className="sp-unit__hp" aria-hidden="true">
          <span style={{ width: `${pct(hp, u.maxHp)}%` }} />
        </span>
        {u.house !== undefined && view.houses[u.house] ? (
          // Whose Scion this is (Josh 2026-11-02): the House's arms in miniature.
          <span className="sp-unit__house" title={`House ${view.houses[u.house]!.name}`}>
            <Emblem emblem={view.houses[u.house]!.emblem} colors={view.houses[u.house]!.colors} size={16} />
          </span>
        ) : null}
        {mine.map((p, i) => (
          <span key={p.key} className={`sp-pop sp-pop--${p.kind}`} style={{ ["--i" as string]: i, ["--impact" as string]: `${Math.round((landed.get(u.id) ?? 0) / speed)}ms` }}>
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
        const cls = `sp-cell${marked ? " is-telegraphed" : ""}${k >= 0 ? " is-target" : ""}${k >= 0 && k === aiming?.cursor ? " is-cursor" : ""}${splashed({ side: s, col, row }) ? " is-splash" : ""}`;
        return (
          <span
            key={i}
            className={cls}
            style={{ gridColumn: x + 1, gridRow: row + 1 }}
            onClick={k >= 0 ? () => fire({ side: s, col, row }) : undefined}
            onMouseEnter={k >= 0 && aiming && k !== aiming.cursor ? () => setAiming({ ...aiming, cursor: k }) : undefined}
          />
        );
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
    <div className={`sp-battle${aiming ? " is-aiming" : ""}`} role="dialog" aria-modal="true" aria-label={`Battle: ${replay.title}`} tabIndex={-1} ref={root} onKeyDown={keys}>
      <ScreenFx strikes={strikes} turn={at} speed={speed} />
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
      <p className={`sp-battle__headline${commanding ? " is-yours" : ""}`} aria-live="polite">
        {commanding
          ? aiming
            ? `${name(commanding.unit)}: ${aiming.label}. Choose a target`
            : `${name(commanding.unit)}'s turn. What do they do?`
          : at === 0
            ? "The battle is joined."
            : headline(replay, ev, name)}
      </p>
      <div className="sp-battle__field">
        <Panel title="Enemies" units={side("enemy").filter((u) => !u.hazard)} vit={vit} actor={actor} />
        <div className="sp-battle__planes" ref={planes}>
          {grid("enemy")}
          <div className="sp-battle__gap" aria-hidden="true" />
          {grid("party")}
          <BattleFx planes={planes} strikes={strikes} turn={at} speed={speed} />
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
      {live && at < last && live.turn ? (
        // Watching back over the battle: their turn still waits, a click away (scrubbing pauses the replay).
        <p className="sp-command" role="status">
          {name(live.turn.unit)}'s turn is waiting.{" "}
          <button type="button" className="sp-button" onClick={() => setAt(last)}>
            Back to {name(live.turn.unit)}'s turn
          </button>
        </p>
      ) : null}
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
  const table = Content.INJURY_TABLES.find((x) => x.id === e.table);
  const where = e.table === "sanity" ? "mind" : e.table;
  const bonus = e.total - e.roll;
  return (
    <div className={`sp-injury sp-injury--${res?.band ?? "mild"}`} role="status">
      <small className="sp-injury__why">{e.table === "sanity" ? `${name}'s mind is breaking` : `${name}'s ${where} ${where === "legs" || where === "arms" ? "give" : "gives"} way`}: a roll for injury</small>
      <span className="sp-injury__die">{e.roll}</span>
      <span className="sp-injury__sum">
        d20 rolled {e.roll}
        {e.rerolled !== undefined ? ` (the Dice of the Marches rerolled a ${e.rerolled})` : ""}
        {bonus ? `, ${bonus > 0 ? "+" : ""}${bonus} from Resilience${e.table === "sanity" ? " and Sagacity" : ""}, traits and how they were struck` : ""} = <b>{e.total}</b>
      </span>
      {table ? (
        // The whole table, worst to best, with where this roll fell.
        <ol className="sp-injury__ladder" aria-label={`${words(e.table)} injury table`}>
          {table.results.map((r, i) => {
            const from = i ? table.results[i - 1]!.max + 1 : 1;
            return (
              <li key={r.id} className={`sp-injury__rung sp-injury__rung--${r.band}${r.id === e.result ? " is-hit" : ""}`} title={`${r.max >= 99 ? `${from}+` : from === r.max ? from : `${from}–${r.max}`}: ${r.name}. ${r.text}`}>
                <small>{r.max >= 99 ? `${from}+` : from === r.max ? from : `${from}–${r.max}`}</small>
              </li>
            );
          })}
        </ol>
      ) : null}
      <strong>{res?.name ?? words(e.result)}</strong>
      {res?.text ? <p className="sp-injury__text">{res.text}</p> : null}
      {e.tooth ? <p className="sp-injury__text">The Saint's Tooth turned a mortal wound into this.</p> : null}
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
