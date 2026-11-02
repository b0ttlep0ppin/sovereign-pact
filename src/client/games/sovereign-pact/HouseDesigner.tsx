// Founding a House step by step (SPEC §5.1): name and motto, colors, emblem, Seat and element, the
// traits, then the Ambition to keep. Every step can be edited by hand or rerolled with the dice; each
// change is a `design` move the rules check as a whole, so the House on screen is always a valid one.
import { Content, ELEMENTS, type SovMove, type SovView } from "@vibepulse/shared/games/sovereign-pact";
import { useState } from "react";
import { Emblem } from "./Emblem";

type Props = { view: SovView; sendMove: (m: SovMove) => void };
type House = SovView["houses"][number];
type Step = "name" | "colors" | "emblem" | "seat" | "traits";
type Kind = "major" | "minor" | "major_flaw" | "minor_flaw" | "bloodline";

const STEPS: { id: Step; label: string }[] = [
  { id: "name", label: "Name" },
  { id: "colors", label: "Colors" },
  { id: "emblem", label: "Emblem" },
  { id: "seat", label: "Seat" },
  { id: "traits", label: "Traits" },
];
const KIND_NAMES: Record<Kind, string> = { major: "Major Traits", minor: "Minor Traits", major_flaw: "Major Flaw", minor_flaw: "Minor Flaw", bloodline: "Bloodline" };
const KINDS = Object.keys(KIND_NAMES) as Kind[];
const SHAPES: Record<Kind, number>[] = [
  { major: 2, minor: 2, major_flaw: 1, minor_flaw: 1, bloodline: 0 },
  { major: 1, minor: 2, major_flaw: 0, minor_flaw: 1, bloodline: 1 },
];
const words = (id: string) => id.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const PALETTE = Content.HERALDRY.palette;

/** Whether a set of trait ids has one of the two shapes §5.7 allows. */
export function traitShape(ids: string[]): boolean {
  const count = (k: Kind) => ids.filter((id) => Content.HOUSE_TRAIT_BY_ID.get(id)?.kind === k).length;
  return SHAPES.some((shape) => KINDS.every((k) => count(k) === shape[k]));
}

export default function HouseDesigner({ view, sendMove }: Props) {
  const h = view.houses[view.me!]!;
  const [step, setStep] = useState<Step>("name");
  // The rules check the patch as a whole House (founding.ts cannotDesign); the screen only sends it.
  const design = (patch: Record<string, unknown>) => sendMove({ type: "design", house: patch as Extract<SovMove, { type: "design" }>["house"] });
  return (
    <div className="sp-designer">
      <div className="sp-designer__head">
        <Emblem emblem={h.emblem} colors={h.colors} size={64} />
        <div>
          <strong>House {h.name}</strong>
          <p className="sp-event__status">{h.motto ? `“${h.motto}”` : "No motto yet."}</p>
        </div>
      </div>
      <div className="sp-ready__tabs" role="tablist" aria-label="Founding steps">
        {STEPS.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={x.id === step} className={`sp-button${x.id === step ? "" : " sp-button--quiet"}`} onClick={() => setStep(x.id)}>
            {x.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={STEPS.find((x) => x.id === step)!.label} className="sp-designer__step">
        {step === "name" ? <NameStep key={`${h.name}|${h.motto}`} h={h} design={design} /> : null}
        {step === "colors" ? <ColorsStep h={h} design={design} /> : null}
        {step === "emblem" ? <EmblemStep h={h} design={design} /> : null}
        {step === "seat" ? <SeatStep h={h} design={design} /> : null}
        {step === "traits" ? <TraitsStep key={h.traits.join()} h={h} bane={view.mine?.bane ?? null} crunch={view.display === "crunch"} design={design} /> : null}
        <button type="button" className="sp-button sp-button--quiet" onClick={() => sendMove({ type: "random_house", step })}>
          🎲 Reroll {STEPS.find((x) => x.id === step)!.label.toLowerCase()}
        </button>
      </div>
    </div>
  );
}

type StepProps = { h: House; design: (patch: Record<string, unknown>) => void };

function NameStep({ h, design }: StepProps) {
  const [name, setName] = useState(h.name);
  const [motto, setMotto] = useState(h.motto);
  const ok = name.trim().length >= 2 && name.trim().length <= 24 && motto.length <= 60;
  return (
    <form
      className="sp-offer"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) design({ name: name.trim(), motto });
      }}
    >
      <label>
        House <input value={name} maxLength={24} aria-label="House name" onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        Motto <input value={motto} maxLength={60} aria-label="Motto" onChange={(e) => setMotto(e.target.value)} />
      </label>
      <button type="submit" className="sp-button sp-button--quiet" disabled={!ok || (name.trim() === h.name && motto === h.motto)}>
        Keep this name
      </button>
    </form>
  );
}

