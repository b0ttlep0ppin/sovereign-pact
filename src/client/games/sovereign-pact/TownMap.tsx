// The Town Map (SPEC §15.6), first prototype: the settlement seen from above, the Commons in the middle,
// each House's Seat around it with its buildings at their levels, the Rift Gate tearing open at the top
// edge and the walls along the bottom. The viewer's people stand as chits by what they do this Year:
// drag one onto a building, the Gate or the walls (or pick it, then pick the place) to assign it.
// Tiles are drawn in CSS until the Oryx tiles are cut (HANDOFF §8.5).
import { BUILDING_ICONS, JOB_ICONS, SEAT_ART } from "./icons";
import { BONE, PixelArt } from "./PixelArt";
import ScionSprite, { lookOf } from "./ScionSprite";
import { DECO_NAMES, layoutFor } from "./seatLayouts";

/** The head in a 64 px portrait frame: x, y, width, height. */
const HEAD: [number, number, number, number] = [18, 13, 28, 28];
import type { SovMove, SovView } from "@vibepulse/shared/games/sovereign-pact";
import { Content } from "@vibepulse/shared/games/sovereign-pact";
import { useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { Emblem, HERALDRY_COLORS, inkOf } from "./Emblem";
import RiftCrown, { crownFill } from "./RiftCrown";
import "./TownMap.css";

type Person = SovView["people"][number];
type Assignment = NonNullable<SovView["mine"]>["assign"][number];

/** A place a chit can be dropped. */
export type Place = { kind: "idle" } | { kind: "rest" } | { kind: "guard" } | { kind: "sortie" } | { kind: "oversee" } | { kind: "building"; id: string };

/** What a Year at each place does (§8.3), shown on hover. */
const PLACE_TEXT: Record<string, string> = {
  idle: "Not assigned: they idle this Year and recover only 10% Sanity. Drag each one to a place.",
  rest: "Rest: recover 25% Sanity; injuries heal at the usual pace. Room for everyone.",
  guard: "Guard the walls: each guard turns aside a quarter of the harm an Omen aims at your House (lost stores, gold and Sanity; a building ruined or a recruit lost may be saved). 2 places.",
  oversee: "Oversee works: each Scion here lets your House start one more building or upgrade this Year, on top of the one your masons manage. Up to 3. They stay until the Year's works stand.",
  sortie: "Sortie through the Rift Gate: up to 4 Scions not on the expedition fight 1–2 battles on their own (by their gambits) as the expedition comes home, a level easier than the Year's. XP and JP for each battle won, more for every foe slain and growing with the Years; JP if they come through; finds for your House. Injuries no worse than Moderate.",
  chapel: "Chapel: Sanity fully restored and mental ailments cured. 2, 4 or 6 places by its level.",
  infirmary: "Infirmary: one injury heals a Year sooner, and disease is cured. 1, 2 or 4 places by its level.",
  scriptorium: "Study: JP in their current Job without a Mentor (slower than training).",
  training_ground: "Train or teach: a Scion trains for JP and XP under a Mentor (XP up to the Mentor's level − 1); a Retired Scion here teaches.",
  work: "Work: adds 4 to this building's output this Year.",
};
const placeText = (place: Place): string =>
  place.kind === "building" ? (PLACE_TEXT[place.id] ?? (BUILDING_TASK[place.id] === "work" ? PLACE_TEXT.work! : "")) : PLACE_TEXT[place.kind]!;

/** What each House building does with a person dropped on it; buildings with no assignment are not targets. */
const BUILDING_TASK: Record<string, "chapel" | "infirmary" | "study" | "train" | "work"> = {
  chapel: "chapel",
  infirmary: "infirmary",
  scriptorium: "study",
  training_ground: "train",
  farm: "work",
  lumber_camp: "work",
  quarry: "work",
  mine: "work",
};

/** Short marks for buildings and projects until their tiles exist. */
/** The move that puts `p` at `place`, or null if it takes no one. */
export function moveFor(view: SovView, p: Person, place: Place, sortie?: string): SovMove | null {
  if (place.kind === "idle") return { type: "assign", person: p.id, to: "idle" };
  if (place.kind === "rest") return { type: "assign", person: p.id, to: "rest" };
  if (place.kind === "guard") return { type: "assign", person: p.id, to: "guard" };
  if (place.kind === "oversee") return { type: "assign", person: p.id, to: "oversee" };
  if (place.kind === "sortie") {
    // The Sortie chosen at the Gate, else the House's this Year, else the first on offer.
    return { type: "assign", person: p.id, to: "sortie", at: sortie ?? sortieOf(view) };
  }
  const task = BUILDING_TASK[place.id];
  if (!task) return null;
  if (task === "work") return { type: "assign", person: p.id, to: "work", at: place.id };
  if (task === "train") return { type: "assign", person: p.id, to: p.status === "retired" ? "teach" : "train" };
  return { type: "assign", person: p.id, to: task };
}

/** The House's Sortie this Year if it has one, else the first on offer. */
const sortieOf = (view: SovView): string => Object.values(view.mine?.assign ?? {}).find((a) => a.to === "sortie")?.at ?? Content.SORTIES[0]!.id;

/** Where a person's chit stands, from their assignment. */
export function placeOf(a: Assignment | undefined): Place {
  // Unassigned people idle (§8.3), apart from those resting: they wait in their own tray.
  if (!a) return { kind: "idle" };
  if (a.to === "rest") return { kind: "rest" };
  if (a.to === "guard") return { kind: "guard" };
  if (a.to === "sortie") return { kind: "sortie" };
  if (a.to === "oversee") return { kind: "oversee" };
  if (a.to === "work") return { kind: "building", id: a.at ?? "" };
  if (a.to === "study") return { kind: "building", id: "scriptorium" };
  if (a.to === "train" || a.to === "teach") return { kind: "building", id: "training_ground" };
  return { kind: "building", id: a.to };
}

const samePlace = (a: Place, b: Place) => a.kind === b.kind && (a.kind !== "building" || (b.kind === "building" && a.id === b.id));

/** The sky over the town: dusk in the first Year, the red of the last, cracked by Doom (§15.6). */
function sky(year: number, years: number): string {
  const t = years > 1 ? (year - 1) / (years - 1) : 0;
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  return `linear-gradient(180deg, rgb(${mix(34, 92)} ${mix(30, 18)} ${mix(64, 24)}), rgb(${mix(70, 140)} ${mix(48, 32)} ${mix(82, 30)}))`;
}

interface Props {
  view: SovView;
  sendMove: (m: SovMove) => void;
  /** Whether the viewer may assign now (Settlement Phase, the Year not sealed). */
  canAssign: boolean;
}

export default function TownMap({ view, sendMove, canAssign }: Props) {
  const [picked, setPicked] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  // Recruits work on their own and are set from their cards (DECISIONS 8ae); the map is for Scions and the Retired.
  const mine = view.people.filter((p) => p.host === view.me && p.status !== "lost" && p.status !== "recruit");
  const assign = view.mine?.assign ?? {};
  const at = (place: Place) => mine.filter((p) => samePlace(placeOf(assign[p.id]), place));

  // The Sortie the Gate is set to (Josh: "its still not clear what sorties at the rift gate or walls do").
  const [sortie, setSortie] = useState<string | null>(null);
  const going = at({ kind: "sortie" });
  const chosen = Content.SORTIE_BY_ID.get(going.length ? sortieOf(view) : (sortie ?? sortieOf(view)))!;
  const choose = (id: string) => {
    setSortie(id);
    // One Sortie a House: moving one of those going moves them all.
    if (going.length) sendMove({ type: "assign", person: going[0]!.id, to: "sortie", at: id });
  };
  const send = (p: Person | undefined, place: Place) => {
    const m = p ? moveFor(view, p, place, chosen.id) : null;
    if (m) sendMove(m);
    setPicked(null);
  };
  const target = (key: string, place: Place, mineHere: boolean) => {
    const live = canAssign && mineHere;
    return {
      title: placeText(place) || undefined,
      "data-target": live ? "yes" : undefined,
      "data-over": over === key && live ? "yes" : undefined,
      onDragOver: live ? (e: DragEvent) => (e.preventDefault(), setOver(key)) : undefined,
      onDragLeave: live ? () => setOver(null) : undefined,
      onDrop: live
        ? (e: DragEvent) => {
            e.preventDefault();
            setOver(null);
            send(mine.find((p) => String(p.id) === e.dataTransfer.getData("text/plain")), place);
          }
        : undefined,
      onClick: live && picked !== null ? () => send(mine.find((p) => p.id === picked), place) : undefined,
    };
  };
  const chits = (place: Place) =>
    at(place).map((p) => (
      <button
        key={p.id}
        type="button"
        className={`sp-chit${picked === p.id ? " is-picked" : ""}`}
        style={{ borderColor: HERALDRY_COLORS.get(view.houses[p.house]!.colors[0]) }}
        draggable={canAssign}
        disabled={!canAssign}
        aria-pressed={picked === p.id}
        title={p.status === "retired" ? `${p.name}, retired` : `${p.name}, level ${p.level} ${(p.job ?? "").replace(/_/g, " ")}`}
        onDragStart={(e) => e.dataTransfer.setData("text/plain", String(p.id))}
        onClick={(e) => {
          e.stopPropagation();
          setPicked(picked === p.id ? null : p.id);
        }}
      >
        <ScionSprite look={lookOf(p, view.houses[p.house]?.colors, view.items)} crop={HEAD} size={(32 * 64) / HEAD[2]} />
        <PixelArt className="sp-chit__job" rows={JOB_ICONS[p.job ?? "recruit"]} size={13} />
        <span className="sp-chit__tag">{p.name.split(" ")[0]}</span>
      </button>
    ));

  return (
    <div className="sp-map" style={{ background: sky(view.year, view.years) }} aria-label="The Town Map">
      <div className="sp-map__cracks" aria-hidden="true">
        {Array.from({ length: Math.floor(view.doom / 15) }, (_, i) => (
          <span key={i} style={{ left: `${(i * 37) % 100}%`, opacity: 0.3 + view.doom / 200 }} />
        ))}
      </div>
      {canAssign && at({ kind: "idle" }).length ? (
        <section {...target("idle", { kind: "idle" }, true)} className="sp-map__idle" aria-label="Not yet assigned">
          <strong>Not yet assigned</strong>
          <small>They idle this Year (Sanity +10% only) unless you give them a place.</small>
          <div className="sp-chits">{chits({ kind: "idle" })}</div>
        </section>
      ) : null}
      <div className="sp-map__ground">
        <section {...target("gate", { kind: "sortie" }, true)} className="sp-map__gate" aria-label="The Rift Gate">
          <RiftCrown className="sp-map__gate-tear" fill={crownFill(view.year, view.years)} />
          <strong>The Rift Gate</strong>
          {canAssign ? (
            <div className="sp-map__about" onClick={(e) => e.stopPropagation()}>
              <small>Send up to 4 Scions not on the expedition on a Sortie. They fight 1–2 battles on their own, by their gambits, as the expedition comes home.</small>
              <label className="sp-map__sortie">
                <span>Sortie</span>
                <select value={chosen.id} onChange={(e) => choose(e.target.value)}>
                  {Content.SORTIES.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </select>
              </label>
              <small className="sp-map__sortie-text">
                {chosen.text} {chosen.battles === 1 ? "One battle" : `${chosen.battles} battles`} in {Content.POOL_BY_ID.get(chosen.pool)?.name ?? chosen.pool}, a level easier than the Year's: {chosen.xp} XP and more for each won, {chosen.jp} JP if they come through
                {chosen.rolls ? ", finds for your House" : ""}
                {chosen.gold ? `, ${chosen.gold} Gold` : ""}. Injuries no worse than Moderate.
              </small>
            </div>
          ) : (
            <small>{view.gate?.cards.length ? `${view.gate.cards.length} cards` : ""}</small>
          )}
          <div className="sp-chits">{chits({ kind: "sortie" })}</div>
        </section>

        <section className="sp-map__commons" aria-label="The Commons">
          <strong>The Commons</strong>
          <span className="sp-map__purse">
            {view.commons.gold} Gold · {view.commons.stores.grain ?? 0} Grain
          </span>
          {view.crisis ? (
            <span className="sp-map__marker" title="This Year's Crisis: what it needs from the Houses">
              ! Crisis: {Object.entries(view.crisis.need).map(([k, n]) => `${n} ${k}`).join(", ")}
            </span>
          ) : null}
          <div className="sp-map__lots">
            {Content.PROJECTS.filter((x) => (view.commons.built[x.id] ?? 0) > 0).map((x) => (
              <span key={x.id} className="sp-bld sp-bld--commons" title={`${x.name}, level ${view.commons.built[x.id]}`}>
                <span className="sp-bld__name">{x.name}</span>
                <Pips level={view.commons.built[x.id] ?? 0} />
              </span>
            ))}
            {Object.keys(view.commons.funds).map((id) => (
              <span key={id} className="sp-bld sp-bld--rising" title="Being paid for">
                <span className="sp-bld__name">{Content.PROJECT_BY_ID.get(id)?.name ?? id}</span>
                <small>rising</small>
              </span>
            ))}
          </div>
        </section>

        {view.houses.map((h) => {
          const own = h.index === view.me;
          const color = HERALDRY_COLORS.get(h.colors[0]);
          return (
            <section key={h.index} className={`sp-map__seat sp-map__seat--${h.index}${h.fallen ? " is-fallen" : ""}`} style={{ borderColor: color }} aria-label={`House ${h.name}'s Seat`}>
              <header>
                <span className="sp-map__banner" style={{ background: color }} aria-hidden="true" />
                <Emblem emblem={h.emblem} colors={h.colors} size={28} />
                <strong>House {h.name}</strong>
              </header>
              <District
                seat={h.seat}
                built={Content.BUILDINGS.filter((b) => (h.buildings[b.id] ?? 0) > 0)}
                hall={(style) => (
                  <div {...target(`keep${h.index}`, { kind: "rest" }, own)} className="sp-map__keep" style={style}>
                    <PixelArt className="sp-map__seat-art" rows={SEAT_ART[h.seat] ?? SEAT_ART.keep} size={56} color={inkOf(h.colors) ?? BONE} />
                    <span className="sp-bld__name">{Content.SEATS.find((x) => x.id === h.seat)?.name ?? h.seat.replace(/_/g, " ")}</span>
                    {own ? <div className="sp-chits">{chits({ kind: "rest" })}</div> : null}
                  </div>
                )}
                plot={(b, style) => {
                  const place: Place = { kind: "building", id: b.id };
                  const takes = own && BUILDING_TASK[b.id] !== undefined;
                  return (
                    <div key={b.id} {...target(`${h.index}:${b.id}`, place, takes)} className="sp-bld" style={style} title={`${b.name}, level ${h.buildings[b.id]}`}>
                      <PixelArt className="sp-bld__icon" rows={BUILDING_ICONS[b.id]} size={22} />
                      <span className="sp-bld__name">{b.name}</span>
                      <Pips level={h.buildings[b.id] ?? 0} />
                      {own ? <div className="sp-chits">{chits(place)}</div> : null}
                    </div>
                  );
                }}
              />
              {own ? (
                <div {...target(`yard${h.index}`, { kind: "oversee" }, true)} className="sp-map__yard">
                  <strong>Masons' yard</strong>
                  {canAssign ? <small>Each Scion here oversees one more build this Year (up to 3).</small> : null}
                  <div className="sp-chits">{chits({ kind: "oversee" })}</div>
                </div>
              ) : null}
            </section>
          );
        })}

        <section {...target("walls", { kind: "guard" }, true)} className="sp-map__walls" aria-label="The walls">
          <strong>The walls</strong>
          {canAssign ? <small className="sp-map__about">Up to 2 guards. Each turns aside a quarter of the harm an Omen aims at your House: lost stores, gold and Sanity, and a building ruined or a recruit lost may be saved.</small> : null}
          <div className="sp-chits">{chits({ kind: "guard" })}</div>
        </section>
      </div>
      {canAssign ? <p className="sp-map__hint">{picked === null ? "Drag a chit to a building, the Gate or the walls, or pick one and then its place." : "Now pick where they go."}</p> : null}
    </div>
  );
}

type Building = (typeof Content.BUILDINGS)[number];

/** A Seat's district (DECISIONS 8ai): its hall, its buildings on their plots, empty plots, and scenery. */
function District({ seat, built, hall, plot }: { seat: string; built: Building[]; hall: (style: CSSProperties) => ReactNode; plot: (b: Building, style: CSSProperties) => ReactNode }) {
  const L = layoutFor(seat, built.length);
  const at = ([c, r]: [number, number]): CSSProperties => ({ gridColumn: c, gridRow: r });
  return (
    <div className={`sp-map__district sp-map__district--${seat}`} style={{ gridTemplateColumns: `repeat(${L.cols}, minmax(0, 1fr))` }}>
      {L.deco.map((d) => (
        <span key={d.at.join()} className={`sp-deco sp-deco--${DECO_NAMES[d.kind]}`} style={at(d.at)} aria-hidden="true" />
      ))}
      {hall({ gridColumn: `${L.hall[0]} / span ${L.hall[2]}`, gridRow: `${L.hall[1]} / span ${L.hall[3]}` })}
      {L.plots.map((cell, i) => (built[i] ? plot(built[i]!, at(cell)) : <span key={cell.join()} className="sp-plot" style={at(cell)} title="An empty plot" aria-hidden="true" />))}
    </div>
  );
}

function Pips({ level }: { level: number }) {
  return (
    <span className="sp-pips" aria-label={`level ${level}`}>
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= level ? "is-on" : undefined} />
      ))}
    </span>
  );
}
