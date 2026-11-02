// The House's own people (SPEC §6): Scions, the Retired, recruits and the Lost, each as a card with
// what the House knows of them. In the Settlement Phase, the moves that change who they are: promote a
// recruit into a base Job, retire a Scion or bring one back, mend an injury with a cure from the stash,
// and spend a Tarot Token or a Passive Draught.
import { Content, itemName, type SovMove, type SovView } from "@vibepulse/shared/games/sovereign-pact";
import { useState } from "react";
import { HERALDRY_COLORS } from "./Emblem";

type Props = { view: SovView; sendMove: (m: SovMove) => void; canAct: boolean };
type Person = SovView["people"][number];
type JobId = NonNullable<Person["job"]>;

const STATS = ["Might", "Resilience", "Guile", "Acuity", "Sagacity", "Speed"];
const GROUPS: { status: Person["status"]; title: string }[] = [
  { status: "scion", title: "Scions" },
  { status: "retired", title: "Retired" },
  { status: "recruit", title: "Recruits" },
  { status: "lost", title: "Lost" },
];
const BASE = Content.JOBS.filter((j) => !j.advanced);
const words = (id: string) => id.replace(/_/g, " ");
/** A House's color for text on the dark ground: its primary, or its secondary when the primary is too dark to read. */
export function inkOf(colors: readonly string[] | undefined): string | undefined {
  if (!colors) return undefined;
  const hexes = colors.map((c) => HERALDRY_COLORS.get(c)).filter((h): h is string => !!h);
  const light = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  };
  return hexes.find((h) => light(h) >= 90) ?? (hexes.length ? "var(--text)" : undefined);
}
const TAROT_BY_ID = new Map(Content.TAROT.map((t) => [t.id, t]));

/** One trait or the Tarot card: its name, then what it does (Crunch) or how it reads (Flavor). */
function TraitLine({ kind, name, text }: { kind?: string; name: string; text?: string }) {
  return (
    <li className={kind ? "is-tarot" : undefined}>
      {kind ? <span className="sp-person__kind">{kind}</span> : null}
      <strong>{name}</strong>
      {text ? <span className="sp-ability__text">{text}</span> : null}
    </li>
  );
}