function Swatches({ label, value, onPick, not }: { label: string; value: string; onPick: (id: string) => void; not?: string }) {
  return (
    <fieldset className="sp-swatches">
      <legend>{label}</legend>
      {PALETTE.map((c) => (
        <button key={c.id} type="button" title={c.name} aria-label={`${label}: ${c.name}`} aria-pressed={c.id === value} disabled={c.id === not} className="sp-swatch" style={{ background: c.hex }} onClick={() => onPick(c.id)} />
      ))}
    </fieldset>
  );
}

function ColorsStep({ h, design }: StepProps) {
  return (
    <>
      <Swatches label="First color" value={h.colors[0]} not={h.colors[1]} onPick={(c) => design({ colors: [c, h.colors[1]] })} />
      <Swatches label="Second color" value={h.colors[1]} not={h.colors[0]} onPick={(c) => design({ colors: [h.colors[0], c] })} />
    </>
  );
}

function EmblemStep({ h, design }: StepProps) {
  const e = h.emblem;
  const set = (patch: Partial<typeof e>) => design({ emblem: { ...e, ...patch } });
  const pick = (label: string, value: string, options: readonly string[], on: (v: string) => void) => (
    <label>
      {label}{" "}
      <select value={value} onChange={(x) => on(x.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {words(o)}
          </option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="sp-offer">
      {pick("Shield", e.shield, Content.HERALDRY.shields, (v) => set({ shield: v }))}
      {pick("Division", e.division, Content.HERALDRY.divisions, (v) => set({ division: v }))}
      {pick("Charge", e.charge, Content.HERALDRY.charges, (v) => set({ charge: v }))}
      {pick("Second charge", e.secondary ?? "", ["", ...Content.HERALDRY.charges], (v) => {
        const next = { ...e, secondary: v || undefined };
        if (!v) delete next.secondary;
        design({ emblem: next });
      })}
      <Swatches label="Field" value={e.tinctures[0] ?? h.colors[0]} onPick={(c) => set({ tinctures: [c, ...e.tinctures.slice(1)] })} />
      <Swatches label="Second tincture" value={e.tinctures[1] ?? h.colors[1]} onPick={(c) => set({ tinctures: [e.tinctures[0] ?? h.colors[0], c] })} />
    </div>
  );
}

function SeatStep({ h, design }: StepProps) {
  return (
    <>
      <ul className="sp-lots sp-abilities">
        {Content.SEATS.map((seat) => (
          <li key={seat.id} className={seat.id === h.seat ? "is-known" : undefined}>
            <span>
              <strong>{seat.name}</strong>
              <span className="sp-ability__text">{seat.flavor}</span>
            </span>
            <button type="button" className="sp-button sp-button--quiet" disabled={seat.id === h.seat} onClick={() => design({ seat: seat.id })}>
              {seat.id === h.seat ? "Your Seat" : "Choose"}
            </button>
          </li>
        ))}
      </ul>
      <label>
        Element{" "}
        <select value={h.element ?? ""} onChange={(e) => design({ element: e.target.value || null })}>
          <option value="">None</option>
          {ELEMENTS.map((el) => (
            <option key={el} value={el}>
              {words(el)}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

const kindOf = (id: string) => Content.HOUSE_TRAIT_BY_ID.get(id)?.kind as Kind | undefined;
const ONE: Record<Kind, string> = { major: "a Major Trait", minor: "a Minor Trait", major_flaw: "a Major Flaw", minor_flaw: "a Minor Flaw", bloodline: "a Bloodline" };
const MANY: Record<Kind, string> = { major: "Major Traits", minor: "Minor Traits", major_flaw: "Major Flaws", minor_flaw: "Minor Flaws", bloodline: "Bloodlines" };

/** How many of each kind the set may hold: a Bloodline takes the place of one Major Trait and the Major Flaw. */
export const capsOf = (ids: string[]): Record<Kind, number> => (ids.some((id) => kindOf(id) === "bloodline") ? SHAPES[1]! : SHAPES[0]!);

/** Ticking a trait. A kind that holds one swaps it; a Bloodline makes room for itself, and a Major Flaw for itself. */
export function toggleTrait(picked: string[], id: string): string[] {
  if (picked.includes(id)) return picked.filter((x) => x !== id);
  const k = kindOf(id)!;
  let next = picked;
  if (k === "bloodline") {
    next = next.filter((x) => kindOf(x) !== "bloodline" && kindOf(x) !== "major_flaw");
    const majors = next.filter((x) => kindOf(x) === "major");
    next = next.filter((x) => kindOf(x) !== "major" || x === majors[0]);
  } else if (k === "major_flaw") next = next.filter((x) => kindOf(x) !== "bloodline");
  const cap = capsOf([...next, id])[k];
  const have = next.filter((x) => kindOf(x) === k);
  if (have.length >= cap) {
    if (cap !== 1) return picked;
    next = next.filter((x) => x !== have[0]);
  }
  return [...next, id];
}

/** What the set still lacks, in words, or "" when it is whole. */
export function missingOf(ids: string[]): string {
  const caps = capsOf(ids);
  const parts = KINDS.flatMap((k) => {
    const n = caps[k] - ids.filter((id) => kindOf(id) === k).length;
    return n <= 0 ? [] : [n === 1 ? ONE[k] : `${n} ${MANY[k]}`];
  });
  return parts.length ? `Still to choose: ${parts.join(", ")}.` : "";
}

function TraitsStep({ h, bane, crunch, design }: StepProps & { bane: string | null; crunch: boolean }) {
  const [picked, setPicked] = useState<string[]>(h.traits);
  const [hated, setHated] = useState<string>(bane ?? ELEMENTS[0]);
  const needsBane = (ids: string[]) => ids.some((id) => Content.HOUSE_TRAIT_BY_ID.get(id)?.choice === "element");
  const caps = capsOf(picked);
  const blood = caps.bloodline > 0;
  // A whole set is kept at once; a partial one waits on screen while the House keeps its last whole set.
  const pick = (ids: string[], element = hated) => {
    setPicked(ids);
    setHated(element);
    if (traitShape(ids)) design({ traits: ids, ...(needsBane(ids) ? { bane: element } : {}) });
  };
  const missing = missingOf(picked);
  return (
    <div>
      <p className="sp-event__status">
        Take 2 Major Traits, 2 Minor Traits, a Major Flaw and a Minor Flaw. Or take a Bloodline in place of one Major Trait and the Major Flaw.
      </p>
      {KINDS.map((k) => {
        const of = Content.HOUSE_TRAITS.filter((t) => t.kind === k);
        const mine = picked.filter((id) => kindOf(id) === k);
        const cap = caps[k];
        const full = mine.length >= cap;
        return (
          <details key={k} open={mine.length < cap || undefined}>
            <summary>
              {KIND_NAMES[k]} <small>{k === "bloodline" && !blood ? "optional" : cap === 0 ? "your Bloodline stands in for it" : `${mine.length} of ${cap}`}</small>{" "}
              <small className="sp-ability__text">{mine.map((id) => Content.HOUSE_TRAIT_BY_ID.get(id)!.name).join(", ")}</small>
            </summary>
            {k === "bloodline" && !blood ? <p className="sp-event__status">Choosing one gives up your second Major Trait and your Major Flaw.</p> : null}
            {k === "major_flaw" && blood ? <p className="sp-event__status">Your Bloodline stands in for it. Choosing one gives up the Bloodline.</p> : null}
            <ul className="sp-lots sp-abilities">
              {of.map((t) => {
                const on = picked.includes(t.id);
                const locked = !on && full && cap > 1;
                return (
                  <li key={t.id} className={on ? "is-known" : undefined}>
                    <label>
                      <input type={cap === 1 ? "radio" : "checkbox"} name={cap === 1 ? `trait-${k}` : undefined} checked={on} disabled={locked} onChange={() => pick(toggleTrait(picked, t.id))} /> <strong>{t.name}</strong>
                      <span className="sp-ability__text">{crunch ? t.crunch : t.flavor}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
      {needsBane(picked) ? (
        <label>
          The element that hates your House{" "}
          <select value={hated} onChange={(e) => pick(picked, e.target.value)}>
            {ELEMENTS.map((el) => (
              <option key={el} value={el}>
                {words(el)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <p className="sp-event__status" role="status">
        {missing || "A full set: your House keeps these traits."}
      </p>
    </div>
  );
}
