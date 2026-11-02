// What a turn looks like when it lands (SPEC §15.5; Josh 2026-11-02: "more oomph to the swings, maybe in
// the dead area in the middle", "tons of animations, color distortions"). Each blow is a strike: the
// attacker winds up and dashes into the gap, a streak crosses it, and the target takes a slash, a shot or
// a spell burst in its element's colors; the struck flash white and shake (a hit-stop), a critical shakes
// the field and reddens its edges, and a spell tints the whole screen for a beat. Several actions in one
// turn land one after another (waves). `strikesOf` is pure; the motion is CSS and the Web Animations API,
// skipped when motion is reduced.
import { Content, type Replay, type ReplayUnit } from "@vibepulse/shared/games/sovereign-pact";
import { useEffect, useState, type CSSProperties, type RefObject } from "react";

type Event = Replay["frames"][number]["ev"][number];

export type StrikeKind = "melee" | "shot" | "spell" | "heal" | "mind";

export interface Strike {
  from: number;
  to: number;
  kind: StrikeKind;
  /** Which action of the turn this is: each lands after the one before. */
  wave: number;
  element?: string;
  crit?: boolean;
  miss?: boolean;
}

/** Milliseconds at 1× from the start of its wave to the moment each kind of strike lands. */
export const IMPACT_MS: Record<StrikeKind, number> = { melee: 320, shot: 460, spell: 560, heal: 420, mind: 520 };
/** Milliseconds at 1× between one action of a turn and the next. */
export const WAVE_MS = 650;
/** When a strike lands, at 1×, from the start of the turn. */
export const landsAt = (s: Strike): number => s.wave * WAVE_MS + IMPACT_MS[s.kind];

