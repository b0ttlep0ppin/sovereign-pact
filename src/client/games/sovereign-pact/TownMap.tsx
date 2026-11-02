// The Town Map (SPEC §15.6), first prototype: the settlement seen from above, the Commons in the middle,
// each House's Seat around it with its buildings at their levels, the Rift Gate tearing open at the top
// edge and the walls along the bottom. The viewer's people stand as chits by what they do this Year:
// drag one onto a building, the Gate or the walls (or pick it, then pick the place) to assign it.
// Tiles are drawn in CSS until the Oryx tiles are cut (HANDOFF §8.5).
import type { SovMove, SovView } from "@vibepulse/shared/games/sovereign-pact";
import { Content } from "@vibepulse/shared/games/sovereign-pact";
import { useState, type DragEvent } from "react";
import { Emblem, HERALDRY_COLORS } from "./Emblem";
import "./TownMap.css";

type Person = SovView["people"][number];
type Assignment = NonNullable<SovView["mine"]>["assign"][number];

/** A place a chit can be dropped. */
export type Place = { kind: "rest" } | { kind: "guard" } | { kind: "sortie" } | { kind: "building"; id: string };

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
const GLYPHS: Record<string, string> = {
  training_ground: "⚔",
  scriptorium: "✎",
  infirmary: "✚",
  chapel: "✝",
  forge: "⚒",
  workshop: "⚙",
  hall_of_petitions: "⚖",
  vault: "◈",
  shrine: "☉",
  crypt: "⚰",
  farm: "❦",
  lumber_camp: "♣",
  quarry: "▲",
  mine: "⛏",
  kennels: "❀",
  watchtower: "♜",
};

/** The move that puts `p` at `place`, or null if it takes no one. */
export function moveFor(view: SovView, p: Person, place: Place): SovMove | null {
  if (place.kind === "rest") return { type: "assign", person: p.id, to: "rest" };
  if (place.kind === "guard") return { type: "assign", person: p.id, to: "guard" };
  if (place.kind === "sortie") {
    // The House's Sortie this Year if it has one, else the first on offer.
    const current = Object.values(view.mine?.assign ?? {}).find((a) => a.to === "sortie")?.at;
    return { type: "assign", person: p.id, to: "sortie", at: current ?? Content.SORTIES[0]!.id };
  }
  const task = BUILDING_TASK[place.id];
  if (!task) return null;
  if (task === "work") return { type: "assign", person: p.id, to: "work", at: place.id };
  if (task === "train") return { type: "assign", person: p.id, to: p.status === "retired" ? "teach" : "train" };
  return { type: "assign", person: p.id, to: task };
}

/** Where a person's chit stands, from their assignment. */
export function placeOf(a: Assignment | undefined): Place {
  if (!a || a.to === "rest") return { kind: "rest" };
  if (a.to === "guard") return { kind: "guard" };
  if (a.to === "sortie") return { kind: "sortie" };
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
  const mine = view.people.filter((p) => p.host === view.me && p.status !== "lost");
  const assign = view.mine?.assign ?? {};
  const at = (place: Place) => mine.filter((p) => samePlace(placeOf(assign[p.id]), place));

  const send = (p: Person | undefined, place: Place) => {
    const m = p ? moveFor(view, p, place) : null;
    if (m) sendMove(m);
    setPicked(null);
  };
  const target = (key: string, place: Place, mineHere: boolean) => {
    const live = canAssign && mineHere;
    return {
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
        className={`sp-chit${picked === p.id ? " is-picked" : ""}${p.status === "recruit" ? " is-recruit" : ""}`}
        style={{ background: HERALDRY_COLORS.get(view.houses[p.house]!.colors[0]) }}
        draggable={canAssign}
        disabled={!canAssign}
        aria-pressed={picked === p.id}
        title={`${p.name}${p.job ? `, ${p.job.replace(/_/g, " ")}` : ""} (level ${p.level})`}
        onDragStart={(e) => e.dataTransfer.setData("text/plain", String(p.id))}
        onClick={(e) => {
          e.stopPropagation();
          setPicked(picked === p.id ? null : p.id);
        }}
      >
        {p.name.split(" ")[0]!.slice(0, 2)}
      </button>
    ));

  return (
    <div className="sp-map" style={{ background: sky(view.year, view.years) }} aria-label="The Town Map">
      <div className="sp-map__cracks" aria-hidden="true">
        {Array.from({ length: Math.floor(view.doom / 15) }, (_, i) => (
          <span key={i} style={{ left: `${(i * 37) % 100}%`, opacity: 0.3 + view.doom / 200 }} />
        ))}
      </div>
      <div className="sp-map__ground">
        <section {...target("gate", { kind: "sortie" }, true)} className="sp-map__gate" aria-label="The Rift Gate">
          <span className="sp-map__gate-tear" aria-hidden="true" />
          <strong>The Rift Gate</strong>
          <small>{canAssign ? "Sorties" : view.gate?.cards.length ? `${view.gate.cards.length} cards` : ""}</small>
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
              <div {...target(`keep${h.index}`, { kind: "rest" }, own)} className="sp-map__keep">
                <span className="sp-bld__glyph" aria-hidden="true">⌂</span>
                <span className="sp-bld__name">{h.seat.replace(/_/g, " ")}</span>
                {own ? <div className="sp-chits">{chits({ kind: "rest" })}</div> : null}
              </div>
              <div className="sp-map__blds">
                {Content.BUILDINGS.filter((b) => (h.buildings[b.id] ?? 0) > 0).map((b) => {
                  const place: Place = { kind: "building", id: b.id };
                  const takes = own && BUILDING_TASK[b.id] !== undefined;
                  return (
                    <div key={b.id} {...target(`${h.index}:${b.id}`, place, takes)} className="sp-bld" title={`${b.name}, level ${h.buildings[b.id]}`}>
                      <span className="sp-bld__glyph" aria-hidden="true">{GLYPHS[b.id] ?? "▣"}</span>
                      <span className="sp-bld__name">{b.name}</span>
                      <Pips level={h.buildings[b.id] ?? 0} />
                      {own ? <div className="sp-chits">{chits(place)}</div> : null}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}

        <section {...target("walls", { kind: "guard" }, true)} className="sp-map__walls" aria-label="The walls">
          <strong>The walls</strong>
          <div className="sp-chits">{chits({ kind: "guard" })}</div>
        </section>
      </div>
      {canAssign ? <p className="sp-map__hint">{picked === null ? "Drag a chit to a building, the Gate or the walls, or pick one and then its place." : "Now pick where they go."}</p> : null}
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
