// The muster (DECISIONS 8aa): the city's volunteers before the Houses, and the Houses taking turns to pick
// them, random order then snake order. Each pick becomes a Scion at once, in the base Job the House
// chooses for them. Everyone sees the same volunteers and whose pick it is.
import { Content, type SovMove, type SovView } from "@vibepulse/shared/games/sovereign-pact";
import { useState } from "react";
import { inkOf } from "./Emblem";
import { JOB_ICONS } from "./icons";
import { BONE, GILT, PixelArt } from "./PixelArt";
import { STATS, TAROT_BY_ID, TraitLine } from "./Roster";

type Muster = NonNullable<SovView["muster"]>;
type Volunteer = Muster["pool"][number];
type JobId = Extract<SovMove, { type: "muster" }>["job"];

const BASE = Content.JOBS.filter((j) => !j.advanced);
const words = (id: string) => id.replace(/_/g, " ");

export default function Volunteers({ view, sendMove }: { view: SovView; sendMove: (m: SovMove) => void }) {
  const m = view.muster!;
  const [pick, setPick] = useState<number | null>(null);
  const [job, setJob] = useState<JobId | null>(null);
  const turn = m.order[m.at];
  const mine = turn !== undefined && turn === view.me;
  const chosen = m.pool.find((v) => v.id === pick);
  const crunch = view.display === "crunch";
  const house = (i: number) => view.houses[i]!;
  return (
    <section className="sp-panel sp-muster" aria-label="The muster">
      <h2>The muster</h2>
      <p className="sp-event__status">
        The city's volunteers stand before the Houses. Each House takes them in turn, and every one taken is raised a Scion on the spot, in the Job their House chooses.
      </p>
      <ol className="sp-muster__order" aria-label="Pick order">
        {m.order.map((h, i) => (
          <li key={i} className={i < m.at ? "is-done" : i === m.at ? "is-now" : undefined} style={{ borderColor: inkOf(house(h).colors) }} title={`Pick ${i + 1}: House ${house(h).name}`}>
            {house(h).name}
          </li>
        ))}
      </ol>
      <p className="sp-muster__turn" role="status">
        {mine ? <strong>Your pick ({m.at + 1} of {m.order.length}): choose a volunteer, then their Job.</strong> : turn !== undefined ? `House ${house(turn).name} is choosing.` : ""}
      </p>
      <ul className="sp-people sp-muster__pool">
        {m.pool.map((v) => (
          <VolunteerCard key={v.id} v={v} crunch={crunch} picked={pick === v.id} onPick={mine ? () => setPick(v.id) : undefined} />
        ))}
      </ul>
      {mine ? (
        <fieldset className="sp-muster__jobs">
          <legend>{chosen ? `${chosen.name} trains as` : "Their Job"}</legend>
          <div className="sp-muster__job-row">
            {BASE.map((j) => (
              <button key={j.id} type="button" className={`sp-jobpick${job === j.id ? " is-picked" : ""}`} aria-pressed={job === j.id} onClick={() => setJob(j.id as JobId)}>
                <PixelArt rows={JOB_ICONS[j.id]} size={28} color={job === j.id ? BONE : GILT} />
                <strong>{j.name}</strong>
                <small>
                  {j.set}{j.starter ? ` · ${words(j.starter)}` : ""}
                  {crunch ? ` · ${j.armor} armor${j.shields ? ", shields" : ""}` : ""}
                </small>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="sp-button"
            disabled={!chosen || !job}
            onClick={() => {
              if (!chosen || !job) return;
              sendMove({ type: "muster", person: chosen.id, job });
              setPick(null);
              setJob(null);
            }}
          >
            {chosen && job ? `Take ${chosen.name} as a ${Content.JOB_BY_ID.get(job)?.name ?? words(job)}` : chosen ? "Choose their Job" : "Choose a volunteer"}
          </button>
        </fieldset>
      ) : null}
    </section>
  );
}

function VolunteerCard({ v, crunch, picked, onPick }: { v: Volunteer; crunch: boolean; picked: boolean; onPick?: () => void }) {
  const tarot = v.tarot ? TAROT_BY_ID.get(v.tarot) : undefined;
  return (
    <li className={`sp-person${picked ? " is-picked" : ""}${onPick ? " is-pickable" : ""}`} aria-label={v.name}>
      <header>
        <strong className="sp-person__name">{v.name}</strong> <small>{v.sex === "f" ? "she" : "he"}, age {v.age}</small>
        {onPick ? (
          <button type="button" className="sp-button sp-button--quiet sp-muster__pick" aria-pressed={picked} aria-label={`Choose ${v.name}, age ${v.age}`} onClick={onPick}>
            {picked ? "Chosen" : "Choose"}
          </button>
        ) : null}
      </header>
      {v.base ? (
        <dl className="sp-person__stats">
          {STATS.map((s, i) => (
            <div key={s} title={s}>
              <dt>{s.slice(0, 3)}</dt>
              <dd>{v.base![i]}</dd>
              {v.growth ? <small className="sp-person__growth" title={`${s} growth per level`}>+{(v.growth[i]! / 100).toFixed(1)}</small> : null}
            </div>
          ))}
        </dl>
      ) : null}
      {v.potential ? (
        <p className="sp-person__meta">
          {v.potential[0]!.toUpperCase()}
          {v.potential.slice(1)} potential
        </p>
      ) : null}
      <ul className="sp-person__traits">
        {v.tarot ? <TraitLine kind="Tarot" name={tarot?.name ?? words(v.tarot)} text={crunch ? tarot?.crunch : undefined} /> : null}
        {v.traits.map((id) => {
          const t = Content.TRAIT_BY_ID.get(id);
          return <TraitLine key={id} name={t?.name ?? words(id)} text={crunch ? t?.crunch : t?.flavor} />;
        })}
      </ul>
    </li>
  );
}
