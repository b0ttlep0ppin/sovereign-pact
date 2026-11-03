// The little pictures in the logs (Josh 2026-11-03: "symbology in the what's happened and combat logs,
// using sprite face icons and house sigils, or spear or sword icon for damage type or fire icon for fire
// damage or poison icon when someone gets poisoned"). A battle line leads with who acts (their face, and
// a Scion's House arms) and ends with what kind of blow it was or the status it laid; a Chronicle line
// leads with the arms of the House it is about and the face of the Scion it names.
import type { Replay, ReplayUnit, SovView } from "@vibepulse/shared/games/sovereign-pact";
import type { ReactNode } from "react";
import { Emblem } from "./Emblem";
import ScionSprite, { lookOf } from "./ScionSprite";
import { abilityKind, blowOf } from "./sfx";
import { spriteOf } from "./sprites";
import { statusLook } from "./statusLook";

type BattleEvent = Replay["frames"][number]["ev"][number];
const statusText = (s: string) => s.split("@")[0]!.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** The head in a 64 px frame: x, y, width, height. */
const HEAD: [number, number, number, number] = [18, 13, 28, 28];
const FACE = 18;

/** 16×16 marks for each kind of harm: a fill path, or `stroke` for line art. */
const MARKS: Record<string, { d: string; color: string; label: string; stroke?: true }> = {
  blade: { d: "M13.5 1 15 2.5 7 10.5 5.5 9zM3.5 8.5l4 4-1 1-1.2-1.2L3 14.6 1.4 13l2.3-2.3-1.2-1.2z", color: "#cfc6b0", label: "a blade" },
  axe: { d: "M2.6 14.6 1.4 13.4l8-8 1.2 1.2zM8.6 2.4c3.6-.6 5.6 1.4 5 5l-1.8.8-4-4z", color: "#cfc6b0", label: "an axe" },
  blunt: { d: "M2.6 14.6 1.4 13.4 7.2 7.6l1.2 1.2zM11 1.8a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4z", color: "#bfb39a", label: "a blunt blow" },
  stab: { d: "M2.2 14.4 1.6 13.8l9.2-9.2.6.6zM15 1l-1.4 5.2-3.8-3.8z", color: "#cfc6b0", label: "a thrust" },
  fist: { d: "M4 6h7.5A2 2 0 0 1 13.5 8v3a3.5 3.5 0 0 1-3.5 3.5H6.5A2.5 2.5 0 0 1 4 12zM4 5.5V3h2.2v2.5zM7 5.5V2.2h2.2v3.3zM10 5.5V3h2.2v2.5z", color: "#d8b890", label: "a fist" },
  arrow: { d: "M2.2 14.6 1.4 13.8 11 4.2l.8.8zM15 1l-1.2 4.6-3.4-3.4zM1 10.6l1.6 1.6L1 13.8zM3.8 15l1.6-1.6L4 12z", color: "#cfc6b0", label: "an arrow" },
  bite: { d: "M1.5 3h5.5L4.2 12.5zM9 3h5.5l-2.8 9.5z", color: "#e8e0d0", label: "teeth" },
  claw: { d: "M2.5 1.5h2l6 12.5h-2zM6.5 1.5h2l5.5 11h-2zM.8 5h2l4.2 9.5H5z", color: "#d0a0a0", label: "claws" },
  heavy: { d: "M8 1l1.5 4.5L14 4l-2.5 4 3.5 2.5-4.5.5L11 15 8 11.5 5 15l.5-4L1 10.5 4.5 8 2 4l4.5 1.5z", color: "#c0a880", label: "a crushing blow" },
  fire: { d: "M8 1c1 3 5 5 5 9a5 5 0 0 1-10 0c0-2 1-3.2 2-4 0 2 1 3 2 3-1-3 0-6 1-8z", color: "#ff8a2a", label: "fire" },
  water: { d: "M8 1c2 4 5 6 5 9a5 5 0 0 1-10 0c0-3 3-5 5-9z", color: "#6aa8ff", label: "water" },
  earth: { d: "M1 14 6 5l3 4 2-3 4 8z", color: "#b08a50", label: "earth" },
  wind: { d: "M1 5.5h9a2.2 2.2 0 1 0-2.2-2.2M1 9h12a2.2 2.2 0 1 1-2.2 2.2M2.5 12.5h4.5", color: "#9fd8b0", label: "wind", stroke: true },
  holy: { d: "M7 1h2v5h5v2H9v7H7V8H2V6h5z", color: "#f0d880", label: "holy light" },
  dark: { d: "M10.5 1a7 7 0 1 0 4.5 11.5A6 6 0 0 1 10.5 1z", color: "#a070d0", label: "darkness" },
  arcane: { d: "M8 1l1.8 5.2L15 8l-5.2 1.8L8 15l-1.8-5.2L1 8l5.2-1.8z", color: "#c9a0ff", label: "sorcery" },
  heal: { d: "M6.5 2h3v4.5H14v3H9.5V14h-3V9.5H2v-3h4.5z", color: "#7fe08a", label: "healing" },
  blood: { d: "M8 1c2 4 5 6 5 9a5 5 0 0 1-10 0c0-3 3-5 5-9z", color: "#c0302a", label: "an injury" },
  mind: { d: "M8 2a6 6 0 1 1 0 12A6 6 0 0 1 8 2zM8 5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z", color: "#b07ae0", label: "the mind" },
};