export default function Roster({ view, sendMove, canAct }: Props) {
  const me = view.me;
  const mine = view.mine;
  if (me === null || !mine) return null;
  const own = view.people.filter((p) => p.host === me);
  return (
    <section className="sp-panel sp-roster" aria-label="Your people">
      <h2>Your people</h2>
      {own.length ? null : <p className="sp-event__status">{view.phase === "founding" ? "Your first Scions join once every House has sworn the Pact." : "Nobody is left."}</p>}
      {GROUPS.map(({ status, title }) => {
        const group = own.filter((p) => p.status === status);
        if (!group.length) return null;
        return (
          <div key={status}>
            <h3>
              {title} <small>{group.length}</small>
            </h3>
            {status === "recruit" ? (
              <p className="sp-event__status">
                A promotion costs {mine.promotion.gold} Gold; {mine.promotion.left} {mine.promotion.left === 1 ? "ceremony" : "ceremonies"} left this Year.
              </p>
            ) : null}
            <ul className="sp-people">
              {group.map((p) => (
                <Card key={p.id} p={p} view={view} sendMove={sendMove} canAct={canAct} />
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function Card({ p, view, sendMove, canAct }: Props & { p: Person }) {
  const mine = view.mine!;
  const [job, setJob] = useState<JobId>(BASE[0]!.id);
  const cures = mine.cures.filter((c) => c.person === p.id);
  const ward = p.house !== p.host;
  const crunch = view.display === "crunch";
  const promote = mine.promotion.left < 1 ? "There is no ceremony left this Year." : mine.gold < mine.promotion.gold ? `A promotion costs ${mine.promotion.gold} Gold.` : null;
  return (
    <li className="sp-person" aria-label={p.name}>
      <header>
        <strong className="sp-person__name" style={p.status === "recruit" ? undefined : { color: inkOf(view.houses[p.house]?.colors) }}>
          {p.name}
          {p.status === "recruit" ? null : <span className="sp-person__surname"> {view.houses[p.house]?.name}</span>}
        </strong>{" "}
        <small>age {p.age}</small>
        {p.status !== "recruit" ? (
          <small>
            {" "}
            · L{p.level} {p.job ? (Content.JOB_BY_ID.get(p.job)?.name ?? p.job) : ""}
          </small>
        ) : null}
        {ward ? <small> · Ward of House {view.houses[p.house]?.name}</small> : null}
        {p.change ? <small> · {Content.CHANGE_BY_ID.get(p.change)?.name ?? words(p.change)}</small> : null}
      </header>
      {p.base ? (
        <dl className="sp-person__stats">
          {STATS.map((s, i) => (
            <div key={s} title={s}>
              <dt>{s.slice(0, 3)}</dt>
              <dd>{p.base![i]}</dd>
            </div>
          ))}
          {p.sanity !== undefined ? (
            <div title="Sanity" className="is-sanity">
              <dt>San</dt>
              <dd>{p.sanity}</dd>
            </div>
          ) : null}
          {p.mp !== undefined ? (
            <div title="MP" className="is-mp">
              <dt>MP</dt>
              <dd>{p.mp}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {p.potential || p.loyalty !== undefined ? (
        <p className="sp-person__meta">
          {p.potential ? `${p.potential[0]!.toUpperCase()}${p.potential.slice(1)} potential` : ""}
          {p.potential && p.loyalty !== undefined ? " · " : ""}
          {p.loyalty !== undefined ? `Loyalty ${p.loyalty}` : ""}
        </p>
      ) : null}
      {p.tarot || p.traits.length ? (
        <ul className="sp-person__traits">
          {p.tarot ? <TraitLine kind="Tarot" name={TAROT_BY_ID.get(p.tarot)?.name ?? words(p.tarot)} text={crunch ? TAROT_BY_ID.get(p.tarot)?.crunch : undefined} /> : null}
          {p.traits.map((id) => {
            const t = Content.TRAIT_BY_ID.get(id);
            return <TraitLine key={id} name={t?.name ?? words(id)} text={crunch ? t?.crunch : t?.flavor} />;
          })}
        </ul>
      ) : null}
      {p.injuries.length ? (
        <p className="sp-person__injuries">
          {p.injuries.map((i) => {
            const def = Content.INJURY_BY_ID.get(i.id);
            return (
              <span key={i.id} title={def?.text}>
                {def?.name ?? words(i.id)}
                {i.years > 0 ? ` (${i.years} Year${i.years === 1 ? "" : "s"})` : ""}
              </span>
            );
          })}
        </p>
      ) : null}
      {canAct ? (
        <div className="sp-actions">
          {p.status === "recruit" ? (
            <span className="sp-bid">
              <select value={job} aria-label={`Job for ${p.name}`} onChange={(e) => setJob(e.target.value as JobId)}>
                {BASE.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.name}
                  </option>
                ))}
              </select>
              <button type="button" className="sp-button" disabled={!!promote} title={promote ?? undefined} onClick={() => sendMove({ type: "promote", person: p.id, job })}>
                Promote, {mine.promotion.gold} Gold
              </button>
            </span>
          ) : null}
          {p.status === "scion" ? (
            <button type="button" className="sp-button sp-button--quiet" onClick={() => sendMove({ type: "retire", person: p.id })}>
              Retire
            </button>
          ) : null}
          {p.status === "retired" ? (
            <button type="button" className="sp-button sp-button--quiet" onClick={() => sendMove({ type: "reinstate", person: p.id })}>
              Return to arms
            </button>
          ) : null}
          {mine.tarot.includes(p.id) ? (
            <button type="button" className="sp-button sp-button--quiet" onClick={() => sendMove({ type: "draw_tarot", person: p.id })}>
              Draw a new Tarot
            </button>
          ) : null}
          {mine.draught.includes(p.id) ? (
            <button type="button" className="sp-button sp-button--quiet" onClick={() => sendMove({ type: "drink_draught", person: p.id })}>
              Drink a Passive Draught
            </button>
          ) : null}
          {cures.flatMap((c) => {
            const item = view.items.find((i) => i.id === c.item);
            return c.injuries.map((inj) => (
              <button key={`${c.item}:${inj}`} type="button" className="sp-button sp-button--quiet" onClick={() => sendMove({ type: "cure", item: c.item, person: p.id, injury: inj })}>
                Mend {Content.INJURY_BY_ID.get(inj)?.name ?? words(inj)} with {item ? itemName(item) : "a cure"}
              </button>
            ));
          })}
        </div>
      ) : null}
    </li>
  );
}
