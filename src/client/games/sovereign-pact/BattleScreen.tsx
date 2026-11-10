// The battle screen (SPEC §15.5), first pass: plays back a battle the gambits fought. The enemy grid
// (E3 E2 E1) faces the party's (Front, Middle, Back) across the gap; the enemy panel is on the left,
// the party panel on the right, the turn and the log beneath. Damage numbers pop from the struck
// cell, colored by kind; an injury roll gets its own moment. Tokens are drawn in CSS until the sprite
// pipeline exists (HANDOFF §8). Space plays and pauses, the arrows step, Escape closes.
import { backdrop } from "./backdrop";
import { Content, FLAG, replayLine, TUNING, type Cell, type Command, type Replay, type ReplayUnit, type SovView, type TurnView, type Vitals } from "@vibepulse/shared/games/sovereign-pact";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import BattleFx, { landsAt, ScreenFx, strikesOf } from "./BattleFx";
import CommandBar, { type Aiming } from "./CommandBar";
import { Emblem, HERALDRY_COLORS } from "./Emblem";
import ScionSprite, { animFor, lookOf, type Anim } from "./ScionSprite";
import { spriteOf } from "./sprites";
import { BattleLine } from "./LogIcons";
import { statusAbout, statusLook, tintOf } from "./statusLook";
import { injuryCue, playSounds, soundsOf } from "./sfx";
import { uiSound } from "./uiSound";
import { telegraphed } from "./telegraph";
import "./BattleScreen.css";

type Event = Replay["frames"][number]["ev"][number];

const COLS = 3;
const ROWS = 8;
const LOCS = ["Head", "Body", "Arms", "Legs"];
/** Milliseconds a turn is shown at 1×: the wind-up, the blow, and a beat to read it. */
const TURN_MS = 1300;
/** Milliseconds at 1× an attack's frames take before the Scion is back at the ready. */
const ACT_MS = 700;
/** Milliseconds the pause before a battle lasts unless dismissed. */
const INTRO_MS = 5000;
/** How long thrown dice tumble, and how long a turn with dice in it stays on screen. */
const DICE_ROLL_MS = 650;
const DICE_READ_MS = 2000;
/** How long an injury's die tumbles, how long another House's die waits to be thrown, and how long the result holds. */
const ROLL_MS = 1500;
const AUTO_ROLL_MS = 1000;
const INJURY_READ_MS = 3600;
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

/** A status by name; a Ward-Sensed foe's buff with its ticks left ("haste@120" → "Haste (120)"). */
const statusText = (s: string) => {
  const [id, ticks] = s.split("@");
  return ticks ? `${words(id!)} (${ticks})` : words(id!);
};

/** What a turn used, so its hits can show what kind of harm they did. */
const usedIn = (ev: Replay["frames"][number]["ev"] | undefined): string | undefined => {
  const use = ev?.find((x) => x.t === "use");
  return use?.t === "use" ? use.ability : undefined;
};

/** What Commune read on a foe (§12.9): its weak point and the elements it fears or shrugs off. */
function readOf(u: ReplayUnit): string {
  const r = u.read!;
  const weak = r.weak ? `Weak point: ${words(r.weak.location)} ×${r.weak.mult}.` : "No weak point.";
  const aff = Object.entries(r.affinity).map(([el, n]) => `${words(el)} ${n! > 0 ? `resists ${n}` : `weak ${-n!}`}`);
  return [weak, ...(aff.length ? [aff.join(", ") + "."] : [])].join(" ");
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
    else if (e.t === "mend") out.push({ key, target: e.target, text: `+${e.amount}`, kind: "heal", tag: e.unbroken ? `${words(e.loc)} mended!` : words(e.loc) });
    else if (e.t === "sanity") out.push({ key, target: e.target, text: `-${e.amount}`, kind: "sanity" });
    else if (e.t === "miss") out.push({ key, target: e.target, text: "Miss", kind: "miss" });
    else if (e.t === "pocket") out.push({ key, target: e.unit, text: `${Content.CONSUMABLE_BY_ID.get(e.item)?.name ?? e.item}!`, kind: "heal", tag: e.target === undefined ? "Made" : "Stolen" });
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
  /** Open on the battle's last turn, for its ending (a battle just fought on screen). */
  ending?: boolean;
  /** A fight being fought, opened again after it was hidden: it starts at the turn being fought. */
  resume?: boolean;
}

export interface Live {
  turn: TurnView | null;
  /** Whom the battle waits on, when not on this seat. */
  waiting: string | null;
  send: (c: Command) => void;
  /** Who acts next (§10.4), from the battle as it stands. */
  order?: { unit: number; charge?: boolean }[];
}

const NONE: Event[] = [];
const same = (a: Cell, b: Cell) => a.side === b.side && a.col === b.col && a.row === b.row;

/** How many turns the log keeps in view when it is not the full log. */
const LOG_TURNS = 6;

