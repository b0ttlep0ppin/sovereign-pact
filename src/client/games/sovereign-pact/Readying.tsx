// Readying Scions in the Settlement Phase (SPEC §12.1, §13.1): one Scion at a time. Its Jobs as a row of
// icons to click (Josh's playtest, 2026-11-02): each shows what that Job teaches, what is learned, and
// whether the Scion may take it. Then the secondary set, passives within the budget, and the gear on a
// paper doll: the Scion as they will stand, each slot beside them. All of it reads the view's `kit`,
// which only the host House gets.
import { Content, itemName, type SovMove, type SovView } from "@vibepulse/shared/games/sovereign-pact";
import { useState } from "react";
import { ItemLine } from "./Market";
import { BONE, GILT, PixelArt } from "./PixelArt";
import { JOB_ICONS } from "./icons";
import ScionSprite, { lookOf } from "./ScionSprite";

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
/** What putting something on sounds like, by where it goes. */
const SLOT_SOUNDS: Record<Slot, string> = { main: "equip_blade", off: "equip_blade", head: "equip_helm", body: "equip_mail", arms: "equip_mail", legs: "equip_mail", acc1: "equip_trinket", acc2: "equip_trinket" };
/** The paper doll: armor down the left, hands and trinkets down the right. */
const LEFT: Slot[] = ["head", "body", "arms", "legs"];
const RIGHT: Slot[] = ["main", "off", "acc1", "acc2"];

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
  const known = new Set(kit.known);
  const seconds = (Object.keys(kit.jp) as JobId[]).filter((j) => j !== p.job && Content.ABILITY_SET_BY_JOB.get(j)?.actives.some((a) => known.has(a.id)));
  const passives = kit.known.flatMap((id) => {
    const d = Content.JOB_PASSIVE_BY_ID.get(id);
    return d ? [d] : [];
  });
  const send = (m: SovMove) => canAct && sendMove(m);
  return (
    <div className="sp-ready__scion" role="tabpanel" aria-label={p.name}>
      <Jobs p={p} send={send} canAct={canAct} />

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
        <ul className="sp-lots sp-abilities">
          {passives.map((d) => {
            const on = kit.passives.includes(d.id);
            return (
              <li key={d.id}>
                <label title={d.text}>
                  <input type="checkbox" checked={on} disabled={!canAct || (!on && kit.points + d.points > kit.budget)} onChange={(e) => send({ type: "passive", person: p.id, ability: d.id, on: e.target.checked })} /> <strong>{d.name}</strong> <small>{d.points} pt</small>
                  <span className="sp-ability__text">{d.text}</span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="sp-event__status">No passives bought yet.</p>
      )}

      <h3>Gear</h3>
      <div className="sp-doll">
        <ul className="sp-doll__slots" aria-label="Armor">
          {LEFT.map((slot) => (
            <GearSlot key={slot} slot={slot} p={p} view={view} send={send} canAct={canAct} />
          ))}
        </ul>
        <div className="sp-doll__figure" aria-hidden="true">
          <ScionSprite look={lookOf(p, view.houses[p.host]?.colors, view.items)} anim="idle" frame={0} size={224} />
        </div>
        <ul className="sp-doll__slots" aria-label="Arms and trinkets">
          {RIGHT.map((slot) => (
            <GearSlot key={slot} slot={slot} p={p} view={view} send={send} canAct={canAct} />
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Every Job as an icon; the one chosen shows its abilities, and what the Scion can do with it. */
function Jobs({ p, send, canAct }: { p: Person; send: (m: SovMove) => void; canAct: boolean }) {
  const kit = p.kit!;
  const [shown, setShown] = useState<JobId | null>(p.job ?? null);
  const known = new Set(kit.known);
  const open = new Set<string>(kit.jobs);
  const state = (j: JobId) => (j === p.job ? "current" : kit.mastered.includes(j) ? "mastered" : open.has(j) ? "open" : "locked");
  const job = shown ? Content.JOB_BY_ID.get(shown) : undefined;
  const set = shown ? Content.ABILITY_SET_BY_JOB.get(shown) : undefined;
  const jpHere = shown ? (kit.jp[shown] ?? 0) : 0;
  return (
    <>
      <h3>Jobs</h3>
      <p>
        <strong>{jobName(p.job)}</strong>
        {p.job && kit.mastered.includes(p.job) ? <small> (mastered)</small> : null} · {p.job ? (kit.jp[p.job] ?? 0) : 0} JP to spend
        {kit.secondary ? <> · secondary set: {jobName(kit.secondary)}</> : null}
      </p>
      <ul className="sp-jobs" aria-label="Jobs">
        {Content.JOBS.map((j) => {
          const st = state(j.id);
          return (
            <li key={j.id}>
              <button type="button" className={`sp-jobs__job is-${st}${shown === j.id ? " is-shown" : ""}`} data-sfx={st === "locked" ? "ui_deny" : "ui_page"} aria-pressed={shown === j.id} title={`${j.name}: ${st === "locked" ? "not open yet" : st}`} onClick={() => setShown(j.id)}>
                <PixelArt rows={JOB_ICONS[j.id]} size={30} color={st === "current" ? GILT : BONE} />
                <span>{j.name}</span>
                <small>{st === "mastered" ? "Mastered" : st === "locked" ? "Locked" : `${kit.jp[j.id] ?? 0} JP`}</small>
              </button>
            </li>
          );
        })}
      </ul>
      {job && set ? (
        <div className="sp-jobs__detail" aria-label={`${job.name} abilities`}>
          <h3>
            {job.name} abilities{" "}
            <small>
              {state(job.id) === "current"
                ? `${jpHere} JP to spend`
                : state(job.id) === "locked"
                  ? `Opens with ${(job.requires ?? []).map((r) => `${r.jp} JP as a ${jobName(r.job)}`).join(" and ")}`
                  : `${p.name} must take this Job to learn here`}
            </small>
          </h3>
          {canAct && (state(job.id) === "open" || (state(job.id) === "mastered" && job.id !== p.job && open.has(job.id))) ? (
            <button type="button" className="sp-button sp-button--quiet" data-sfx="job" onClick={() => send({ type: "take_job", person: p.id, job: job.id })}>
              Take Job
            </button>
          ) : null}
          <ul className="sp-lots sp-abilities">
            {[...set.actives.map((a) => ({ ...a, points: 0 })), ...set.passives].map((a) => {
              const has = known.has(a.id) || kit.mastered.includes(job.id);
              return (
                <li key={a.id} className={has ? "is-known" : undefined}>
                  <span title={a.text}>
                    <strong>{a.name}</strong> <small>{a.points ? `passive, ${a.points} pt` : "active"}</small>
                    {a.later ? <small> (not in battle yet)</small> : null}
                    <span className="sp-ability__text">{a.text}</span>
                  </span>
                  {has ? (
                    <small>Known</small>
                  ) : job.id === p.job ? (
                    <button type="button" className="sp-button sp-button--quiet" data-sfx="learn" disabled={!canAct || a.jp > jpHere} onClick={() => send({ type: "learn", person: p.id, ability: a.id })}>
                      Learn, {a.jp} JP
                    </button>
                  ) : (
                    <small>{a.jp} JP</small>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </>
  );
}

/** One slot on the paper doll: what is worn there, and what of the House's could be. */
function GearSlot({ slot, p, view, send, canAct }: { slot: Slot; p: Person; view: SovView; send: (m: SovMove) => void; canAct: boolean }) {
  const kit = p.kit!;
  const worn = view.items.find((i) => i.id === p.gear?.[slot]);
  const fits = kit.fits.filter(([, s]) => s === slot).map(([id]) => view.items.find((i) => i.id === id)!).filter(Boolean);
  return (
    <li className={`sp-doll__slot${worn ? "" : " is-empty"}`}>
      <small>{SLOT_NAMES[slot]}</small>
      {worn ? <ItemLine item={worn} /> : <span className="sp-event__status">empty</span>}
      <span className="sp-bid">
        {worn && canAct && !worn.cursed ? (
          <button type="button" className="sp-button sp-button--quiet" data-sfx="equip_doff" onClick={() => send({ type: "unequip", person: p.id, slot })}>
            Take off
          </button>
        ) : null}
        {fits.length && canAct ? (
          <select value="" data-sfx={SLOT_SOUNDS[slot]} aria-label={`Wear in ${SLOT_NAMES[slot]}`} onChange={(e) => e.target.value && send({ type: "equip", person: p.id, item: Number(e.target.value), slot })}>
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
}

