// Readying Scions in the Settlement Phase (SPEC §12.1, §13.1): one Scion at a time, its Job and the
// Jobs it may take, the abilities its JP buys, the secondary set, passives within the budget, and
// the House's gear in each slot. All of it reads the view's `kit`, which only the host House gets.
import { Content, itemName, type SovMove, type SovView } from "@vibepulse/shared/games/sovereign-pact";
import { useState } from "react";
import { ItemLine } from "./Market";

type Props = { view: SovView; sendMove: (m: SovMove) => void; canAct: boolean };
type Person = SovView["people"][number];
type Slot = SovMove & { type: "equip" } extends { slot: infer S } ? S : never;
type JobId = NonNullable<Person["job"]>;

export const SLOT_NAMES: Record<Slot, string> = {
  main: "Main hand",
  off: "Off hand",
  head: "Head",
  body: "Body",
  arms: "Hands",
  legs: "Legs",
  acc1: "Accessory",
  acc2: "Accessory",
};
const SLOTS = Object.keys(SLOT_NAMES) as Slot[];

const jobName = (id: string | null | undefined) => (id ? (Content.JOB_BY_ID.get(id as JobId)?.name ?? id) : "No Job");

export default function Readying({ view, sendMove, canAct }: Props) {
  const scions = view.people.filter((p) => p.kit && p.status === "scion");
  const [pick, setPick] = useState<number | null>(null);
  const p = scions.find((x) => x.id === pick) ?? scions[0];
  if (!p?.kit) return null;
  return (
    <section className="sp-panel sp-ready" aria-label="Readying">
      <h2>Ready your Scions</h2>
      <div className="sp-ready__tabs" role="tablist" aria-label="Scions">
        {scions.map((x) => (
          <button key={x.id} type="button" role="tab" aria-selected={x.id === p.id} className={`sp-button${x.id === p.id ? "" : " sp-button--quiet"}`} onClick={() => setPick(x.id)}>
            {x.name} <small>L{x.level} {jobName(x.job)}</small>
          </button>
        ))}
      </div>
      <Scion key={p.id} p={p} view={view} sendMove={sendMove} canAct={canAct} />
    </section>
  );
}

function Scion({ p, view, sendMove, canAct }: Props & { p: Person }) {
  const kit = p.kit!;
  const [job, setJob] = useState<JobId | "">("");
  const set = p.job ? Content.ABILITY_SET_BY_JOB.get(p.job) : undefined;
  const jpHere = p.job ? (kit.jp[p.job] ?? 0) : 0;
  const known = new Set(kit.known);
  const seconds = (Object.keys(kit.jp) as JobId[]).filter((j) => j !== p.job && Content.ABILITY_SET_BY_JOB.get(j)?.actives.some((a) => known.has(a.id)));
  const passives = kit.known.flatMap((id) => {
    const d = Content.JOB_PASSIVE_BY_ID.get(id);
    return d ? [d] : [];
  });
  const send = (m: SovMove) => canAct && sendMove(m);
  return (
    <div className="sp-ready__scion" role="tabpanel" aria-label={p.name}>
      <h3>Job</h3>
      <p>
        <strong>{jobName(p.job)}</strong>
        {p.job && kit.mastered.includes(p.job) ? <small> (mastered)</small> : null} · {jpHere} JP to spend
        {kit.secondary ? <> · secondary set: {jobName(kit.secondary)}</> : null}
      </p>
      <p className="sp-event__status">
        JP by Job:{" "}
        {(Object.keys(kit.jp) as JobId[])
          .map((j) => `${jobName(j)} ${kit.mastered.includes(j) ? "mastered" : kit.jp[j]}`)
          .join(", ")}
      </p>
      {canAct && kit.jobs.length ? (
        <span className="sp-bid">
          <select value={job} aria-label="Take a Job" onChange={(e) => setJob(e.target.value as JobId)}>
            <option value="">Choose a Job…</option>
            {kit.jobs.map((j) => (
              <option key={j} value={j}>
                {jobName(j)}
                {Content.JOB_BY_ID.get(j)?.advanced ? " (advanced)" : ""}
              </option>
            ))}
          </select>
          <button type="button" className="sp-button sp-button--quiet" disabled={!job} onClick={() => job && send({ type: "take_job", person: p.id, job })}>
            Take Job
          </button>
        </span>
      ) : null}

      {set ? (
        <>
          <h3>{jobName(p.job)} abilities</h3>
          <ul className="sp-lots sp-abilities">
            {[...set.actives.map((a) => ({ ...a, points: 0 })), ...set.passives].map((a) => {
              const has = known.has(a.id);
              return (
                <li key={a.id} className={has ? "is-known" : undefined}>
                  <span title={a.text}>
                    <strong>{a.name}</strong> <small>{a.points ? `passive, ${a.points} pt` : "active"}</small>
                    {a.later ? <small> (not in battle yet)</small> : null}
                  </span>
                  <small>{a.text}</small>
                  {has ? (
                    <small>Known</small>
                  ) : (
                    <button type="button" className="sp-button sp-button--quiet" disabled={!canAct || a.jp > jpHere} onClick={() => send({ type: "learn", person: p.id, ability: a.id })}>
                      Learn, {a.jp} JP
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      <h3>Secondary set</h3>
      {seconds.length ? (
        <select value={kit.secondary ?? ""} disabled={!canAct} aria-label="Secondary set" onChange={(e) => send({ type: "secondary", person: p.id, job: (e.target.value || null) as JobId | null })}>
          <option value="">None</option>
          {seconds.map((j) => (
            <option key={j} value={j}>
              {jobName(j)}
            </option>
          ))}
        </select>
      ) : (
        <p className="sp-event__status">Learn an active in another Job to bring it as a secondary set.</p>
      )}

      <h3>
        Passives <small>{kit.points} of {kit.budget} points</small>
      </h3>
      {passives.length ? (
        <ul className="sp-lots">
          {passives.map((d) => {
            const on = kit.passives.includes(d.id);
            return (
              <li key={d.id}>
                <label title={d.text}>
                  <input type="checkbox" checked={on} disabled={!canAct || (!on && kit.points + d.points > kit.budget)} onChange={(e) => send({ type: "passive", person: p.id, ability: d.id, on: e.target.checked })} /> <strong>{d.name}</strong> <small>{d.points} pt</small>
                </label>
                <small>{d.text}</small>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="sp-event__status">No passives bought yet.</p>
      )}

      <h3>Gear</h3>
      <ul className="sp-lots sp-gear">
        {SLOTS.map((slot) => {
          const worn = view.items.find((i) => i.id === p.gear?.[slot]);
          const fits = kit.fits.filter(([, s]) => s === slot).map(([id]) => view.items.find((i) => i.id === id)!).filter(Boolean);
          return (
            <li key={slot}>
              <small>{SLOT_NAMES[slot]}</small>
              {worn ? <ItemLine item={worn} /> : <span className="sp-event__status">empty</span>}
              <span className="sp-bid">
                {worn && canAct && !worn.cursed ? (
                  <button type="button" className="sp-button sp-button--quiet" onClick={() => send({ type: "unequip", person: p.id, slot })}>
                    Take off
                  </button>
                ) : null}
                {fits.length && canAct ? (
                  <select value="" aria-label={`Wear in ${SLOT_NAMES[slot]}`} onChange={(e) => e.target.value && send({ type: "equip", person: p.id, item: Number(e.target.value), slot })}>
                    <option value="">Wear…</option>
                    {fits.map((i) => (
                      <option key={i.id} value={i.id}>
                        {itemName(i)} (ilvl {i.ilvl})
                      </option>
                    ))}
                  </select>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
