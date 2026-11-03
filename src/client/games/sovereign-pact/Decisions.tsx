// What the Settlement Phase asks of a House (SPEC §15.2, §15.7): the open vote (hands shown as they are
// cast), the town events it decides, the Crisis and its private pledge, and Dark Bargains whispered to
// it alone. Each is a panel the House answers from; others see only that a House is deciding.
import { Content, type SovMove, type SovView } from "@vibepulse/shared/games/sovereign-pact";
import { useState } from "react";
import { Emblem } from "./Emblem";
import Amount from "./Amount";

type Props = { view: SovView; sendMove: (m: SovMove) => void; canAct: boolean };

const word = (k: string) => Content.RARE_MATERIALS.find((m) => m.id === k)?.name ?? k[0]!.toUpperCase() + k.slice(1);
const amounts = (r: Partial<Record<string, number>>) =>
  Object.entries(r)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([k, n]) => `${n} ${word(k)}`)
    .join(", ");

/** The open vote's question and its options' names. */
export function voteText(vote: NonNullable<SovView["vote"]>): { question: string; options: string[] } {
  if (vote.kind === "spend") {
    const p = Content.PROJECT_BY_ID.get(vote.subject);
    return { question: `Spend the Commons' stock on the ${p?.name ?? vote.subject}?`, options: vote.options.map((o) => (o === "yes" ? "Yes" : "No")) };
  }
  const ev = Content.TOWN_EVENT_BY_ID.get(vote.subject);
  return { question: ev?.title ?? vote.subject, options: vote.options.map((id) => ev?.options?.find((o) => o.id === id)?.label ?? id) };
}

export default function Decisions({ view, sendMove, canAct }: Props) {
  const me = view.me;
  const mine = view.mine;
  if (me === null || !mine) return null;
  const vote = view.vote;
  const events = view.events;
  const bargains = mine.bargains;
  const omens = view.omens ?? [];
  if (!vote && !events.length && !view.crisis && !bargains.length && !omens.length) return null;
  return (
    <section className="sp-panel sp-decisions" aria-label="Decisions">
      <h2>Decisions</h2>
      {vote ? <VoteCard view={view} vote={vote} sendMove={sendMove} /> : null}
      {events.map((pe) => {
        const ev = Content.TOWN_EVENT_BY_ID.get(pe.id);
        if (!ev) return null;
        const deciding = pe.deciders.includes(me);
        const chosen = pe.choices[me];
        const waiting = pe.deciders.filter((d) => pe.choices[d] === null && d !== me).map((d) => `House ${view.houses[d]?.name}`);
        return (
          <article key={pe.key} className={`sp-event${pe.house !== undefined ? " is-private" : ""}`} aria-label={ev.title}>
            <h3>{ev.title}</h3>
            {pe.house !== undefined ? <p className="sp-private">Only your House sees this.</p> : null}
            <p>{ev.text}</p>
            {deciding && (chosen === null || chosen === undefined) ? (
              <EventOptions view={view} event={pe.key} options={ev.options ?? []} sendMove={sendMove} />
            ) : (
              <p className="sp-event__status">
                {deciding ? `You chose: ${ev.options?.[chosen!]?.label ?? "?"}.` : "Not yours to decide."}
                {waiting.length ? ` Waiting for ${waiting.join(" and ")}.` : ""}
              </p>
            )}
          </article>
        );
      })}
      {view.crisis ? <CrisisCard view={view} sendMove={sendMove} canAct={canAct} /> : null}
      {bargains.map((id) => (
        <BargainCard key={id} id={id} view={view} sendMove={sendMove} />
      ))}
      {omens.length ? <OmensTold view={view} /> : null}
    </section>
  );
}

type Option = NonNullable<ReturnType<typeof Content.TOWN_EVENT_BY_ID.get>>["options"] & object;

/** Why the viewer cannot pay an option's price, or null (the rules check it again). */
export function priceShort(view: SovView, o: Option[number]): string | null {
  const mine = view.mine!;
  for (const [k, n] of Object.entries(o.cost?.resources ?? {})) if ((k === "gold" ? mine.gold : (mine.stores[k] ?? 0)) < (n ?? 0)) return `You have not got ${n} ${word(k)}.`;
  const recruits = view.people.filter((p) => p.host === view.me && p.status === "recruit").length;
  if ((o.cost?.recruits ?? 0) > recruits) return `You have not got ${o.cost!.recruits} recruits to give.`;
  return null;
}