/** The strikes a turn's events make, one per target touched. */
export function strikesOf(ev: Event[], units: Map<number, ReplayUnit>): Strike[] {
  const out: Strike[] = [];
  let used: string | undefined;
  let user: number | undefined;
  let wave = -1;
  const begin = (unit: number) => {
    if (user !== unit || out.at(-1)?.wave === wave) wave++;
    user = unit;
  };
  for (const e of ev) {
    if (e.t === "use") {
      used = e.ability;
      begin(e.unit);
      const act = Content.ACTIVE_BY_ID.get(e.ability);
      // A spell that only frays the mind (Mind Blight) still lands.
      if (act?.sanity) {
        const s = ev.find((x) => x.t === "sanity");
        if (s?.t === "sanity" && units.has(s.target) && units.has(e.unit)) out.push({ from: e.unit, to: s.target, kind: "mind", wave, element: "dark" });
      }
      continue;
    }
    if (e.t !== "hit" && e.t !== "miss" && e.t !== "heal") continue;
    if (!units.has(e.unit) || !units.has(e.target)) continue;
    if (user !== e.unit) {
      used = undefined;
      begin(e.unit);
    }
    if (out.some((s) => s.wave === wave && s.to === e.target && s.kind === "mind")) continue;
    const act = used ? Content.ACTIVE_BY_ID.get(used) : undefined;
    let kind: StrikeKind;
    if (e.t === "heal") kind = "heal";
    else if (act?.kind === "magic" || act?.kind === "support") kind = "spell";
    else if (act?.reach === "ranged") kind = "shot";
    else if (e.t === "hit" && e.element) kind = "spell";
    else kind = "melee";
    const element = (e.t === "hit" ? e.element : undefined) ?? act?.element ?? (e.t === "heal" ? "holy" : undefined);
    out.push({ from: e.unit, to: e.target, kind, wave, ...(element ? { element } : {}), ...(e.t === "hit" && e.crit ? { crit: true } : {}), ...(e.t === "miss" ? { miss: true } : {}) });
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
  useEffect(() => {
    const root = planes.current;
    // Nothing to draw: the render shows nothing, since what was drawn belongs to another turn.
    if (!root || !strikes.length || motionOff(root)) return;
    // Measured on the next frame, once the turn's positions are laid out.
    const raf = requestAnimationFrame(() => {
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
        if (s.kind === "heal") continue;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const reach = s.kind === "melee" ? 0.42 : 0.08;
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
        if (s.kind === "heal") {
          animate(node(s.to), [{ filter: "brightness(1)" }, { filter: "brightness(1.8) drop-shadow(0 0 8px #9fe8a0)" }, { filter: "brightness(1)" }], { duration: 600 * k, delay });
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
        <StrikeFx key={i} i={i} from={from} to={to} s={s} ms={ms} />
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
  if (!spells.length && !crits.length) return null;
  return (
    <div className="sp-screenfx" aria-hidden="true" key={turn}>
      {spells.map((s) => (
        <span key={`s${s.wave}`} className={`sp-screenfx__tint sp-screenfx__tint--${s.element ?? "none"}`} style={{ animationDelay: ms(landsAt(s) - 40), animationDuration: ms(560) }} />
      ))}
      {crits.map((s) => (
        <span key={`c${s.wave}`} className="sp-screenfx__crit" style={{ animationDelay: ms(landsAt(s)), animationDuration: ms(520) }} />
      ))}
    </div>
  );
}

/** One strike's marks: the streak or projectile across the gap, then what it does on arrival. */
function StrikeFx({ from, to, s, i, ms }: { from: Pt; to: Pt; s: Strike; i: number; ms: (n: number) => string }) {
  const [core, glow] = FX_COLORS[s.element ?? "none"]!;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const start = s.wave * WAVE_MS;
  const impact = landsAt(s);
  const vars = { ["--core" as string]: core, ["--glow" as string]: glow } as CSSProperties;
  const at = (p: Pt, extra: CSSProperties = {}): CSSProperties => ({ ...vars, left: p.x, top: p.y, ...extra });
  const sparks = s.miss ? 0 : s.kind === "spell" ? 18 : s.kind === "heal" ? 10 : s.crit ? 16 : 11;
  return (
    <>
      {s.kind === "melee" ? (
        // The rush: speed lines from the attacker through the gap to the foe.
        <span className="sp-fx__streak" style={at(from, { width: len, rotate: `${angle}deg`, animationDelay: ms(impact - 150), animationDuration: ms(300) })} />
      ) : s.kind === "shot" ? (
        <span className="sp-fx__bolt" style={at(from, { rotate: `${angle}deg`, ["--dx" as string]: `${dx}px`, ["--dy" as string]: `${dy}px`, animationDelay: ms(impact - 240), animationDuration: ms(240) })} />
      ) : s.kind === "spell" || s.kind === "mind" ? (
        <>
          <span className="sp-fx__sigil" style={at(from, { animationDelay: ms(start), animationDuration: ms(impact - start - 200) })} />
          <span className={`sp-fx__orb sp-fx__orb--${s.element ?? "none"}`} style={at(from, { ["--dx" as string]: `${dx}px`, ["--dy" as string]: `${dy}px`, animationDelay: ms(impact - 280), animationDuration: ms(280) })} />
        </>
      ) : null}
      {s.miss || s.kind === "heal" ? null : <span className={`sp-fx__flash${s.crit ? " is-crit" : ""}`} style={at(to, { animationDelay: ms(impact), animationDuration: ms(260) })} />}
      {s.miss ? null : s.kind === "melee" ? (
        <svg className={`sp-fx__slash${s.crit ? " is-crit" : ""}`} style={at(to, { rotate: `${((i * 47) % 70) - 35 + (dx < 0 ? 180 : 0)}deg`, animationDelay: ms(impact), animationDuration: ms(s.crit ? 420 : 340) })} viewBox="-50 -50 100 100">
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
          className={`sp-fx__spark sp-fx__spark--${s.kind === "heal" ? "heal" : s.kind === "melee" || s.kind === "shot" ? "steel" : (s.element ?? "none")}`}
          style={at(to, {
            ["--a" as string]: `${(j * 360) / sparks + ((i * 37) % 30)}deg`,
            ["--d" as string]: `${(s.kind === "spell" ? 70 : 48) + ((j * 13) % 30)}px`,
            animationDelay: ms(impact + ((j * 17) % 50)),
            animationDuration: ms(s.kind === "heal" ? 800 : 520),
          })}
        />
      ))}
    </>
  );
}
