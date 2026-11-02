// The Sovereign Pact's client: what a seat sees and the moves it can send, from its view alone (the
// same props Vibe Pulse's room gives a game). Milestone 0 is a plain read-out of the campaign so the
// rules can be watched in play; the Town Map, battle screen and the rest replace it in Milestone 8.
import type { GameClientProps } from "@vibepulse/shared";
import { Content, TIER_NAMES, type SovMove, type SovView } from "@vibepulse/shared/games/sovereign-pact";
import { useState } from "react";
import { HERALDRY_COLORS, Emblem } from "./Emblem";
import "./SovereignPact.css";

type Props = GameClientProps<SovView, SovMove>;

const CATEGORY_NAMES: Record<string, string> = {
  lineage: "Lineage",
  valor: "Valor",
  treasury: "Treasury",
  holdings: "Holdings",
  lore: "Lore",
  renown: "Renown",
  intrigue: "Intrigue",
  relics: "Relics",
};

const PHASE_NAMES: Record<SovView["phase"], string> = {
  founding: "Founding the Houses",
  omens: "Omens",
  settlement: "Settlement Phase",
  expedition: "Expedition Phase",
  reckoning: "Reckoning",
  over: "The campaign is over",
};

const STAT_LABELS = ["Mig", "Res", "Gui", "Acu", "Sag", "Spd"];

function Track({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="sp-track">
      <span className="sp-track__label">{label}</span>
      <span className="sp-track__bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
        <span className={`sp-track__fill${danger ? " sp-track__fill--danger" : ""}`} style={{ width: `${value}%` }} />
      </span>
      <span className="sp-track__value">{value}</span>
    </div>
  );
}