export default function BattleScreen({ replay, view, onClose, waiting = 0, fullLog = false, sound = 0, live, ending = false, resume = false }: Props) {
  const states = useMemo(() => framesOf(replay), [replay]);
  const units = useMemo(() => new Map(replay.units.map((u) => [u.id, u])), [replay]);
  // A fight opened again while it is being fought picks up where it stands, not from its first turn.
  const [at, setAt] = useState(ending || resume ? replay.frames.length : 0);
  const [playing, setPlaying] = useState(!ending);
  // A pause before the fight (Josh 2026-11-02): where it is, an omen, and what waits.
  // A live battle opens on its card even when the foes have already moved: they play out after it.
  const [intro, setIntro] = useState(!ending && !resume);
  useEffect(() => {
    if (!intro) return;
    const t = setTimeout(() => setIntro(false), INTRO_MS);
    return () => clearTimeout(t);
  }, [intro]);
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
  const end = replay.frames.at(-1)?.ev.find((e) => e.t === "end");
  // The turn order (§10.4): a battle being fought forecasts it; one being watched knows it.
  const order = live && at >= last ? (live.order ?? []) : replay.frames.slice(at).flatMap((f) => f.ev.filter((e) => e.t === "turn").map((e) => ({ unit: e.unit, charge: false }))).slice(0, 8);
  const warned = useMemo(() => telegraphed(replay, at, vit), [replay, at, vit]);
  const strikes = useMemo(() => strikesOf(ev, units), [ev, units]);
  // A number pops as the blow that made it lands; the turn lasts until the last blow has been read.
  const landed = new Map<number, number>();
  for (const s of strikes) if (!landed.has(s.to)) landed.set(s.to, landsAt(s));
  // Thrown dice hold the turn until they have landed and been read.
  const turnMs = Math.max(TURN_MS, ...strikes.map((s) => landsAt(s) + 900), ev.some((e) => e.t === "lots" || e.t === "fizzle") ? DICE_READ_MS : 0);
  const root = useRef<HTMLDivElement>(null);
  const planes = useRef<HTMLDivElement>(null);
  // A Scion swings once and is back at the ready, not frozen on the swing's last frame.
  const [settled, setSettled] = useState(-1);
  useEffect(() => {
    const t = setTimeout(() => setSettled(at), ACT_MS / speed);
    return () => clearTimeout(t);
  }, [at, speed]);
  const log = useRef<HTMLOListElement>(null);
  // The log (§15.8) sits in the column under the enemies (Josh: "the combat log can use some of the dead
  // space"): the last few turns, newest at the foot; the full log keeps every turn so far.
  const from = fullLog ? 0 : Math.max(0, at - LOG_TURNS);
  const lines = replay.frames
    .slice(from, at + 1)
    .flatMap((f, i) => f.ev.map((e) => [from + i, e] as const))
    .filter(([, e]) => e.t !== "turn");

  // An injury roll waits on its die (Josh 2026-11-03: "the player should have to click the dice … so
  // theres more drama"): the owner's click throws it, anyone else's rolls on its own; once it lands the
  // result holds the screen long enough to read.
  const [rolledAt, setRolledAt] = useState(-1);
  // Its card stays until it is put away (Josh 2026-11-03: it stayed "til someone else takes a turn").
  const [doneAt, setDoneAt] = useState(-1);
  const held = !!injury && rolledAt !== at;
  const mine = injury?.t === "injury" && units.get(injury.target)?.house === (view.me ?? 0);
  useEffect(() => {
    // A fight being fought only plays forward (Josh 2026-11-03: "I don't know if we need all this replay
    // old turn stuff"); stepping and pausing are for watching a battle back.
    if ((!playing && !live) || at >= last || intro || held) return;
    const t = setTimeout(() => setAt((i) => Math.min(last, i + 1)), (injury ? INJURY_READ_MS : turnMs) / speed);
    return () => clearTimeout(t);
  }, [playing, live, at, last, speed, injury, turnMs, intro, held]);
  // A command aimed at a cell; it is dropped once the battle moves on.
  const [aiming, setAiming] = useState<Aiming | null>(null);
  // The combatant under the mouse, on the field or in a list: both light up (Josh 2026-11-03).
  const [hover, setHover] = useState<number | null>(null);
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
  // The aim's cursor steps from target to target with a tick.
  const moveCursor = (k: number) => {
    if (!aiming || k < 0 || k === aiming.cursor) return;
    uiSound("ui_move");
    setAiming({ ...aiming, cursor: k });
  };
  const fire = (c: Cell) => {
    if (!aiming || !live) return;
    uiSound("ui_confirm");
    live.send(aiming.send(c));
    setAiming(null);
  };
  // Each turn sounds as it comes on screen, stepping forward; stepping back is silent. A new turn arriving
  // in a live fight (a new replay object) neither cuts the sounds of the turn on screen nor replays them.
  const heard = useRef(0);
  const hush = useRef<() => void>(() => undefined);
  useEffect(() => {
    if (at === heard.current) return;
    const forward = at === heard.current + 1;
    heard.current = at;
    hush.current();
    hush.current = () => undefined;
    if (!forward || !sound) return;
    // The injury's own sound waits for its die to land.
    hush.current = playSounds(soundsOf(replay.frames[at - 1]!.ev, units).filter((x) => x.cue !== "injury" && x.cue !== "dread"), sound, speed);
  }, [at, replay, units, sound, speed]);
  useEffect(() => () => hush.current(), []);
  // The keys go to the screen: on opening, and when a choice asks for its cell (its button is gone).
  const aimingNow = aiming !== null;
  useEffect(() => root.current?.focus(), [aimingNow]);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
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
    const marks = flags & FLAG.dead ? [] : [...new Set(v[9].map((x) => x.split("@")[0]!))];
    const tint = tintOf(marks);
    const x = u.side === "enemy" ? COLS - col - u.size[0] : col;
    const style: CSSProperties = {
      left: `${(x / COLS) * 100}%`,
      top: `${(row / ROWS) * 100}%`,
      width: `${(u.size[0] / COLS) * 100}%`,
      height: `${(u.size[1] / ROWS) * 100}%`,
      ...(color(u) ? { ["--ring" as string]: color(u) } : {}),
      ...(tint ? { ["--tint" as string]: tint } : {}),
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
    const odds = aimed && aiming?.hit ? aiming.hit[aiming.cells.findIndex((c) => same(c, aimed))] : undefined;
    const cursor = !!aimed && !!aiming && (aiming.covers ? splash.some((c) => c.side === u.side && c.col >= vit.get(u.id)![5] && c.col < vit.get(u.id)![5] + u.size[0] && c.row >= vit.get(u.id)![6] && c.row < vit.get(u.id)![6] + u.size[1]) : same(aimed, aiming.cells[aiming.cursor]!));
    return (
      <div
        key={u.id}
        data-unit={u.id}
        onClick={aimed ? () => fire(aimed) : undefined}
        onMouseEnter={() => {
          setHover(u.id);
          if (aimed && aiming) moveCursor(aiming.cells.findIndex((c) => same(c, aimed)));
        }}
        onMouseLeave={() => setHover((h) => (h === u.id ? null : h))}
        className={`sp-unit sp-unit--${u.side}${aimed ? " is-targetable" : ""}${cursor ? " is-cursor" : ""}${hover === u.id ? " is-hovered" : ""}${u.boss ? " is-boss" : ""}${u.hazard ? " is-hazard" : ""}${actor === u.id ? " is-acting" : ""}${flags & FLAG.charging ? " is-charging" : ""}${tint ? " is-tinted" : ""}${state}`}
        style={style}
        title={`${u.name}: ${hp}/${u.maxHp} HP${u.read ? `\n${readOf(u)}` : ""}`}
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
            {u.read ? <small className="sp-unit__read">{readOf(u)}</small> : null}
          </span>
        ) : null}
        {odds !== undefined && odds < 100 ? (
          // The chance to land on this foe (Josh 2026-11-03).
          <span className="sp-unit__hit" title={`${odds}% to hit`}>{odds}%</span>
        ) : null}
        {actor === u.id && !(flags & FLAG.dead) ? <span className="sp-unit__marker" aria-hidden="true" /> : null}
        {marks.length ? (
          <span className="sp-unit__marks" title={marks.map((m) => `${statusText(m)}: ${statusAbout(m)}`).join("\n")}>
            {marks.slice(0, 4).map((m) => (
              <i key={m} style={{ ["--c" as string]: statusLook(m).color }}>{statusLook(m).glyph}</i>
            ))}
            {marks.length > 4 ? <i className="is-more">+{marks.length - 4}</i> : null}
          </span>
        ) : null}
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
        const marked = warned.has(`${s}:${col}:${row}`);
        const k = aimable({ side: s, col, row });
        const cls = `sp-cell${marked ? " is-telegraphed" : ""}${k >= 0 ? " is-target" : ""}${k >= 0 && k === aiming?.cursor ? " is-cursor" : ""}${splashed({ side: s, col, row }) ? " is-splash" : ""}`;
        return (
          <span
            key={i}
            className={cls}
            style={{ gridColumn: x + 1, gridRow: row + 1 }}
            onClick={k >= 0 ? () => fire({ side: s, col, row }) : undefined}
            onMouseEnter={k >= 0 && aiming && k !== aiming.cursor ? () => moveCursor(k) : undefined}
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
    // Any key ends the pause before the fight; Space and Enter only that.
    if (intro) {
      setIntro(false);
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        return;
      }
    }
    if (aiming) {
      const n = aiming.cells.length;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") moveCursor((aiming.cursor + 1) % n);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") moveCursor((aiming.cursor + n - 1) % n);
      else if (e.key === "Enter") fire(aiming.cells[aiming.cursor]!);
      else if (e.key === "Escape") {
        uiSound("ui_back");
        setAiming(null);
      } else return;
      e.preventDefault();
      return;
    }
    // A focused button or slider keeps its own keys: Space on a command must not pause the fight.
    const own = e.target instanceof HTMLElement && e.target !== e.currentTarget && /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName);
    if (own && e.key !== "Escape") return;
    // A fight being fought only goes forward: End catches up to the turn being fought.
    if (live && e.key !== "Escape" && e.key !== "End") return;
    if (e.key === " ") setPlaying((p) => !p);
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "End") setAt(last);
    else if (e.key === "Escape") onClose();
    else return;
    e.preventDefault();
  };

  return (
    <div className={`sp-battle${aiming ? " is-aiming" : ""}`} style={backdrop(replay.pool)} role="dialog" aria-modal="true" aria-label={`Battle: ${replay.title}`} tabIndex={-1} ref={root} onKeyDown={keys}>
      <div className="sp-battle__backdrop" aria-hidden="true">
        <span className="sp-battle__sky" />
        <span className="sp-battle__ground" />
      </div>
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
      {order.length ? (
        <ol className="sp-order" aria-label="Turn order">
          <li className="sp-order__label">Next</li>
          {order.map((o, i) => {
            const u = units.get(o.unit);
            if (!u) return null;
            const scionOf = u.person !== undefined ? view.people.find((p) => p.id === u.person) : undefined;
            const look = scionOf ? lookOf(scionOf, view.houses[scionOf.house]?.colors, view.items) : null;
            const sprite = spriteOf(u);
            return (
              <li key={i} className={`sp-order__slot sp-order__slot--${u.side}${i === 0 ? " is-now" : ""}`} title={`${u.name}${o.charge ? ": a spell lands" : ""}`}>
                {look ? <ScionSprite look={look} size={28} /> : sprite ? <img src={sprite.url} alt="" draggable={false} /> : <span>{initials(u.name)}</span>}
                {o.charge ? <i aria-hidden="true">✦</i> : null}
                <small>{u.name.split(" ")[0]}</small>
              </li>
            );
          })}
        </ol>
      ) : null}
      <div className="sp-battle__field">
        <div className="sp-battle__side">
          <Panel title="Enemies" units={side("enemy").filter((u) => !u.hazard)} vit={vit} actor={actor} hover={hover} onHover={setHover} />
        </div>
        <div className="sp-battle__planes" ref={planes}>
          {grid("enemy")}
          {/* The log between the two sides (Josh: "it should be in the middle of the two battle sides"). */}
          <div className="sp-battle__gap">
            <DiceTray key={at} ev={ev} name={name} speed={speed} />
            <ol className={`sp-battle__log${fullLog ? " is-full" : ""}`} aria-label="Battle log" ref={log}>
              {lines.map(([turn, e], i) => (
                <li key={`${turn}:${i}`} className={`sp-logline${turn === at ? " is-now" : ""}`}>
                  <small>{turn + 1}. </small>
                  <BattleLine
                    e={e}
                    text={replayLine(replay, e).replace(/\b(uses|begins) ([a-z_:]+)/, (_, v: string, id: string) => `${v} ${abilityName(id)}`)}
                    replay={replay}
                    view={view}
                    ability={usedIn(replay.frames[turn]?.ev)}
                  />
                </li>
              ))}
            </ol>
          </div>
          {grid("party")}
          <BattleFx planes={planes} strikes={strikes} turn={at} speed={speed} />
          {injury && injury.t === "injury" && doneAt !== at ? (
            <Injury
              key={at}
              e={injury}
              name={name(injury.target)}
              mine={mine}
              rolled={rolledAt === at}
              onRolled={() => setRolledAt(at)}
              onDone={() => {
                setDoneAt(at);
                if (at < last) setAt(at + 1);
              }}
              sound={sound}
            />
          ) : null}
        </div>
        <Panel
          title="The party"
          units={side("party")}
          vit={vit}
          actor={actor}
          hover={hover}
          onHover={setHover}
          color={color}
          badge={(u) => (u.house !== undefined && view.houses[u.house] ? <Emblem emblem={view.houses[u.house]!.emblem} colors={view.houses[u.house]!.colors} size={18} /> : null)}
        />
      </div>
      {intro ? <Intro replay={replay} onGo={() => setIntro(false)} /> : null}
      {!live && at >= last && end ? <Ending replay={replay} vit={vit} end={end} onClose={onClose} again={() => { setAt(0); setPlaying(true); }} waiting={waiting} /> : null}
      <div className="sp-battle__foot">
      {live ? (
        <div className="sp-battle__controls">
          {at < last - 1 ? (
            <button type="button" className="sp-button sp-button--quiet" onClick={() => setAt(last)} title="Jump to the turn being fought now">
              Skip to now
            </button>
          ) : null}
          <span className="sp-battle__speeds" role="group" aria-label="Speed" title="How fast turns play">
            {SPEEDS.map((x) => (
              <button key={x} type="button" aria-pressed={speed === x} className={`sp-button sp-button--quiet${speed === x ? " is-on" : ""}`} onClick={() => setSpeed(x)}>
                {x}×
              </button>
            ))}
          </span>
        </div>
      ) : (
        <div className="sp-battle__controls" title="Watch the battle back: step through its turns, play it again, or change how fast it plays.">
          <span className="sp-battle__controls-label">Playback</span>
          <button type="button" className="sp-button sp-button--quiet" onClick={() => step(-1)} aria-label="Previous turn" title="Back one turn">
            ◀
          </button>
          <button
            type="button"
            className="sp-button sp-button--quiet"
            title={at >= last ? "Play the whole battle again from the start" : playing ? "Pause the playback" : "Play on"}
            onClick={() => {
              if (at < last) return setPlaying((p) => !p);
              setAt(0);
              setPlaying(true);
            }}
          >
            {at >= last ? "Replay" : playing ? "Pause" : "Play"}
          </button>
          <button type="button" className="sp-button sp-button--quiet" onClick={() => step(1)} aria-label="Next turn" title="Forward one turn">
            ▶
          </button>
          <span className="sp-battle__speeds" role="group" aria-label="Speed" title="How fast turns play">
            {SPEEDS.map((x) => (
              <button key={x} type="button" aria-pressed={speed === x} className={`sp-button sp-button--quiet${speed === x ? " is-on" : ""}`} onClick={() => setSpeed(x)}>
                {x}×
              </button>
            ))}
          </span>
          <button type="button" className="sp-button sp-button--quiet" onClick={() => setAt(last)} title="Jump to how the battle ended">
            Skip to the end
          </button>
          <input type="range" min={0} max={last} value={at} aria-label="Turn" onChange={(e) => step(Number(e.target.value) - at)} />
        </div>
      )}
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
      </div>
    </div>
  );
}

