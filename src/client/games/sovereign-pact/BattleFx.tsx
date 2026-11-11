// What a turn looks like when it lands (SPEC §15.5; Josh 2026-11-02: "more oomph to the swings, maybe in
// the dead area in the middle", "tons of animations, color distortions"). Each blow is a strike: the
// attacker winds up and dashes into the gap, a streak crosses it, and the target takes a slash, a shot or
// a spell burst in its element's colors; the struck flash white and shake (a hit-stop), a critical shakes
// the field and reddens its edges, and a spell tints the whole screen for a beat. Several actions in one
// turn land one after another (waves). `strikesOf` is pure; the motion is CSS and the Web Animations API,
// skipped when motion is reduced.
import { Content, statusMeta, type Replay, type ReplayUnit } from "@vibepulse/shared/games/sovereign-pact";
import { NOTE_GLYPHS, songLook } from "./songs";
import { statusLook } from "./statusLook";
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

type Event = Replay["frames"][number]["ev"][number];

/** `boon`: a blessing laid on an ally (a buff, a cure, Sanity restored); `bane`: a curse with no blow. */
export type StrikeKind = "melee" | "shot" | "spell" | "heal" | "mind" | "boon" | "bane";

export interface Strike {
  from: number;
  to: number;
  kind: StrikeKind;
  /** Which action of the turn this is: each lands after the one before. */
  wave: number;
  element?: string;
  crit?: boolean;
  miss?: boolean;
  /** A boon's or bane's status id (drawn in its own glyph and colour); a cure is "cure". */
  status?: string;
  /** A spear's or knife's blow: a straight stab, not a slash. */
  thrust?: boolean;
  /** A magic weapon's blow (an elemental weapon, an edge or an enchantment): the steel's marks in its element's colours. */
  charm?: boolean;
  /** A Minstrel's song reaching a hearer: notes fly to them (songs.ts). */
  song?: string;
  /** A blessing torn away by a Siphon: it is drawn back to the one who struck. */
  siphon?: true;
}

/** Weapons that stab rather than cut. */
const THRUSTS = new Set(["spear", "knife"]);

/** Milliseconds at 1× from the start of its wave to the moment each kind of strike lands. */
export const IMPACT_MS: Record<StrikeKind, number> = { melee: 320, shot: 460, spell: 900, heal: 560, mind: 760, boon: 560, bane: 520 };
/** How long a spell takes to rise out of the ground beside its caster, at 1×, before it seeks its foe. */
const CONJURE_MS = 420;
/** Milliseconds at 1× between one action of a turn and the next. */
export const WAVE_MS = 650;
/** When a strike lands, at 1×, from the start of the turn. */
export const landsAt = (s: Strike): number => s.wave * WAVE_MS + IMPACT_MS[s.kind];

/** The strikes a turn's events make, one per target touched. */
const RANGED = new Set(["bow", "crossbow"]);