function Timeline({ view }: { view: SovView }) {
  return (
    <ol className="sp-timeline" aria-label="Timeline">
      {Array.from({ length: view.years }, (_, i) => i + 1).map((year) => {
        const entries = view.timeline.filter((t) => t.year === year);
        const mandatory = view.mandatoryYears.includes(year);
        return (
          <li
            key={year}
            className={`sp-timeline__year${year === view.year ? " is-now" : ""}${year < view.year ? " is-past" : ""}${mandatory ? " is-mandatory" : ""}`}
            title={entries.map((e) => (e.id === "?" ? "Something waits" : e.id)).join(", ") || undefined}
          >
            <span>{year}</span>
            {mandatory ? <span className="sp-timeline__mark" aria-label="mandatory expedition">☠</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

export default function SovereignPact({ view, isMyTurn, sendMove, lastError }: Props) {
  const mine = view.me === null ? null : view.houses[view.me]!;
  const myPeople = view.people.filter((p) => p.host === view.me);
  const others = view.people.filter((p) => p.host !== view.me);
  return (
    <div className="sp">
      <section className="sp-top" aria-label="The kingdom">
        <div className="sp-top__year">
          <strong>
            Year {view.year} <small>of {view.years}</small>
          </strong>
          <span>{PHASE_NAMES[view.phase]}</span>
        </div>
        <Track label={view.track} value={view.accord} danger={view.accord <= 25} />
        <Track label="Doom" value={view.doom} danger={view.doom >= 75} />
        <div className="sp-top__commons">
          Commons: {view.commons.gold} Gold, {view.commons.stores.grain ?? 0} Grain
        </div>
      </section>
      <Timeline view={view} />

      {view.outcome ? (
        <p className={`sp-outcome${view.outcome.won ? " is-won" : ""}`} role="status">
          {view.outcome.reason}
        </p>
      ) : null}

      <div className="sp-cols">
        <section className="sp-panel" aria-label="The Houses">
          <h2>The Houses</h2>
          <ul className="sp-houses">
            {view.houses.map((h) => (
              <li key={h.index} className={`sp-house${h.index === view.me ? " is-me" : ""}`} style={{ borderColor: HERALDRY_COLORS.get(h.colors[0]) }}>
                <Emblem emblem={h.emblem} colors={h.colors} size={40} />
                <div>
                  <strong>House {h.name}</strong>
                  <em>“{h.motto}”</em>
                  <span className="sp-house__meta">
                    {h.element ?? "unaligned"} · {h.seat.replace(/_/g, " ")} · <span className={`sp-standing sp-standing--${h.standing}`}>{h.standing}</span>
                  </span>
                </div>
                <span className="sp-house__sealed">{view.phase === "settlement" ? (h.sealed ? "sealed" : "deciding") : ""}</span>
              </li>
            ))}
          </ul>
        </section>

        {mine && view.mine ? (
          <section className="sp-panel" aria-label={`House ${mine.name}`}>
            <h2>House {mine.name}</h2>
            <p className="sp-private" hidden={view.phase === "founding"}>
              Only you see this. Ambition: <strong>{CATEGORY_NAMES[view.mine.ambition.double]}</strong> counts double,{" "}
              <strong>{CATEGORY_NAMES[view.mine.ambition.halve]}</strong> half.
            </p>
            <dl className="sp-stats">
              <dt>Ascendancy</dt>
              <dd>{view.mine.ascendancy}</dd>
              <dt>Gold</dt>
              <dd>
                {view.mine.gold} Gold{view.mine.debt ? `, ${view.mine.debt} owed` : ""}
              </dd>
              <dt>Stores</dt>
              <dd>{Object.entries(view.mine.stores).map(([k, v]) => `${v} ${k}`).join(", ") || "empty"}</dd>
              {Object.entries(view.mine.score).map(([k, v]) => (
                <div key={k} className="sp-stats__row">
                  <dt>{CATEGORY_NAMES[k]}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            {view.phase === "founding" && view.mine.dealt ? <Founding view={view} sworn={mine.sealed} sendMove={sendMove} /> : null}
            {view.phase === "settlement" ? (
              <div className="sp-actions">
                {isMyTurn ? (
                  <button type="button" className="sp-button" onClick={() => sendMove({ type: "seal" })}>
                    Seal the Year
                  </button>
                ) : (
                  <button type="button" className="sp-button sp-button--quiet" onClick={() => sendMove({ type: "unseal" })}>
                    Unseal
                  </button>
                )}
              </div>
            ) : null}
            {view.phase === "expedition" && view.expedition ? <Muster key={view.expedition.seats[view.me!]} view={view} sendMove={sendMove} /> : null}
            {lastError ? <p className="sp-error" role="alert">{lastError.message}</p> : null}
          </section>
        ) : null}
      </div>

      <section className="sp-panel" aria-label="People">
        <h2>Your people</h2>
        <PeopleTable people={myPeople} />
        {others.length ? (
          <>
            <h2>Scions of the other Houses</h2>
            <PeopleTable people={others} houses={view.houses} />
          </>
        ) : null}
      </section>

      <section className="sp-panel" aria-label="Chronicle of the Year">
        <h2>What happened</h2>
        <ol className="sp-log">
          {view.log.slice(-12).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function PeopleTable({ people, houses }: { people: SovView["people"]; houses?: SovView["houses"] }) {
  if (!people.length) return <p className="sp-empty">Nobody.</p>;
  return (
    <div className="sp-table-wrap">
      <table className="sp-table">
        <thead>
          <tr>
            <th>Name</th>
            {houses ? <th>House</th> : null}
            <th>Status</th>
            <th>Job</th>
            <th>Lv</th>
            {STAT_LABELS.map((s) => (
              <th key={s}>{s}</th>
            ))}
            <th>Potential</th>
            <th>Tarot</th>
            <th>Sanity</th>
            <th>MP</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id}>
              <td>
                {p.name} <small>({p.age})</small>
              </td>
              {houses ? <td>{houses[p.host]?.name}</td> : null}
              <td>{p.status}</td>
              <td>{p.job?.replace(/_/g, " ") ?? "—"}</td>
              <td>{p.level}</td>
              {STAT_LABELS.map((s, i) => (
                <td key={s}>{p.base ? p.base[i] : "?"}</td>
              ))}
              <td>{p.potential ?? "?"}</td>
              <td>{p.tarot?.replace(/_/g, " ") ?? "?"}</td>
              <td>{p.sanity ?? "?"}</td>
              <td>{p.mp ?? "?"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const KIND_NAMES: Record<string, string> = { major: "Major", minor: "Minor", major_flaw: "Major Flaw", minor_flaw: "Minor Flaw", bloodline: "Bloodline" };

/** House creation, for now a Random House to reroll and swear (§5.1); the step-by-step screens come in Milestone 8. */
function Founding({ view, sworn, sendMove }: { view: SovView; sworn: boolean; sendMove: (m: SovMove) => void }) {
  const h = view.houses[view.me!]!;
  const crunch = view.display === "crunch";
  return (
    <div className="sp-founding">
      <ul className="sp-traits">
        {h.traits.map((id) => {
          const t = Content.HOUSE_TRAIT_BY_ID.get(id);
          return (
            <li key={id}>
              <strong>{t?.name ?? id}</strong> <small>{KIND_NAMES[t?.kind ?? ""]}</small> — {crunch ? t?.crunch : t?.flavor}
            </li>
          );
        })}
      </ul>
      {sworn ? (
        <div className="sp-actions">
          <span>Sworn. Waiting for the other Houses.</span>
          <button type="button" className="sp-button sp-button--quiet" onClick={() => sendMove({ type: "unseal" })}>
            Take back the oath
          </button>
        </div>
      ) : (
        <div className="sp-actions">
          <button type="button" className="sp-button sp-button--quiet" onClick={() => sendMove({ type: "random_house" })}>
            Random House
          </button>
          <button type="button" className="sp-button sp-button--quiet" onClick={() => sendMove({ type: "random_house", step: "traits" })}>
            Reroll traits
          </button>
          {view.mine!.dealt!.map((a, i) => (
            <button key={i} type="button" className="sp-button" onClick={() => sendMove({ type: "swear", ambition: i as 0 | 1 })}>
              Swear, keeping {CATEGORY_NAMES[a.double]} double and {CATEGORY_NAMES[a.halve]} half
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** The Expedition Phase (§9.2): field your Scions in your seats, then vote the party's Leader. */
function Muster({ view, sendMove }: { view: SovView; sendMove: (m: SovMove) => void }) {
  const e = view.expedition!;
  const me = view.me!;
  const seats = e.seats[me] ?? 0;
  const able = view.people.filter((p) => p.host === me && p.status === "scion").sort((a, b) => b.level - a.level || a.id - b.id);
  const [chosen, setChosen] = useState<number[]>(() => able.slice(0, seats).map((p) => p.id));
  const name = (id: number) => view.people.find((p) => p.id === id)?.name ?? `#${id}`;
  if (e.pool && e.draft?.length) {
    const turn = e.draft[0]!;
    const label = (x: (typeof e.pool)[number]) =>
      x.item
        ? `${TIER_NAMES[x.item.tier - 1]} ${Content.ITEM_BASE_BY_ID.get(x.item.base)?.name}`
        : Object.entries(x.stores ?? {})
            .map(([k, n]) => `${n} ${Content.RARE_MATERIALS.find((m) => m.id === k)?.name ?? k[0]!.toUpperCase() + k.slice(1)}`)
            .join(", ");
    return (
      <div className="sp-muster" aria-label="The draft">
        <p>The Houses claim shares of the haul; gear is drafted blind. {turn === me ? "Your pick." : `House ${view.houses[turn]?.name} picks.`}</p>
        <div className="sp-actions">
          {e.pool.map((x) => (
            <button key={x.id} type="button" className="sp-button" disabled={turn !== me} onClick={() => sendMove({ type: "draft", share: x.id })}>
              {label(x)}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (e.event) {
    const ev = Content.TRIP_EVENT_BY_ID.get(e.event.id);
    const mine = e.event.votes[me];
    return (
      <div className="sp-muster" aria-label="An event">
        <p>
          <strong>{ev?.title}</strong> {ev?.text}
        </p>
        {mine === null && e.event.picks ? (
          // Each Scion's House picks for them (§9.4 each_scion): the first of yours still to choose.
          (() => {
            const next = Object.entries(e.event.picks).find(([id, v]) => v === null && view.people.find((p) => p.id === +id)?.host === me)?.[0];
            return (
              <div className="sp-actions">
                <span>For {name(+next!)}:</span>
                {ev?.options.map((o, i) => (
                  <button key={o.id} type="button" className="sp-button" onClick={() => sendMove({ type: "decide", option: i, person: +next! })}>
                    {o.label}
                  </button>
                ))}
              </div>
            );
          })()
        ) : mine === null ? (
          <div className="sp-actions">
            {ev?.options.map((o, i) => (
              <button key={o.id} type="button" className="sp-button" onClick={() => sendMove({ type: "decide", option: i })}>
                {o.label}
              </button>
            ))}
          </div>
        ) : (
          <p>{mine === -1 ? "Your House has no one in the party." : "You have chosen. Waiting for the other Houses."}</p>
        )}
      </div>
    );
  }
  if (e.leader !== undefined) {
    const leads = view.people.find((p) => p.id === e.leader)?.host === me;
    return (
      <div className="sp-muster" aria-label="The expedition">
        <p>
          {name(e.leader)} leads. The party has passed {e.at} of {e.length} places{e.chain.length ? `: ${e.chain.join(", ")}` : ""}.
        </p>
        {leads ? (
          <div className="sp-actions">
            <button type="button" className="sp-button" onClick={() => sendMove({ type: "press_on" })}>
              {e.at === e.length - 1 ? "Face the boss" : "Press on"}
            </button>
            {e.at < e.length - 1 ? (
              <button type="button" className="sp-button sp-button--quiet" onClick={() => sendMove({ type: "retreat" })}>
                Turn back
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }
  if (e.votes) {
    const party = e.party.flatMap((p) => p ?? []);
    return (
      <div className="sp-actions" aria-label="Choose the Leader">
        {e.votes[me] !== null ? (
          <span>You voted for {name(e.votes[me]!)}. Waiting for the other Houses.</span>
        ) : (
          party.map((id) => (
            <button key={id} type="button" className="sp-button" onClick={() => sendMove({ type: "lead", person: id })}>
              {name(id)} leads
            </button>
          ))
        )}
      </div>
    );
  }
  if (e.party[me] !== null) return <p>{seats ? `You sent ${e.party[me]!.map(name).join(", ") || "no one"}.` : "Your House has no seats this time."} Waiting for the other Houses.</p>;
  const toggle = (id: number) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < seats ? [...c, id] : c));
  return (
    <div className="sp-muster">
      <p>
        Your House has {seats} seat{seats === 1 ? "" : "s"} on the expedition.
      </p>
      <div className="sp-actions">
        {able.map((p) => (
          <button key={p.id} type="button" className="sp-button sp-button--quiet" aria-pressed={chosen.includes(p.id)} onClick={() => toggle(p.id)}>
            {p.name} (L{p.level})
          </button>
        ))}
      </div>
      <div className="sp-actions">
        <button type="button" className="sp-button" onClick={() => sendMove({ type: "field", people: chosen })}>
          {chosen.length ? `Send ${chosen.length}` : "Decline the seats"}
        </button>
      </div>
    </div>
  );
}
