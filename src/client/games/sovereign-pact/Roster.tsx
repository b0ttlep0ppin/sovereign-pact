// The House's own people (SPEC §6): Scions, the Retired, recruits and the Lost, each as a card with
// what the House knows of them. In the Settlement Phase, the moves that change who they are: promote a
// recruit into a base Job, retire a Scion or bring one back, mend an injury with a cure from the stash,
// and spend a Tarot Token or a Passive Draught. Any of them can be restyled (§5.8).
import { BEARDS, Content, HAIR_COLORS, HAIR_STYLES, itemName, styleOf, type SovMove, type SovView } from "@vibepulse/shared/games/sovereign-pact";
import { useState } from "react";
import { inkOf } from "./Emblem";
import ScionSprite, { bornLook, lookOf } from "./ScionSprite";
import { AffinityRow, STATS, StatGrid, TarotBadge } from "./Stats";

/** Head and shoulders in a 64 px portrait frame: x, y, width, height. */
export const BUST: [number, number, number, number] = [12, 4, 40, 44];

type Props = { view: SovView; sendMove: (m: SovMove) => void; canAct: boolean };
type Person = SovView["people"][number];
type JobId = NonNullable<Person["job"]>;

export { STATS };
const GROUPS: { status: Person["status"]; title: string }[] = [
  { status: "scion", title: "Scions" },
  { status: "retired", title: "Retired" },
  { status: "recruit", title: "Recruits" },
  { status: "lost", title: "Lost" },
];
const BASE = Content.JOBS.filter((j) => !j.advanced);
const words = (id: string) => id.replace(/_/g, " ");
export const TAROT_BY_ID = new Map(Content.TAROT.map((t) => [t.id, t]));

/** One trait or the Tarot card: its name, then what it does (Crunch) or how it reads (Flavor). */
export function TraitLine({ kind, name, text, tarot }: { kind?: string; name: string; text?: string; tarot?: string }) {
  const card = tarot ? TAROT_BY_ID.get(tarot) : undefined;
  return (
    <li className={kind ? "is-tarot" : undefined}>
      {tarot ? <TarotBadge id={tarot} number={card?.number} /> : kind ? <span className="sp-person__kind">{kind}</span> : null}
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
      {own.length ? null : <p className="sp-event__status">{view.phase === "founding" ? (view.muster ? "Your first Scions are chosen in the muster above." : "Your first Scions are chosen once every House has sworn the Pact.") : "Nobody is left."}</p>}
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
    <li className="sp-person sp-person--portrait" aria-label={p.name}>
      <ScionSprite className="sp-person__portrait" look={lookOf(p, view.houses[p.house]?.colors, view.items)} crop={BUST} size={(64 * 64) / BUST[2]} />
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
        <StatGrid
          base={p.base}
          stats={p.stats}
          from={p.statFrom}
          extra={
            <>
              {p.sanity !== undefined ? (
                <div title="Sanity: the mind's last line. At 0 they break; the Chapel and a Year's rest restore it." className="is-sanity">
                  <dt>San</dt>
                  <dd>{p.sanity}</dd>
                </div>
              ) : null}
              {p.mp !== undefined ? (
                <div title="MP: spent on spells and songs; it carries through an expedition and refills at home." className="is-mp">
                  <dt>MP</dt>
                  <dd>{p.mp}</dd>
                </div>
              ) : null}
            </>
          }
        />
      ) : null}
      {p.aff ? <AffinityRow aff={p.aff} from={p.affFrom} /> : null}
      {p.potential || p.loyalty !== undefined ? (
        <p className="sp-person__meta">
          {p.potential ? `${p.potential[0]!.toUpperCase()}${p.potential.slice(1)} potential` : ""}
          {p.potential && p.loyalty !== undefined ? " · " : ""}
          {p.loyalty !== undefined ? `Loyalty ${p.loyalty}` : ""}
        </p>
      ) : null}
      {p.status === "recruit" ? <RecruitTask p={p} view={view} sendMove={sendMove} canAct={canAct} /> : null}
      {p.tarot || p.traits.length ? (
        <ul className="sp-person__traits">
          {p.tarot ? <TraitLine kind="Tarot" tarot={p.tarot} name={TAROT_BY_ID.get(p.tarot)?.name ?? words(p.tarot)} text={crunch ? TAROT_BY_ID.get(p.tarot)?.crunch : undefined} /> : null}
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
      {canAct && p.status !== "lost" && !p.change ? <Restyle p={p} sendMove={sendMove} /> : null}
    </li>
  );
}