/** A town event's options (Josh 2026-11-03: trade-offs): each with its price, and a House to name where it asks for one. */
function EventOptions({ view, event, options, sendMove }: { view: SovView; event: string; options: Option; sendMove: Props["sendMove"] }) {
  const others = view.houses.filter((h) => h.index !== view.me && !h.fallen);
  const [target, setTarget] = useState<number | null>(others[0]?.index ?? null);
  const asks = options.some((o) => o.target);
  return (
    <div className="sp-actions">
      {asks && others.length ? (
        <label className="sp-event__target">
          <span>Name a House</span>
          <select value={target ?? ""} onChange={(e) => setTarget(Number(e.target.value))}>
            {others.map((h) => (
              <option key={h.index} value={h.index}>
                House {h.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {options.map((o, i) => {
        const short = priceShort(view, o) ?? (o.target && target === null ? "There is no other House to name." : null);
        const price = [o.cost?.resources ? amounts(o.cost.resources) : "", o.cost?.recruits ? `${o.cost.recruits} recruit${o.cost.recruits > 1 ? "s" : ""}` : ""].filter(Boolean).join(", ");
        return (
          <button
            key={o.id}
            type="button"
            className="sp-button"
            disabled={short !== null}
            title={short ?? undefined}
            onClick={() => sendMove({ type: "choose", event, option: i, ...(o.target && target !== null ? { target } : {}) })}
          >
            {o.label}
            {price ? <small className="sp-event__price">{` (costs ${price})`}</small> : null}
            {o.target && target !== null ? <small className="sp-event__price">{` (House ${view.houses[target]?.name})`}</small> : null}
          </button>
        );
      })}
    </div>
  );
}

/** What the Omens' events did (Josh's playtest: "explain what it did"), newest first: who chose what, what
 *  came of it, and every change this House may see. */
function OmensTold({ view }: { view: SovView }) {
  const told = [...view.omens].reverse();
  return (
    <section className="sp-omens-told" aria-label="What came of the Omens">
      <h3>What came of the Omens</h3>
      {told.map((o, i) => {
        const ev = Content.TOWN_EVENT_BY_ID.get(o.id);
        return (
          <article key={i} className={`sp-told__part${o.house !== undefined ? " is-private" : ""}`} aria-label={`${ev?.title ?? o.id}, Year ${o.year}`}>
            <p className="sp-told__where">
              {ev?.title ?? o.id} <small>Year {o.year}</small>
            </p>
            {o.label ? (
              <p className="sp-told__choice">
                {o.by !== null && o.house === undefined && view.houses.length > 1 ? `House ${view.houses[o.by]?.name}: ` : ""}
                {o.label}
              </p>
            ) : null}
            <p className="sp-told__text">{o.text}</p>
            {o.lines.length ? (
              <ul className="sp-told__lines">
                {o.lines.map((l, j) => (
                  <li key={j} className={l.open ? undefined : "is-private"}>
                    {l.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="sp-told__none">Nothing you can see has changed.</p>
            )}
          </article>
        );
      })}
    </section>
  );
}

function VoteCard({ view, vote, sendMove }: { view: SovView; vote: NonNullable<SovView["vote"]>; sendMove: Props["sendMove"] }) {
  const { question, options } = voteText(vote);
  const mine = vote.by[view.me!];
  return (
    <article className="sp-event sp-event--vote" aria-label="The open vote">
      <h3>A vote: {question}</h3>
      {vote.kind === "event" ? <p>{Content.TOWN_EVENT_BY_ID.get(vote.subject)?.text}</p> : null}
      <p className="sp-event__status">
        {/* An Omen put to the vote has no proposer (omens.ts): every House answers it together. */}
        {view.houses[vote.proposer] ? `Proposed by House ${view.houses[vote.proposer]!.name}.` : "The Omen falls on the whole city; every House votes."} A tie costs Accord.
      </p>
      <ul className="sp-hands">
        {options.map((label, i) => (
          <li key={i}>
            <button type="button" className={`sp-button${mine === i ? "" : " sp-button--quiet"}`} aria-pressed={mine === i} disabled={mine !== null} onClick={() => sendMove({ type: "vote", choice: i })}>
              {label}
            </button>
            <span className="sp-card__votes" aria-label={`${vote.by.filter((b) => b === i).length} for ${label}`}>
              {view.houses
                .filter((h) => vote.by[h.index] === i)
                .map((h) => (
                  <span key={h.index} title={`House ${h.name}`}>
                    <Emblem emblem={h.emblem} colors={h.colors} size={20} />
                  </span>
                ))}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function CrisisCard({ view, sendMove, canAct }: Props) {
  const c = view.crisis!;
  const ev = Content.TOWN_EVENT_BY_ID.get(c.id);
  const own = view.mine!.crisis;
  const keys = Object.keys(c.need);
  const [give, setGive] = useState<Record<string, number>>({});
  const have = (k: string) => (k === "gold" ? view.mine!.gold : (view.mine!.stores[k] ?? 0));
  const temptation = ev?.crisis?.temptation;
  const any = keys.some((k) => (give[k] ?? 0) > 0);
  return (
    <article className="sp-event sp-event--crisis" aria-label="The Crisis">
      <h3>Crisis: {ev?.title}</h3>
      <p>{ev?.text}</p>
      <p>
        <strong>The city needs</strong> {amounts(c.need)}. Pledges are private and spent whatever comes; anything given beyond the Need goes back to each House in proportion to what it gave.
      </p>
      <p className="sp-private">Your pledge so far: {own && amounts(own.pledge) ? amounts(own.pledge) : "nothing"}.</p>
      {canAct ? (
        <div className="sp-pledge">
          {keys.map((k) => (
            <span key={k} className="sp-amount-row">
              <span>{word(k)}</span>
              <Amount label={word(k)} max={have(k)} value={give[k] ?? 0} onChange={(n) => setGive({ ...give, [k]: n })} />
              <small> of {have(k)}</small>
            </span>
          ))}
          <button
            type="button"
            className="sp-button"
            disabled={!any}
            onClick={() => {
              sendMove({ type: "crisis_pledge", give: Object.fromEntries(keys.filter((k) => (give[k] ?? 0) > 0).map((k) => [k, give[k]!])) });
              setGive({});
            }}
          >
            Pledge
          </button>
        </div>
      ) : null}
      {temptation && canAct && !own?.tempted ? (
        <div className="sp-temptation">
          <p>
            <em>{temptation.text}</em>
          </p>
          <button type="button" className="sp-button sp-button--quiet" onClick={() => sendMove({ type: "tempt" })}>
            {temptation.label}
          </button>
        </div>
      ) : own?.tempted ? (
        <p className="sp-private">You gave in to the temptation.</p>
      ) : null}
    </article>
  );
}

function BargainCard({ id, view, sendMove }: { id: string; view: SovView; sendMove: Props["sendMove"] }) {
  const b = Content.BARGAIN_BY_ID.get(id);
  const rivals = view.houses.filter((h) => h.index !== view.me && !h.fallen);
  const [target, setTarget] = useState(rivals[0]?.index ?? -1);
  if (!b) return null;
  return (
    <article className="sp-event sp-event--bargain" aria-label={b.title}>
      <h3>{b.title}</h3>
      <p className="sp-private">A whisper only your House hears.</p>
      <p>
        <em>{b.text}</em>
      </p>
      <div className="sp-actions">
        {b.bane ? (
          <label>
            Let it fall on{" "}
            <select value={target} onChange={(e) => setTarget(Number(e.target.value))}>
              {rivals.map((h) => (
                <option key={h.index} value={h.index}>
                  House {h.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button type="button" className="sp-button" disabled={!!b.bane && target < 0} onClick={() => sendMove({ type: "bargain", id, accept: true, ...(b.bane ? { target } : {}) })}>
          Accept
        </button>
        <button type="button" className="sp-button sp-button--quiet" onClick={() => sendMove({ type: "bargain", id, accept: false })}>
          Refuse
        </button>
      </div>
    </article>
  );
}