/** The landing sound of a plain blow names its kind. */
const BY_BLOW: Record<string, string> = {
  hit_blade: "blade", hit_axe: "axe", hit_blunt: "blunt", hit_stab: "stab", hit_punch: "fist", hit_arrow: "arrow", hit_bolt: "arrow",
  hit_bite: "bite", hit_maul: "bite", hit_claw: "claw", hit_heavy: "heavy",
};

export function Mark({ kind, title }: { kind: string; title?: string }) {
  const m = MARKS[kind];
  if (!m) return null;
  return (
    <span className="sp-mark" title={title ?? m.label}>
      <svg viewBox="0 0 16 16" width={14} height={14} role="img" aria-label={title ?? m.label} style={{ color: m.color }}>
        <path d={m.d} {...(m.stroke ? { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const } : { fill: "currentColor" })} />
      </svg>
    </span>
  );
}

/** What kind of harm a hit did: its element, sorcery, or the kind of blow the striker deals. */
export function harmOf(e: Extract<BattleEvent, { t: "hit" }>, ability: string | undefined, by: ReplayUnit | undefined): string {
  if (e.element) return e.element;
  const ab = ability ? abilityKind(ability) : {};
  if (ab.element) return ab.element;
  if (ab.kind === "magic") return "arcane";
  return BY_BLOW[blowOf(by)[1]] ?? "blade";
}

/** A Scion's head, or a creature's sprite, at log size. */
export function Face({ unit, view }: { unit: ReplayUnit; view: SovView }) {
  const who = unit.person !== undefined ? view.people.find((p) => p.id === unit.person) : undefined;
  if (who)
    return (
      <span className="sp-face" title={unit.name}>
        <ScionSprite look={lookOf(who, view.houses[who.house]?.colors, view.items)} crop={HEAD} size={(FACE * 64) / HEAD[2]} />
      </span>
    );
  const sprite = spriteOf(unit);
  return (
    <span className="sp-face sp-face--creature" title={unit.name}>
      {sprite ? <img src={sprite.url} alt="" draggable={false} className={sprite.flip ? "is-flipped" : undefined} /> : <i aria-hidden="true">{unit.hazard ? "⚠" : unit.name[0]}</i>}
    </span>
  );
}

function Sigil({ view, house }: { view: SovView; house: number | undefined }) {
  const h = house === undefined ? undefined : view.houses[house];
  return h ? (
    <span className="sp-sigil" title={`House ${h.name}`}>
      <Emblem emblem={h.emblem} colors={h.colors} size={14} />
    </span>
  ) : null;
}

/** Who a line is about first: the one acting, else the one it happens to. */
const leadOf = (e: BattleEvent): number | undefined => ("unit" in e ? e.unit : "target" in e ? e.target : undefined);

/** One line of the battle log with its pictures. `ability` is what this turn used, if anything. */
export function BattleLine({ e, text, replay, view, ability }: { e: BattleEvent; text: string; replay: Replay; view: SovView; ability?: string }) {
  const unit = (id: number | undefined) => (id === undefined ? undefined : replay.units.find((u) => u.id === id));
  const lead = unit(leadOf(e));
  let tail: ReactNode = null;
  if (e.t === "hit") tail = <Mark kind={harmOf(e, ability, lead)} />;
  else if (e.t === "heal") tail = <Mark kind="heal" />;
  else if (e.t === "injury") tail = <Mark kind="blood" />;
  else if (e.t === "sanity" && e.amount < 0) tail = <Mark kind="mind" />;
  else if (e.t === "status" && e.on) {
    const l = statusLook(e.status);
    tail = (
      <i className="sp-mark sp-mark--status" style={{ color: l.color }} title={statusText(e.status)} aria-label={statusText(e.status)}>
        {l.glyph}
      </i>
    );
  } else if (e.t === "dead") tail = <i className="sp-mark sp-mark--status" style={{ color: "#a89a8a" }} aria-hidden="true">✝</i>;
  return (
    <>
      {lead ? <Face unit={lead} view={view} /> : null}
      {lead?.house !== undefined ? <Sigil view={view} house={lead.house} /> : null}
      <span className="sp-logline__text">{text}</span>
      {tail}
    </>
  );
}

/** A Chronicle line: the arms of the first House it names, the face of the first Scion. */
export function ChronicleLine({ line, view }: { line: string; view: SovView }) {
  const named = (name: string) => name.length > 2 && line.includes(name);
  const house = view.houses.findIndex((h) => named(`House ${h.name}`) || named(`${h.name}s`));
  const who = view.people.find((p) => named(p.name));
  return (
    <>
      {house >= 0 ? <Sigil view={view} house={house} /> : null}
      {who ? (
        <span className="sp-face" title={who.name}>
          <ScionSprite look={lookOf(who, view.houses[who.house]?.colors, view.items)} crop={HEAD} size={(FACE * 64) / HEAD[2]} />
        </span>
      ) : null}
      <span className="sp-logline__text">{line}</span>
    </>
  );
}