const STYLE_NAMES: Record<string, string> = { none: "Clean-shaven", parted_side_bangs: "Side bangs", swoop_side: "Side swoop", curtains_long: "Long curtains", long_messy: "Long and messy", single: "Single braid" };
const styleName = (id: string) => STYLE_NAMES[id] ?? id[0]!.toUpperCase() + words(id).slice(1);

/** Hair, hair color, beard and headwear (§5.8): each a ◀ name ▶ stepper that restyles them at once. Skin and the rest stay as born. */
function Restyle({ p, sendMove }: { p: Person; sendMove: (m: SovMove) => void }) {
  const born = bornLook(p);
  const chosen = styleOf({ look: [...p.look] });
  const now = { hair: chosen.hair ?? born.hair, hair_color: chosen.hair_color ?? born.hairColor, beard: chosen.beard ?? born.beard ?? "none", headwear: chosen.headwear ?? "worn" };
  const rows: { key: keyof typeof now; label: string; list: readonly string[] }[] = [
    { key: "hair", label: "Hair", list: HAIR_STYLES },
    { key: "hair_color", label: "Color", list: HAIR_COLORS },
    ...(p.sex === "m" ? [{ key: "beard" as const, label: "Beard", list: BEARDS }] : []),
  ];
  const step = (key: (typeof rows)[number]["key"], list: readonly string[], by: number) => {
    const at = Math.max(0, list.indexOf(now[key]));
    sendMove({ type: "restyle", person: p.id, [key]: list[(at + by + list.length) % list.length]! });
  };
  const restyled = Object.keys(chosen).length > 0;
  return (
    <details className="sp-restyle">
      <summary>Restyle</summary>
      {rows.map(({ key, label, list }) => (
        <div key={key} className="sp-restyle__row" role="group" aria-label={`${label} for ${p.name}`}>
          <span className="sp-restyle__label">{label}</span>
          <button type="button" className="sp-restyle__step" aria-label={`Previous ${label.toLowerCase()}`} onClick={() => step(key, list, -1)}>
            ◀
          </button>
          <span className="sp-restyle__value">{styleName(now[key])}</span>
          <button type="button" className="sp-restyle__step" aria-label={`Next ${label.toLowerCase()}`} onClick={() => step(key, list, 1)}>
            ▶
          </button>
        </div>
      ))}
      <div className="sp-restyle__row">
        <span className="sp-restyle__label">Headwear</span>
        <button
          type="button"
          role="switch"
          aria-checked={now.headwear === "worn"}
          aria-label={`Headwear for ${p.name}`}
          className="sp-restyle__switch"
          onClick={() => sendMove({ type: "restyle", person: p.id, headwear: now.headwear === "worn" ? "off" : "worn" })}
        >
          {now.headwear === "worn" ? "Worn" : "Off"}
        </button>
      </div>
      {restyled ? (
        <button type="button" className="sp-button sp-button--quiet" onClick={() => sendMove({ type: "restyle", person: p.id, hair: "", hair_color: "", beard: "", headwear: "" })}>
          As they were born
        </button>
      ) : null}
    </details>
  );
}

/**
 * What a recruit does with the Year (DECISIONS 8ae). Left alone they work a producer that has a free hand;
 * they can be set to train or rest instead. Recruits are not on the Town Map.
 */
function RecruitTask({ p, view, sendMove, canAct }: Props & { p: Person }) {
  const mine = view.mine!;
  const a = mine.assign[p.id];
  const at = mine.atWork[p.id];
  const place = (b: string) => Content.BUILDING_BY_ID.get(b)?.name ?? words(b);
  const now = a?.to === "train" ? "Training" : a?.to === "rest" ? "Resting" : a?.to === "work" ? `Working the ${place(a.at ?? "")}` : at ? `Working the ${place(at)} on their own` : "No free work: resting";
  const pick = (to: "idle" | "train" | "rest") => sendMove({ type: "assign", person: p.id, to });
  const current = a?.to === "train" ? "train" : a?.to === "rest" ? "rest" : "idle";
  return (
    <div className="sp-person__task">
      <span>{now}</span>
      {canAct ? (
        <span className="sp-person__task-pick" role="group" aria-label={`What ${p.name} does this Year`}>
          {(
            [
              ["idle", "Work"],
              ["train", "Train"],
              ["rest", "Rest"],
            ] as const
          ).map(([to, label]) => (
            <button key={to} type="button" className="sp-button sp-button--quiet" aria-pressed={current === to} onClick={() => current !== to && pick(to)}>
              {label}
            </button>
          ))}
        </span>
      ) : null}
    </div>
  );
}