/** One side's cards. The title is for screen readers only (Josh: "'The Party' kinda hard to read, you can just remove that text"). */
function Panel({ title, units, vit, actor, hover, onHover, color, badge }: { title: string; units: ReplayUnit[]; vit: Map<number, Vitals>; actor?: number; hover: number | null; onHover: (id: number | null) => void; color?: (u: ReplayUnit) => string | undefined; badge?: (u: ReplayUnit) => React.ReactNode }) {
  return (
    <section className="sp-battle__panel" aria-label={title}>
      <ul>
        {units.map((u) => {
          const [, hp, mp, tp, sanity, , , flags, dur, statuses] = vit.get(u.id)!;
          return (
            <li
              key={u.id}
              className={`${actor === u.id ? "is-acting" : ""}${flags & FLAG.dead ? " is-dead" : ""}${hover === u.id ? " is-hovered" : ""}`}
              style={color?.(u) ? { borderColor: color(u) } : undefined}
              onMouseEnter={() => onHover(u.id)}
              onMouseLeave={() => onHover(null)}
            >
              <strong>
                {badge ? <span className="sp-battle__badge">{badge(u)}</span> : null}
                {u.name}
              </strong>
              <small>{flags & FLAG.dead ? (flags & FLAG.fled ? "Fled" : "Dead") : flags & FLAG.down ? "Down" : flags & FLAG.lastStand ? "Last Stand" : null}</small>
              <Bar kind="hp" label="HP" tip="Hit points: at 0 they fall" value={hp} max={u.maxHp} />
              {u.person !== undefined ? (
                <>
                  <Bar kind="mp" label="MP" tip="Magic points, spent on spells and arts" value={mp} max={u.maxMp} />
                  <Bar kind="tp" label="TP" tip="Tension, built by striking and being struck; spent on techniques. It resets each battle." value={tp} max={100} />
                  <Bar kind="sanity" label="San" tip="Sanity: at 0 the mind breaks" value={sanity} max={u.maxSanity} />
                  <Durability dur={dur} max={u.maxDur ?? []} />
                </>
              ) : null}
              {statuses.length ? (
                <span className="sp-statuses">
                  {[...new Set(statuses)].map((x) => (
                    <span key={x} className="sp-statuses__one" tabIndex={0} data-tip={`${statusText(x)}: ${statusAbout(x)}`} aria-label={`${statusText(x)}: ${statusAbout(x)}`} style={{ ["--c" as string]: statusLook(x).color }}>
                      <i aria-hidden="true">{statusLook(x).glyph}</i> {statusText(x)}
                    </span>
                  ))}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** How whole a place's armor is: full, worn, cracked, broken. */
const durTone = (d: number, max: number): string => (d < 0 ? "is-broken" : max <= 0 || d / max >= 0.66 ? "is-whole" : d / max >= 0.33 ? "is-worn" : "is-cracked");

/**
 * Durability by hit location (§11.1), at a glance: a little figure whose head, body, arms and legs take the
 * color of their armor's state, beside each place's numbers (Josh: "cleanly display hit location durability").
 */
function Durability({ dur, max }: { dur: readonly number[]; max: readonly number[] }) {
  const tone = (i: number) => durTone(dur[i] ?? 0, max[i] ?? 0);
  const tip = (i: number) => `${LOCS[i]}: ${(dur[i] ?? 0) < 0 ? "Broken" : `${dur[i]}/${max[i] ?? 0}`}`;
  return (
    <span className="sp-durability" title="Armor Durability by hit location: at 0 that place is Broken, and blows there land harder">
      <svg className="sp-durability__doll" viewBox="0 0 12 21" width="14" height="25" aria-hidden="true">
        <circle cx="6" cy="2.8" r="2.4" className={tone(0)}><title>{tip(0)}</title></circle>
        <rect x="3.6" y="5.8" width="4.8" height="7" rx="0.8" className={tone(1)}><title>{tip(1)}</title></rect>
        <rect x="1" y="6" width="2" height="6.5" rx="0.8" className={tone(2)}><title>{tip(2)}</title></rect>
        <rect x="9" y="6" width="2" height="6.5" rx="0.8" className={tone(2)} />
        <rect x="3.6" y="13.3" width="2.1" height="7.2" rx="0.8" className={tone(3)}><title>{tip(3)}</title></rect>
        <rect x="6.3" y="13.3" width="2.1" height="7.2" rx="0.8" className={tone(3)} />
      </svg>
      <span className="sp-durability__nums" aria-label="Durability">
        {LOCS.map((l, i) => (
          <span key={l} className={tone(i)} title={tip(i)}>
            <b>{l}</b> {(dur[i] ?? 0) < 0 ? "Broken" : `${dur[i]}/${max[i] ?? 0}`}
          </span>
        ))}
      </span>
    </span>
  );
}

/** One labelled bar: what it measures, how full, and the numbers. */
function Bar({ kind, label, tip, value, max }: { kind: string; label: string; tip: string; value: number; max: number }) {
  return (
    <span className={`sp-stat sp-stat--${kind}`} title={tip}>
      <span className="sp-stat__label">{label}</span>
      <span className={`sp-bar sp-bar--${kind}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
        <span style={{ width: `${pct(value, max)}%` }} />
      </span>
      <span className="sp-stat__value">{kind === "tp" ? value : `${Math.max(0, value)}/${max}`}</span>
    </span>
  );
}

/**
 * The injury roll's moment (§15.4): the table it is rolled on, worst to best, then the d20. The owner
 * throws it with a click (Josh 2026-11-03: "the player should have to click the dice"); it tumbles, lands,
 * and only then shows the total and what it does. Another House's Scion's die is thrown for them.
 */
function Injury({ e, name, mine, rolled, onRolled, onDone, sound }: { e: Extract<Event, { t: "injury" }>; name: string; mine: boolean; rolled: boolean; onRolled: () => void; onDone: () => void; sound: number }) {
  const res = Content.INJURY_BY_ID.get(e.result);
  const table = Content.INJURY_TABLES.find((x) => x.id === e.table);
  const where = e.table === "sanity" ? "mind" : e.table;
  const bonus = e.total - e.roll;
  const [phase, setPhase] = useState<"await" | "rolling" | "landed">(rolled ? "landed" : "await");
  const [face, setFace] = useState(e.roll);
  useEffect(() => {
    if (phase !== "await" || mine) return;
    const t = setTimeout(() => setPhase("rolling"), AUTO_ROLL_MS);
    return () => clearTimeout(t);
  }, [phase, mine]);
  useEffect(() => {
    if (phase !== "rolling") return;
    let k = 0;
    // The faces it shows while it tumbles: a fixed run, so a replay tumbles the same.
    const spin = setInterval(() => setFace(((e.roll * 7 + ++k * 13) % 20) + 1), 70);
    const land = setTimeout(() => {
      clearInterval(spin);
      setFace(e.roll);
      setPhase("landed");
      onRolled();
      playSounds([{ cue: injuryCue(e.result), at: 0 }], sound);
    }, ROLL_MS);
    return () => {
      clearInterval(spin);
      clearTimeout(land);
    };
    // onRolled and sound are read once, when the die lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, e]);
  const landed = phase === "landed";
  const dire = landed && (res?.death || res?.band === "devastating");
  return (
    <div className={`sp-injury sp-injury--${landed ? (res?.band ?? "mild") : "pending"}${dire ? " is-dire" : ""}`} role="status">
      <small className="sp-injury__why">{e.table === "sanity" ? `${name}'s mind is breaking` : `${name}'s ${where} ${where === "legs" || where === "arms" ? "give" : "gives"} way`}: a roll for injury</small>
      {table ? (
        // The whole table, worst to best, with where this roll fell once it lands.
        <ol className="sp-injury__ladder" aria-label={`${words(e.table)} injury table`}>
          {table.results.map((r, i) => {
            const from = i ? table.results[i - 1]!.max + 1 : 1;
            return (
              <li key={r.id} className={`sp-injury__rung sp-injury__rung--${r.band}${landed && r.id === e.result ? " is-hit" : ""}`} title={`${r.max >= 99 ? `${from}+` : from === r.max ? from : `${from}–${r.max}`}: ${r.name}. ${r.text}`}>
                <small>{r.max >= 99 ? `${from}+` : from === r.max ? from : `${from}–${r.max}`}</small>
              </li>
            );
          })}
        </ol>
      ) : null}
      {phase === "await" ? (
        mine ? (
          <button type="button" className="sp-injury__die is-waiting" autoFocus onClick={() => setPhase("rolling")} aria-label={`Roll the d20 for ${name}`}>
            d20
          </button>
        ) : (
          <span className="sp-injury__die is-waiting" aria-hidden="true">
            d20
          </span>
        )
      ) : (
        <span className={`sp-injury__die${phase === "rolling" ? " is-rolling" : " is-landed"}`} aria-live="off">
          {face}
        </span>
      )}
      {phase === "await" ? <p className="sp-injury__text">{mine ? "Click the die to roll. Low is worse." : "The die is cast for them…"}</p> : null}
      {phase === "rolling" ? <p className="sp-injury__text">The die tumbles…</p> : null}
      {landed ? (
        <>
          <span className="sp-injury__sum">
            d20 rolled {e.roll}
            {e.rerolled !== undefined ? ` (the Dice of the Marches rerolled a ${e.rerolled})` : ""}
            {bonus ? `, ${bonus > 0 ? "+" : ""}${bonus} from Resilience${e.table === "sanity" ? " and Sagacity" : ""}, traits and how they were struck` : ""} = <b>{e.total}</b>
          </span>
          <strong>{res?.name ?? words(e.result)}</strong>
          {res?.text ? <p className="sp-injury__text">{res.text}</p> : null}
          {e.tooth ? <p className="sp-injury__text">The Saint's Tooth turned a mortal wound into this.</p> : null}
          <button type="button" className="sp-button sp-injury__done" autoFocus onClick={onDone}>
            So be it
          </button>
        </>
      ) : null}
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

/** What each Cast Lots total does (§12.7), for the dice tray. */
function lotsText(total: number): string {
  const D = TUNING.combat.dice;
  if (total <= 2) return `Snake eyes: the next action comes ${D.snakeEyesCt} CT later.`;
  if (total <= 4) return `TP −${D.tp}.`;
  if (total === 5) return "Nothing happens.";
  if (total === 6) return `Evasion +${D.evasion}% until the next turn.`;
  if (total === 7) return `HP +${D.restorePct}%.`;
  if (total === 8) return `MP +${D.restorePct}%.`;
  if (total === 9) return `TP +${D.tp}.`;
  if (total === 10) return `Accuracy +${D.accuracy}% until the next turn.`;
  if (total === 11) return "The next hit cannot miss.";
  return "The next action is a sure critical hit.";
}

const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

/** One die: tumbling through faces, then landed on `face`. */
function Die({ face, rolling }: { face: number; rolling: boolean }) {
  return (
    <span className={`sp-die${rolling ? " is-rolling" : ""}`} aria-label={rolling ? "a die tumbling" : `a ${face}`}>
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} className={PIPS[face]?.includes(i) ? "is-pip" : undefined} />
      ))}
    </span>
  );
}

/**
 * The Gambler's dice (Josh 2026-11-03: "on their turn you saw two dice roll … and it showed you the
 * number"): every throw in the turn on screen tumbles, lands on its faces, and says what it made.
 */
function DiceTray({ ev, name, speed }: { ev: Event[]; name: (id: number) => string; speed: number }) {
  const throws = ev.filter((e): e is Extract<Event, { t: "lots" | "fizzle" }> => (e.t === "lots" || e.t === "fizzle") && !!e.dice);
  const [rolling, setRolling] = useState(true);
  const [spin, setSpin] = useState(0);
  useEffect(() => {
    if (!throws.length) return;
    const tick = setInterval(() => setSpin((k) => k + 1), 80);
    const land = setTimeout(() => {
      clearInterval(tick);
      setRolling(false);
    }, DICE_ROLL_MS / speed);
    return () => {
      clearInterval(tick);
      clearTimeout(land);
    };
    // A tray is keyed by its turn: it rolls once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!throws.length) return null;
  return (
    <div className="sp-dicetray" role="status">
      {throws.map((e, i) => {
        const made = e.dice![0] + e.dice![1];
        return (
          <div key={i} className={`sp-dicetray__throw${e.t === "fizzle" && !rolling ? " is-fizzle" : ""}`}>
            <small>
              {name(e.unit)} {e.cast ? "casts lots" : e.t === "fizzle" || e.double ? "doubles down" : "rolls for the move"}
            </small>
            <span className="sp-dicetray__dice">
              <Die face={rolling ? ((spin * 5 + i * 3) % 6) + 1 : e.dice![0]} rolling={rolling} />
              <Die face={rolling ? ((spin * 7 + i * 2 + 3) % 6) + 1 : e.dice![1]} rolling={rolling} />
              {rolling ? null : <b>{e.total}</b>}
            </span>
            {rolling ? null : (
              <small className="sp-dicetray__what">
                {e.t === "fizzle" ? "Too low: the move fizzles." : e.cast ? `${made !== e.total ? `Made ${e.total}. ` : ""}${lotsText(e.total)}` : made !== e.total ? `Made ${e.total}.` : null}
              </small>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The pause before a battle: the region, what waits, and an omen chosen by the battle's seed. */
function Intro({ replay, onGo }: { replay: Replay; onGo: () => void }) {
  const pool = replay.pool ? Content.POOL_BY_ID.get(replay.pool) : undefined;
  const omens = pool?.omens ?? [];
  const omen = omens.length ? omens[Math.abs(replay.seed) % omens.length] : undefined;
  const foes = new Map<string, number>();
  for (const u of replay.units) if (u.side === "enemy" && u.partOf === undefined && !u.hazard && !u.boss) foes.set(u.name, (foes.get(u.name) ?? 0) + 1);
  const boss = replay.units.find((u) => u.boss);
  return (
    <section className="sp-intro" aria-label="Before the battle" onClick={onGo}>
      <div className="sp-intro__card">
        {pool ? <small className="sp-intro__where">{pool.name}</small> : null}
        <h2>{boss ? boss.name : replay.title}</h2>
        {omen ? <p className="sp-intro__omen">{omen}</p> : null}
        {replay.why ? <p className="sp-intro__why">{replay.why}</p> : null}
        <p className="sp-intro__foes">{[...foes].map(([n, k]) => (k > 1 ? `${n} ×${k}` : n)).join(" · ")}</p>
        <button type="button" className="sp-button" autoFocus onClick={onGo}>
          To arms
        </button>
      </div>
    </section>
  );
}

/** A battle's ending: victory or defeat, what fell, and how the party stands. */
function Ending({ replay, vit, end, onClose, again, waiting }: { replay: Replay; vit: Map<number, Vitals>; end: Event; onClose: () => void; again: () => void; waiting: number }) {
  if (end.t !== "end") return null;
  const won = end.outcome === "victory";
  const slain = replay.units.filter((u) => u.side === "enemy" && u.partOf === undefined && !u.hazard && (vit.get(u.id)?.[7] ?? 0) & FLAG.dead).length;
  // Each injury with what it does, shown on hover or focus (Josh 2026-11-03).
  const injuries = new Map<number, { id: string; name: string; text: string }[]>();
  for (const f of replay.frames)
    for (const e of f.ev) {
      if (e.t !== "injury") continue;
      const r = Content.INJURY_BY_ID.get(e.result);
      injuries.set(e.target, [...(injuries.get(e.target) ?? []), { id: e.result, name: r?.name ?? words(e.result), text: r?.text ?? "" }]);
    }
  const party = replay.units.filter((u) => u.side === "party" && u.person !== undefined && u.owner === undefined);
  return (
    <section className={`sp-ending ${won ? "is-won" : "is-lost"}`} aria-label={won ? "Victory" : "Defeat"}>
      <div className="sp-ending__card">
        <h2>{won ? "Victory" : end.outcome === "defeat" ? "The party falls" : "The party withdraws"}</h2>
        <p className="sp-ending__sub">{won ? `${slain} ${slain === 1 ? "foe lies" : "foes lie"} dead. The Rift goes quiet, for now.` : "The dark closes over the field."}</p>
        <ul className="sp-ending__party">
          {party.map((u) => {
            const v = vit.get(u.id);
            const flags = v?.[7] ?? 0;
            return (
              <li key={u.id} className={flags & FLAG.dead ? "is-dead" : flags & FLAG.down ? "is-down" : undefined}>
                <strong>{u.name}</strong>
                <small>{flags & FLAG.dead ? "Dead" : flags & FLAG.down ? "Down" : `${v?.[1] ?? 0}/${u.maxHp} HP`}</small>
                {injuries.get(u.id)?.length ? (
                  <em>
                    {injuries.get(u.id)!.map((x, i) => (
                      <span key={`${x.id}${i}`} className="sp-ending__injury" tabIndex={0} data-tip={x.text || undefined} aria-label={x.text ? `${x.name}: ${x.text}` : x.name}>
                        {x.name}
                      </span>
                    ))}
                  </em>
                ) : null}
              </li>
            );
          })}
        </ul>
        <span className="sp-ending__buttons">
          <button type="button" className="sp-button" autoFocus onClick={onClose}>
            {waiting ? `Next battle (${waiting} more)` : "Continue"}
          </button>
          <button type="button" className="sp-button sp-button--quiet" onClick={again}>
            Watch it again
          </button>
        </span>
      </div>
    </section>
  );
}