export function strikesOf(ev: Event[], units: Map<number, ReplayUnit>): Strike[] {
  const out: Strike[] = [];
  let used: string | undefined;
  let user: number | undefined;
  let wave = -1;
  const begin = (unit: number) => {
    if (user !== unit || out.at(-1)?.wave === wave) wave++;
    user = unit;
  };
  for (const [i, e] of ev.entries()) {
    if (e.t === "use") {
      used = e.ability;
      begin(e.unit);
      const act = Content.ACTIVE_BY_ID.get(e.ability);
      // A song (Josh 2026-11-11): its hearers' statuses come before the "use", so it is drawn here, a strike to each.
      if (act?.song && units.has(e.unit)) {
        const heard: number[] = [];
        for (let j = i - 1; j >= 0 && ev[j]!.t !== "use"; j--) {
          const x = ev[j]!;
          if (x.t === "status" && x.on && x.status.split("@")[0] === act.id && units.has(x.target) && !heard.includes(x.target)) heard.unshift(x.target);
        }
        for (const to of heard) out.push({ from: e.unit, to, kind: act.side === "foe" ? "bane" : "boon", wave, status: act.id, song: act.id });
      }
      // A spell that only frays the mind (Mind Blight) still lands.
      if (act?.sanity) {
        const s = ev.find((x) => x.t === "sanity");
        if (s?.t === "sanity" && units.has(s.target) && units.has(e.unit)) out.push({ from: e.unit, to: s.target, kind: "mind", wave, element: "dark" });
      }
      continue;
    }
    // A Siphon tears a blessing away and draws it back to the one who struck.
    if (e.t === "status" && !e.on && e.by !== undefined && units.has(e.by) && units.has(e.target)) {
      out.push({ from: e.by, to: e.target, kind: "bane", wave, status: e.status.split("@")[0]!, siphon: true });
      continue;
    }
    // Blessings and curses that come with no blow (Josh 2026-11-03: heals and buffs "feel kinda flat").
    if ((e.t === "status" || e.t === "sanity") && user !== undefined && used && units.has(user) && units.has(e.target)) {
      const id = e.t === "status" ? e.status.split("@")[0]! : "";
      const cured = e.t === "status" && !e.on && !!Content.ACTIVE_BY_ID.get(used)?.cure;
      const good = e.t === "sanity" ? e.amount > 0 : e.on ? statusMeta(id).kind === "buff" : cured;
      const bad = e.t === "status" && e.on && statusMeta(id).kind !== "buff";
      if ((good || bad) && !out.some((s) => s.wave === wave && s.to === e.target)) {
        out.push({ from: user, to: e.target, kind: good ? "boon" : "bane", wave, status: e.t === "sanity" ? "sanity" : cured ? "cure" : id });
      }
      continue;
    }
    if (e.t !== "hit" && e.t !== "miss" && e.t !== "heal" && e.t !== "mend") continue;
    // HP or Durability seeping back (a drain, Regen) shows only as its number.
    if ((e.t === "heal" || e.t === "mend") && e.quiet) continue;
    if (!units.has(e.unit) || !units.has(e.target)) continue;
    if (user !== e.unit) {
      used = undefined;
      begin(e.unit);
    }
    if (out.some((s) => s.wave === wave && s.to === e.target && s.kind === "mind")) continue;
    const act = used ? Content.ACTIVE_BY_ID.get(used) : undefined;
    let kind: StrikeKind;
    if (e.t === "heal" || e.t === "mend") kind = "heal";
    else if (act?.kind === "magic" || act?.kind === "support") kind = "spell";
    // A ranged ability, or any blow from a bow or crossbow: an arrow or bolt flies from where they stand.
    else if (act?.reach === "ranged" || RANGED.has(units.get(e.unit)?.weapon ?? "")) kind = "shot";
    // A creature's elemental blow is drawn as a spell; a Scion's weapon keeps its slash, stab or shot.
    else if (e.t === "hit" && e.element && !units.get(e.unit)?.weapon) kind = "spell";
    else kind = "melee";
    // A heal that also blesses (Regen) is drawn once, as the heal.
    if (kind === "heal") for (let k = out.length - 1; k >= 0; k--) if (out[k]!.wave === wave && out[k]!.to === e.target && out[k]!.kind === "boon") out.splice(k, 1);
    const element = (e.t === "hit" ? (e.element ?? e.edge) : undefined) ?? act?.element ?? (e.t === "heal" ? "holy" : undefined);
    const thrust = kind === "melee" && THRUSTS.has(units.get(e.unit)?.weapon ?? "");
    const charm = (kind === "melee" || kind === "shot") && !!element && !!units.get(e.unit)?.weapon;
    out.push({ from: e.unit, to: e.target, kind, wave, ...(element ? { element } : {}), ...(e.t === "hit" && e.crit ? { crit: true } : {}), ...(e.t === "miss" ? { miss: true } : {}), ...(thrust ? { thrust: true } : {}), ...(charm ? { charm: true } : {}) });
  }
  return out;
}

/** The colors a strike is drawn in: its core and its glow. */
export const FX_COLORS: Record<string, [string, string]> = {
  fire: ["#ffd27a", "#ff5a1a"],
  water: ["#d8f4ff", "#3a9ee8"],
  wind: ["#eafff4", "#5fd8a0"],
  earth: ["#e8c98a", "#8a5a22"],
  holy: ["#fff8d8", "#f0c850"],
  dark: ["#e0c8ff", "#5a1a9a"],
  none: ["#ffffff", "#c8b8a0"],
};

/** What a blessing or curse is drawn in: its status's colour and glyph (a cure is pale, Sanity a calm blue). */
export function boonLook(s: Pick<Strike, "kind" | "status"> & { song?: string; siphon?: true }): { color: string; glyph: string } {
  if (s.song) return { color: songLook(s.song).color, glyph: "♪" };
  if (s.kind === "heal") return { color: "#8fe89a", glyph: "✚" };
  if (s.status === "cure") return { color: "#dff4ff", glyph: "✧" };
  if (s.status === "sanity") return { color: "#9ab8ff", glyph: "◉" };
  const l = statusLook(s.status ?? "");
  return { color: l.color, glyph: l.glyph };
}

/** Strikes that bless or curse rather than strike: no lunge, no blow. */
const kindly = (k: StrikeKind) => k === "heal" || k === "boon" || k === "bane";

interface Pt {
  x: number;
  y: number;
}

const motionOff = (root: HTMLElement | null) =>
  !root || root.closest("[data-motion='reduced']") !== null || (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);

/** Animate an element if this browser can; jsdom and old browsers cannot. */
function animate(el: Element | null | undefined, frames: Keyframe[], opts: KeyframeAnimationOptions) {
  if (el && typeof (el as HTMLElement).animate === "function") (el as HTMLElement).animate(frames, opts);
}

/** The first strike of each wave. */
const leads = <T extends { wave: number }>(xs: T[]): T[] => xs.filter((x, i) => xs.findIndex((y) => y.wave === x.wave) === i);

/** The layer over the two planes that draws a turn's strikes. `turn` changes once per turn shown. */
export default function BattleFx({ planes, strikes, turn, speed }: { planes: RefObject<HTMLDivElement | null>; strikes: Strike[]; turn: number; speed: number }) {
  const [drawn, setDrawn] = useState<{ turn: number; at: { from: Pt; to: Pt; s: Strike }[] } | null>(null);
  // Each turn is acted out once: in a live fight a new turn arriving rebuilds the strikes of the turn on
  // screen, and acting them again made Scions lurch at their foe with no sound (Josh's playtest).
  const played = useRef(-1);
  useEffect(() => {
    if (played.current === turn) return;
    const root = planes.current;
    // Nothing to draw: the render shows nothing, since what was drawn belongs to another turn.
    if (!root || !strikes.length || motionOff(root)) return;
    // Measured on the next frame, once the turn's positions are laid out.
    const raf = requestAnimationFrame(() => {
      played.current = turn;
      const box = root.getBoundingClientRect();
      const node = (id: number) => root.querySelector<HTMLElement>(`[data-unit="${id}"]`);
      const centre = (id: number): Pt | null => {
        const el = node(id);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2 - box.left, y: r.top + r.height * 0.45 - box.top };
      };
      const at: { from: Pt; to: Pt; s: Strike }[] = [];
      for (const s of strikes) {
        const from = centre(s.from);
        const to = centre(s.to);
        if (from && to) at.push({ from, to, s });
      }
      setDrawn({ turn, at });
      const k = 1 / speed;
      // Each wave's attacker: a wind-up away from the foe, then a dash toward it (melee deep into the gap).
      for (const { s, from, to } of leads(at.map((x) => ({ ...x, wave: x.s.wave })))) {
        if (kindly(s.kind)) {
          // The caster gathers it: rises a little, lit in its colour, and settles as it lands.
          const c = boonLook(s).color;
          animate(node(s.from), [
            { translate: "0 0", filter: "none" },
            { translate: "0 -7px", filter: `brightness(1.5) drop-shadow(0 0 10px ${c})`, offset: 0.5 },
            { translate: "0 -7px", filter: `brightness(1.3) drop-shadow(0 0 6px ${c})`, offset: 0.8 },
            { translate: "0 0", filter: "none" },
          ], { duration: IMPACT_MS[s.kind] * 1.3 * k, delay: s.wave * WAVE_MS * k, easing: "ease-in-out" });
          continue;
        }
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        if (s.kind === "spell" || s.kind === "mind") {
          // The caster is wreathed in the spell's colour while it rises beside them, then thrusts it on.
          const g = FX_COLORS[s.element ?? "none"]![1];
          animate(node(s.from), [
            { translate: "0 0", filter: "none" },
            { translate: "0 -4px", filter: `brightness(1.4) saturate(1.6) drop-shadow(0 0 10px ${g}) drop-shadow(0 0 3px ${g})`, offset: 0.3 },
            { translate: "0 -4px", filter: `brightness(1.7) saturate(1.8) drop-shadow(0 0 16px ${g}) drop-shadow(0 0 4px ${g})`, offset: 0.55 },
            { translate: `${dx * 0.05}px 0`, filter: `brightness(1.3) drop-shadow(0 0 8px ${g})`, offset: 0.7 },
            { translate: "0 0", filter: "none" },
          ], { duration: IMPACT_MS[s.kind] * k, delay: s.wave * WAVE_MS * k, easing: "ease-in-out" });
          continue;
        }
        const reach = s.kind === "melee" ? (s.thrust ? 0.5 : 0.42) : 0.08;
        animate(node(s.from), [
          { translate: "0 0", offset: 0 },
          { translate: `${-dx * 0.06}px ${-dy * 0.06 - 4}px`, offset: 0.35, easing: "ease-in" },
          { translate: `${dx * reach}px ${dy * reach}px`, offset: 0.55, easing: "cubic-bezier(.2,.9,.3,1)" },
          { translate: `${dx * reach}px ${dy * reach}px`, offset: 0.7 },
          { translate: "0 0", offset: 1 },
        ], { duration: (IMPACT_MS[s.kind] / 0.55) * k, delay: s.wave * WAVE_MS * k, easing: "linear" });
      }
      // Each target: frozen white at the blow (the hit-stop), then knocked back and shaken.
      for (const { s, from, to } of at) {
        const delay = landsAt(s) * k;
        if (s.miss) {
          animate(node(s.to), [{ translate: "0 0" }, { translate: `${Math.sign(to.x - from.x) * 14}px -6px` }, { translate: "0 0" }], { duration: 360 * k, delay, easing: "ease-out" });
          continue;
        }
        if (s.kind === "heal" || s.kind === "boon") {
          // Lifted and lit: a heal raises them a step, a blessing swells them for a beat.
          const c = boonLook(s).color;
          animate(node(s.to), [
            { translate: "0 0", scale: "1", filter: "brightness(1)" },
            { translate: "0 -8px", scale: s.kind === "boon" ? "1.08" : "1.03", filter: `brightness(2) drop-shadow(0 0 12px ${c})`, offset: 0.25 },
            { translate: "0 -5px", scale: "1.02", filter: `brightness(1.5) drop-shadow(0 0 8px ${c})`, offset: 0.6 },
            { translate: "0 0", scale: "1", filter: "brightness(1)" },
          ], { duration: 900 * k, delay, easing: "ease-out" });
          continue;
        }
        if (s.kind === "bane") {
          // Wrung by it: dimmed, drained of colour, a shudder.
          const c = boonLook(s).color;
          animate(node(s.to), [
            { translate: "0 0", filter: "none" },
            { translate: "-4px 2px", filter: `brightness(0.5) saturate(0.3) drop-shadow(0 0 10px ${c})`, offset: 0.2 },
            { translate: "4px 2px", filter: `brightness(0.6) saturate(0.4) drop-shadow(0 0 8px ${c})`, offset: 0.4 },
            { translate: "-2px 0", filter: `brightness(0.8) drop-shadow(0 0 6px ${c})`, offset: 0.65 },
            { translate: "0 0", filter: "none" },
          ], { duration: 760 * k, delay, easing: "ease-out" });
          continue;
        }
        const push = Math.sign(to.x - from.x || 1) * (s.crit ? 14 : 8);
        const glow = FX_COLORS[s.element ?? "none"]![1];
        animate(node(s.to), [
          { translate: "0 0", filter: "none", offset: 0 },
          { translate: "0 0", filter: `brightness(5) saturate(0) drop-shadow(0 0 8px ${glow})`, offset: 0.04 },
          { translate: "0 0", filter: `brightness(5) saturate(0) drop-shadow(0 0 8px ${glow})`, offset: 0.2 },
          { translate: `${push}px 0`, filter: `brightness(2.2) drop-shadow(4px 0 0 rgba(255,40,40,.8)) drop-shadow(-4px 0 0 rgba(40,220,255,.8))`, offset: 0.35 },
          { translate: `${-push * 0.6}px 0`, filter: "brightness(1.3)", offset: 0.5 },
          { translate: `${push * 0.3}px 0`, offset: 0.7 },
          { translate: "0 0", filter: "none", offset: 1 },
        ], { duration: (s.crit ? 600 : 480) * k, delay, easing: "ease-out" });
      }
      // A critical, or a spell, shakes the whole field.
      for (const s of leads(strikes.filter((x) => (x.crit || x.kind === "spell") && !x.miss))) {
        const m = s.crit ? 8 : s.element === "earth" ? 7 : 4;
        animate(root, [
          { translate: "0 0" },
          { translate: `${m}px ${-m / 2}px` },
          { translate: `${-m}px ${m / 2}px` },
          { translate: `${m * 0.6}px ${m / 3}px` },
          { translate: `${-m * 0.3}px 0` },
          { translate: "0 0" },
        ], { duration: 340 * k, delay: landsAt(s) * k, easing: "linear" });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [planes, strikes, turn, speed]);

  if (!drawn || drawn.turn !== turn || !drawn.at.length) return null;
  const ms = (n: number) => `${Math.round(n / speed)}ms`;
  return (
    <div className="sp-fx" aria-hidden="true" key={turn}>
      {drawn.at.map(({ from, to, s }, i) => (
        <StrikeFx key={i} i={i} lead={drawn.at.findIndex((x) => x.s.wave === s.wave) === i} from={from} to={to} s={s} ms={ms} />
      ))}
    </div>
  );
}

/**
 * The whole screen's moment as a blow lands: a spell's element washes over it (fire scorches, water
 * chills, dark inverts, holy blinds) and a critical reddens its edges.
 */
export function ScreenFx({ strikes, turn, speed }: { strikes: Strike[]; turn: number; speed: number }) {
  const ms = (n: number) => `${Math.round(n / speed)}ms`;
  const spells = leads(strikes.filter((s) => (s.kind === "spell" || s.kind === "mind") && !s.miss));
  const crits = leads(strikes.filter((s) => s.crit));
  const boons = leads(strikes.filter((s) => s.kind === "heal" || s.kind === "boon"));
  if (!spells.length && !crits.length && !boons.length) return null;
  return (
    <div className="sp-screenfx" aria-hidden="true" key={turn}>
      {spells.map((s) => (
        <span key={`s${s.wave}`} className={`sp-screenfx__tint sp-screenfx__tint--${s.element ?? "none"}`} style={{ animationDelay: ms(landsAt(s) - 40), animationDuration: ms(560) }} />
      ))}
      {boons.map((s) => (
        <span key={`b${s.wave}`} className={`sp-screenfx__tint sp-screenfx__tint--${s.kind === "heal" ? "heal" : "boon"}`} style={{ animationDelay: ms(landsAt(s) - 80), animationDuration: ms(900), ["--c" as string]: boonLook(s).color }} />
      ))}
      {crits.map((s) => (
        <span key={`c${s.wave}`} className="sp-screenfx__crit" style={{ animationDelay: ms(landsAt(s)), animationDuration: ms(520) }} />
      ))}
    </div>
  );
}

/** One strike's marks: the streak or projectile across the gap, then what it does on arrival. */
function StrikeFx({ from, to, s, i, lead, ms }: { from: Pt; to: Pt; s: Strike; i: number; lead: boolean; ms: (n: number) => string }) {
  const [core, glow] = FX_COLORS[s.element ?? "none"]!;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const start = s.wave * WAVE_MS;
  const impact = landsAt(s);
  const kind = kindly(s.kind) ? boonLook(s) : null;
  const vars = (kind ? { ["--core" as string]: "#fffbe8", ["--glow" as string]: kind.color, ["--c" as string]: kind.color } : { ["--core" as string]: core, ["--glow" as string]: glow }) as CSSProperties;
  const at = (p: Pt, extra: CSSProperties = {}): CSSProperties => ({ ...vars, left: p.x, top: p.y, ...extra });
  const sparks = s.miss ? 0 : s.kind === "spell" ? 18 : s.kind === "heal" ? 18 : s.kind === "boon" ? 14 : s.kind === "bane" ? 10 : s.crit ? 16 : 11;
  if (s.song) return <SongFx from={from} to={to} s={s} lead={lead} vars={vars} ms={ms} />;
  if (s.siphon) return <SiphonFx from={from} to={to} s={s} vars={vars} ms={ms} />;
  if (kind) return <BoonFx from={from} to={to} s={s} glyph={kind.glyph} sparks={sparks} vars={vars} ms={ms} />;
  return (
    <>
      {s.charm ? (
        // A magic weapon (Josh 2026-11-10: "special sfx and animation coloring for magical weapons"): its element wreathes the wielder as they strike.
        <span className={`sp-fx__aura sp-fx__aura--${s.element} is-charm`} style={at(from, { animationDelay: ms(start), animationDuration: ms(impact - start + 120) })} />
      ) : null}
      {s.kind === "melee" && !s.thrust ? (
        // The rush: speed lines from the attacker through the gap to the foe.
        <span className="sp-fx__streak" style={at(from, { width: len, rotate: `${angle}deg`, animationDelay: ms(impact - 150), animationDuration: ms(300) })} />
      ) : s.kind === "shot" ? (
        <span className="sp-fx__bolt" style={at(from, { rotate: `${angle}deg`, ["--dx" as string]: `${dx}px`, ["--dy" as string]: `${dy}px`, animationDelay: ms(impact - 240), animationDuration: ms(240) })} />
      ) : s.kind === "spell" || s.kind === "mind" ? (
        <>
          {/* Conjured (Josh 2026-11-03: "comes up out of the ground as they are wreathed in red magic, then turns and seeks out the foe"):
              a circle on the ground, the caster's aura, and the bolt rising beside them before it flies. */}
          <span className="sp-fx__channel" style={at(from, { ["--c" as string]: glow, animationDelay: ms(start), animationDuration: ms(CONJURE_MS + 300) })} />
          <span className={`sp-fx__aura sp-fx__aura--${s.element ?? "none"}`} style={at(from, { animationDelay: ms(start), animationDuration: ms(impact - start) })} />
          {Array.from({ length: 8 }, (_, j) => (
            <span key={`u${j}`} className="sp-fx__updraft" style={at(from, { ["--x" as string]: `${((j * 23) % 50) - 25}px`, animationDelay: ms(start + j * 45), animationDuration: ms(CONJURE_MS) })} />
          ))}
          {/* The bolt and a tail of afterimages, so its flight reads as one smooth streak (Josh: "frame loss shooting the fireball for Ember"). */}
          {[3, 2, 1, 0].map((j) => (
            <span
              key={j}
              className={`sp-fx__orb sp-fx__orb--${s.element ?? "none"}${j ? " is-ghost" : ""}`}
              style={at(from, {
                ["--dx" as string]: `${dx}px`,
                ["--dy" as string]: `${dy}px`,
                ["--side" as string]: `${Math.sign(dx || 1) * 26}px`,
                ["--ghost" as string]: 1 - j * 0.22,
                animationDelay: ms(start + 60 + j * 26),
                animationDuration: ms(impact - start - 60),
              })}
            />
          ))}
        </>
      ) : null}
      {s.miss || s.kind === "heal" ? null : <span className={`sp-fx__flash${s.crit ? " is-crit" : ""}`} style={at(to, { animationDelay: ms(impact), animationDuration: ms(260) })} />}
      {s.thrust ? (
        // A stab (Josh 2026-11-03: "a line poking forward and impacting"): a shaft of light drives through them and a point of light bursts where it goes in.
        <>
          <span className="sp-fx__aim" style={at(to, { rotate: `${angle}deg` })}>
            <span className={`sp-fx__thrust${s.crit ? " is-crit" : ""}${s.charm ? " is-charm" : ""}`} style={{ animationDelay: ms(impact - 90), animationDuration: ms(s.crit ? 380 : 300) }} />
            {s.miss ? null : <span className={`sp-fx__pierce${s.crit ? " is-crit" : ""}`} style={{ animationDelay: ms(impact), animationDuration: ms(340) }} />}
          </span>
        </>
      ) : null}
      {s.charm && s.kind === "melee" && !s.miss ? <span className={`sp-fx__burst sp-fx__burst--${s.element} is-charm`} style={at(to, { animationDelay: ms(impact + 40), animationDuration: ms(480) })} /> : null}
      {s.miss || s.thrust ? null : s.kind === "melee" ? (
        <svg className={`sp-fx__slash${s.crit ? " is-crit" : ""}${s.charm ? " is-charm" : ""}`} style={at(to, { rotate: `${((i * 47) % 70) - 35 + (dx < 0 ? 180 : 0)}deg`, animationDelay: ms(impact), animationDuration: ms(s.crit ? 420 : 340) })} viewBox="-50 -50 100 100">
          <path d="M-46 22 Q -4 -60 46 -16 Q 0 -38 -46 22 Z" />
          <path d="M-40 18 Q -2 -48 40 -14 Q 0 -32 -40 18 Z" />
        </svg>
      ) : s.kind === "heal" ? (
        <span className="sp-fx__halo" style={at(to, { animationDelay: ms(impact), animationDuration: ms(700) })} />
      ) : (
        <span className={`sp-fx__burst sp-fx__burst--${s.element ?? "none"}${s.crit ? " is-crit" : ""}`} style={at(to, { animationDelay: ms(impact), animationDuration: ms(s.kind === "shot" ? 300 : 560) })} />
      )}
      {Array.from({ length: sparks }, (_, j) => (
        <span
          key={j}
          className={`sp-fx__spark sp-fx__spark--${s.kind === "heal" ? "heal" : (s.kind === "melee" || s.kind === "shot") && !(s.charm && j % 2) ? "steel" : (s.element ?? "none")}`}
          style={at(to, {
            // A stab sprays forward, out the far side; everything else bursts all round.
            ["--a" as string]: s.thrust ? `${angle + ((j * 53) % 70) - 35}deg` : `${(j * 360) / sparks + ((i * 37) % 30)}deg`,
            ["--d" as string]: `${(s.kind === "spell" ? 70 : 48) + ((j * 13) % 30)}px`,
            animationDelay: ms(impact + ((j * 17) % 50)),
            animationDuration: ms(s.kind === "heal" ? 800 : 520),
          })}
        />
      ))}
    </>
  );
}

/**
 * A heal, a blessing or a curse (Josh 2026-11-03: heals and buffs "feel kinda flat"): a circle of light
 * under the caster, motes that arc across to the target (none on oneself), then at the target a shaft of
 * light, a ring that climbs them, the status's own glyph rising, and motes drifting up. A curse runs the
 * other way: its ring closes in, its glyph sinks and its motes fall.
 */
function BoonFx({ from, to, s, glyph, sparks, vars, ms }: { from: Pt; to: Pt; s: Strike; glyph: string; sparks: number; vars: CSSProperties; ms: (n: number) => string }) {
  const start = s.wave * WAVE_MS;
  const impact = landsAt(s);
  const at = (p: Pt, extra: CSSProperties = {}): CSSProperties => ({ ...vars, left: p.x, top: p.y, ...extra });
  const bane = s.kind === "bane";
  const travel = s.from !== s.to;
  const spiral = s.status === "cure" || s.status === "sanity";
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return (
    <>
      <span className="sp-fx__channel" style={at(from, { animationDelay: ms(start), animationDuration: ms(impact - start + 200) })} />
      {travel
        ? [0, 1, 2].map((j) => (
            <span key={`w${j}`} className="sp-fx__wisp" style={at(from, { ["--dx" as string]: `${dx}px`, ["--dy" as string]: `${dy}px`, ["--lift" as string]: `${-40 - j * 14}px`, animationDelay: ms(impact - 320 + j * 40), animationDuration: ms(320) })} />
          ))
        : null}
      {bane ? null : <span className="sp-fx__pillar" style={at(to, { animationDelay: ms(impact - 60), animationDuration: ms(820) })} />}
      <span className={`sp-fx__rune${bane ? " is-bane" : ""}`} style={at(to, { animationDelay: ms(impact), animationDuration: ms(bane ? 640 : 900) })} />
      {s.kind === "heal" ? <span className="sp-fx__halo" style={at(to, { animationDelay: ms(impact), animationDuration: ms(900) })} /> : null}
      <span className={`sp-fx__glyph${bane ? " is-bane" : ""}`} style={at(to, { animationDelay: ms(impact + 60), animationDuration: ms(1000) })}>
        {glyph}
      </span>
      {spiral
        ? // A cure (Josh 2026-11-03): white, blue and green motes wrap round them and spiral up.
          Array.from({ length: 24 }, (_, j) => (
            <span
              key={`h${j}`}
              className={`sp-fx__helix sp-fx__helix--${j % 3}`}
              style={at(to, { ["--r" as string]: `${(j % 2 ? -1 : 1) * (22 + ((j * 7) % 12))}px`, animationDelay: ms(impact - 60 + j * 40), animationDuration: ms(1100) })}
            />
          ))
        : null}
      {Array.from({ length: spiral ? 0 : sparks }, (_, j) => (
        <span
          key={j}
          className={`sp-fx__spark sp-fx__spark--${bane ? "bane" : "boon"}`}
          style={at(to, {
            ["--a" as string]: `${(j * 360) / sparks}deg`,
            ["--d" as string]: `${18 + ((j * 13) % 22)}px`,
            animationDelay: ms(impact + ((j * 37) % 260)),
            animationDuration: ms(bane ? 620 : 1000),
          })}
        />
      ))}
    </>
  );
}

/**
 * A song reaching one hearer (Josh 2026-11-11: "musical notes" hitting those a song reaches): notes rise
 * from the Minstrel as they play, a few fly to the hearer, and land rising round an ally or settling on a foe.
 */
function SongFx({ from, to, s, lead, vars, ms }: { from: Pt; to: Pt; s: Strike; lead: boolean; vars: CSSProperties; ms: (n: number) => string }) {
  const start = s.wave * WAVE_MS;
  const impact = landsAt(s);
  const at = (p: Pt, extra: CSSProperties = {}): CSSProperties => ({ ...vars, left: p.x, top: p.y, ...extra });
  const bane = s.kind === "bane";
  const travel = s.from !== s.to;
  const glyph = (j: number) => NOTE_GLYPHS[(j + s.to) % NOTE_GLYPHS.length];
  return (
    <>
      {lead
        ? [0, 1, 2, 3].map((j) => (
            <span key={`p${j}`} className="sp-fx__note is-rise" style={at(from, { ["--sx" as string]: `${(j % 2 ? 1 : -1) * (10 + j * 6)}px`, ["--rot" as string]: `${(j % 2 ? 1 : -1) * 18}deg`, animationDelay: ms(start + j * 110), animationDuration: ms(900) })}>
              {glyph(j)}
            </span>
          ))
        : null}
      {travel
        ? [0, 1, 2].map((j) => (
            <span key={`t${j}`} className="sp-fx__note is-fly" style={at(from, { ["--dx" as string]: `${to.x - from.x}px`, ["--dy" as string]: `${to.y - from.y}px`, ["--lift" as string]: `${-36 - j * 16}px`, animationDelay: ms(impact - 440 + j * 70), animationDuration: ms(440) })}>
              {glyph(j + 1)}
            </span>
          ))
        : null}
      <span className={`sp-fx__rune${bane ? " is-bane" : ""}`} style={at(to, { animationDelay: ms(impact), animationDuration: ms(bane ? 640 : 900) })} />
      {[0, 1, 2].map((j) => (
        <span key={`l${j}`} className={`sp-fx__note ${bane ? "is-settle" : "is-rise"}`} style={at(to, { ["--sx" as string]: `${(j - 1) * 22}px`, ["--rot" as string]: `${(j - 1) * 14}deg`, animationDelay: ms(impact + j * 90), animationDuration: ms(bane ? 760 : 1000) })}>
          {glyph(j + 2)}
        </span>
      ))}
    </>
  );
}

const SIPHON_COLOR = "#9a4ae0";

/** A Siphon (Josh 2026-11-11): the torn-away blessing's sign is wrenched off the foe and drawn back to the one who struck. */
function SiphonFx({ from, to, s, vars, ms }: { from: Pt; to: Pt; s: Strike; vars: CSSProperties; ms: (n: number) => string }) {
  const impact = landsAt(s);
  const at = (p: Pt, extra: CSSProperties = {}): CSSProperties => ({ ...vars, left: p.x, top: p.y, ...extra });
  const back = { ["--dx" as string]: `${from.x - to.x}px`, ["--dy" as string]: `${from.y - to.y}px` };
  // The pull itself is drawn in a thief's violet; only the stolen sign keeps its blessing's colour.
  const violet = { ["--c" as string]: SIPHON_COLOR };
  return (
    <>
      <span className="sp-fx__rune is-bane" style={at(to, { ...violet, animationDelay: ms(impact - 80), animationDuration: ms(640) })} />
      <span className="sp-fx__siphon-glyph" style={at(to, { ...back, animationDelay: ms(impact), animationDuration: ms(760) })}>
        {statusLook(s.status ?? "").glyph}
      </span>
      {[0, 1, 2, 3, 4, 5].map((j) => (
        <span key={j} className="sp-fx__wisp is-siphon" style={at(to, { ...back, ...violet, ["--lift" as string]: `${(j % 2 ? 1 : -1) * (14 + j * 5)}px`, animationDelay: ms(impact + 120 + j * 55), animationDuration: ms(420) })} />
      ))}
      <span className="sp-fx__halo is-siphon" style={at(from, { animationDelay: ms(impact + 520), animationDuration: ms(600) })} />
    </>
  );
}
