// The Sovereign Pact's client: what a seat sees and the moves it can send, from its view alone (the
// same props Vibe Pulse's room gives a game). Milestone 0 is a plain read-out of the campaign so the
// rules can be watched in play; Milestone 8 gives it screens: founding, the town, the expedition, battle.
import type { GameClientProps } from "@vibepulse/shared";
import { Content, TIER_NAMES, type SovMove, type SovView } from "@vibepulse/shared/games/sovereign-pact";
import { useState, type ReactNode } from "react";
import AccessPanel, { accessAttrs, useAccess } from "./Access";
import BattleScreen from "./BattleScreen";
import Credits from "./Credits";
import MusicPanel, { useMusic, useMusicSettings } from "./Music";
import { battleTrack, sceneTrack } from "./music";
import ChainMap from "./ChainMap";
import Deals from "./Deals";
import Formation from "./Formation";
import Decisions from "./Decisions";
import Market from "./Market";
import HouseDesigner from "./HouseDesigner";
import Readying from "./Readying";
import Roster from "./Roster";
import ScionSprite, { lookOf } from "./ScionSprite";
import { HERALDRY_COLORS, Emblem } from "./Emblem";
import RiftGate from "./RiftGate";
import TownMap from "./TownMap";
import Volunteers from "./Volunteers";
import Works from "./Works";
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

type Seen = SovView["battles"][number];
const WATCH_KEY = "sovereign-pact:watch-battles";
const readWatch = (): boolean => {
  try {
    return globalThis.localStorage?.getItem(WATCH_KEY) !== "no";
  } catch {
    return true;
  }
};

/**
 * The battles this seat has been sent, kept by the screen (the state drops them a move later), and
 * the queue to watch: new battles open on their own unless the viewer turned that off.
 */
function useBattles(battles: SovView["battles"], quiet: boolean) {
  const [last, setLast] = useState(battles);
  const [seen, setSeen] = useState<Seen[]>(battles);
  const [auto, setAuto] = useState(readWatch);
  const [queue, setQueue] = useState<string[]>(() => (readWatch() ? battles.map((b) => b.key) : []));
  if (battles !== last) {
    setLast(battles);
    const fresh = battles.filter((b) => !seen.some((x) => x.key === b.key));
    if (fresh.length) {
      setSeen([...seen, ...fresh].slice(-12));
      // A battle just fought on screen is not shown again.
      if (auto && !quiet) setQueue([...queue, ...fresh.map((b) => b.key)]);
    }
  }
  const toggle = (on: boolean) => {
    setAuto(on);
    try {
      globalThis.localStorage?.setItem(WATCH_KEY, on ? "yes" : "no");
    } catch {
      // Storage blocked: the choice lasts this visit.
    }
  };
  return { seen, auto, toggle, watching: seen.find((b) => b.key === queue[0]), waiting: Math.max(0, queue.length - 1), watch: (key: string) => setQueue([key]), next: () => setQueue(queue.slice(1)) };
}

export default function SovereignPact({ view, isMyTurn, sendMove, lastError }: Props) {
  const fight = view.expedition?.fight ?? null;
  // The render a live battle ends on still knows it was live, so its replay does not open again.
  const [wasLive, setWasLive] = useState(!!fight);
  if (wasLive !== !!fight) setWasLive(!!fight);
  const battles = useBattles(view.battles, wasLive);
  const [hidden, setHidden] = useState(false);
  if (hidden && !fight) setHidden(false);
  const [access, setAccess] = useAccess();
  const [music, setMusic] = useMusicSettings();
  const track = battles.watching ? battleTrack(battles.watching) : fight && !hidden ? battleTrack(fight.replay) : sceneTrack(view);
  useMusic(track, music);
  const mine = view.me === null ? null : view.houses[view.me]!;
  const others = view.people.filter((p) => p.host !== view.me);
  const open = view.phase === "settlement" && !!mine && !mine.sealed;
  const ownScions = view.people.filter((p) => p.host === view.me && p.status === "scion");
  // Fielding your seats: the Scions you have chosen so far, which the formation shows before you send them.
  const exp = view.expedition;
  const seats = exp && view.me !== null ? (exp.seats[view.me] ?? 0) : 0;
  const mustering = !!exp && !!mine && exp.party[view.me!] === null && !exp.pool && !exp.event && !exp.fight && exp.leader === undefined && !exp.votes;
  const able = ableOf(view);
  const [pick, setPick] = useState<{ key: string; ids: number[] } | null>(null);
  // Sealing with Scions left unassigned asks first (Josh 2026-11-02): they would only idle.
  const [sealAsk, setSealAsk] = useState(false);
  const idle = view.people.filter((p) => p.host === view.me && p.status === "scion" && !view.mine?.assign[p.id]);
  const pickKey = `${view.year}:${seats}`;
  const chosen = pick?.key === pickKey ? pick.ids.filter((id) => able.some((p) => p.id === id)) : able.slice(0, seats).map((p) => p.id);
  const setChosen = (ids: number[]) => setPick({ key: pickKey, ids });
  // The party's grid: everyone fielded so far, and while you choose, the Scions you have chosen.
  const fielded = (exp?.party ?? []).flatMap((x) => x ?? []);
  const byId = (id: number) => view.people.filter((p) => p.id === id);
  const partyPeople = mustering ? [...fielded, ...chosen].flatMap(byId) : fielded.length ? fielded.flatMap(byId) : ownScions;
  // One screen at a time (DECISIONS 8af): founding the House, the town, the expedition, the end.
  const scene = view.phase === "founding" ? "founding" : view.phase === "expedition" ? "expedition" : "town";
  const settings = (
    <details className="sp-settings">
      <summary aria-label="Settings">⚙ Settings</summary>
      <div className="sp-settings__body">
        <MusicPanel track={track} settings={music} set={setMusic} />
        <AccessPanel access={access} set={setAccess} />
        <Credits />
      </div>
    </details>
  );
  const error = lastError ? (
    <p className="sp-error" role="alert">
      {lastError.message}
    </p>
  ) : null;
  const chronicle = (
    <section className="sp-panel sp-chronicle" aria-label="Chronicle of the Year">
      <h2>What happened</h2>
      <ol className="sp-log">
        {view.log.slice(-12).map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ol>
    </section>
  );
  const battleList = battles.seen.length ? (
    <section className="sp-panel" aria-label="Battles">
      <h2>Battles</h2>
      <label className="sp-check">
        <input type="checkbox" checked={battles.auto} onChange={(e) => battles.toggle(e.target.checked)} /> Watch battles as they happen
      </label>
      <ul className="sp-battles">
        {[...battles.seen].reverse().map((b) => (
          <li key={b.key}>
            <span>
              Year {b.key.split(":")[0]}: {b.title} <small>({b.outcome === "victory" ? "won" : b.outcome === "defeat" ? "lost" : "withdrew"}, {b.frames.length} turns)</small>
            </span>
            <button type="button" className="sp-button sp-button--quiet" onClick={() => battles.watch(b.key)}>
              Watch
            </button>
          </li>
        ))}
      </ul>
    </section>
  ) : null;
  const houses = (
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
          <p className="sp-private">
            Only you see this. Ambition: <strong>{CATEGORY_NAMES[view.mine.ambition.double]}</strong> counts double, <strong>{CATEGORY_NAMES[view.mine.ambition.halve]}</strong> half.
          </p>
          <dl className="sp-stats">
            <dt>Ascendancy</dt>
            <dd>{view.mine.ascendancy}</dd>
            {Object.entries(view.mine.score).map(([k, v]) => (
              <div key={k} className="sp-stats__row">
                <dt>{CATEGORY_NAMES[k]}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      {others.length ? (
        <section className="sp-panel" aria-label="People">
          <h2>{view.me === null ? "The Houses' Scions" : "Scions of the other Houses"}</h2>
          <PeopleTable people={others} houses={view.houses} />
        </section>
      ) : null}
    </div>
  );
  const battle = battles.watching ? (
    <BattleScreen key={battles.watching.key} replay={battles.watching} view={view} onClose={battles.next} waiting={battles.waiting} fullLog={access.log} sound={music.sfx ? music.sfxVolume : 0} />
  ) : fight && !hidden ? (
    <BattleScreen
      key="live"
      replay={fight.replay}
      view={view}
      onClose={() => setHidden(true)}
      fullLog={access.log}
      sound={music.sfx ? music.sfxVolume : 0}
      live={{
        turn: fight.turn,
        waiting: fight.house === null || fight.house === view.me ? null : `House ${view.houses[fight.house]?.name}`,
        send: (c) => sendMove({ type: "command", ...c }),
      }}
    />
  ) : null;

  if (scene === "founding") {
    return (
      <div className="sp sp--founding" {...accessAttrs(access)}>
        <header className="sp-head">
          <strong className="sp-head__title">Found your House</strong>
          <span className="sp-head__phase">{view.muster ? "The muster: choose your first Scions" : `${view.houses.filter((h) => h.sealed).length} of ${view.houses.length} Houses sworn`}</span>
          {settings}
        </header>
        {error}
        {view.muster ? <Volunteers view={view} sendMove={sendMove} /> : null}
        {mine && view.mine?.dealt && !view.muster ? (
          <section className="sp-panel sp-founding-panel" aria-label={`House ${mine.name}`}>
            <Founding view={view} sworn={mine.sealed} sendMove={sendMove} />
          </section>
        ) : null}
        {view.muster ? <Roster view={view} sendMove={sendMove} canAct={false} /> : null}
      </div>
    );
  }

  return (
    <div className={`sp sp--${scene}`} {...accessAttrs(access)}>
      <header className="sp-head" aria-label="The kingdom">
        <div className="sp-top__year">
          <strong>
            Year {view.year} <small>of {view.years}</small>
          </strong>
          <span>{PHASE_NAMES[view.phase]}</span>
        </div>
        <Track label={view.track} value={view.accord} danger={view.accord <= 25} />
        <Track label="Doom" value={view.doom} danger={view.doom >= 75} />
        <span className="sp-top__commons">Commons: {view.commons.gold} Gold</span>
        {view.phase === "settlement" && mine ? (
          isMyTurn ? (
            sealAsk && idle.length ? (
              <span className="sp-seal-ask" role="alertdialog" aria-label="Seal the Year?">
                <span>
                  {idle.map((p) => p.name).join(", ")} {idle.length === 1 ? "has" : "have"} no assignment and will idle (Sanity +10% only).
                </span>
                <button type="button" className="sp-button" onClick={() => (setSealAsk(false), sendMove({ type: "seal" }))}>
                  Seal anyway
                </button>
                <button type="button" className="sp-button sp-button--quiet" onClick={() => setSealAsk(false)}>
                  Back
                </button>
              </span>
            ) : (
              <button type="button" className="sp-button" onClick={() => (idle.length ? setSealAsk(true) : sendMove({ type: "seal" }))}>
                Seal the Year
              </button>
            )
          ) : (
            <button type="button" className="sp-button sp-button--quiet" onClick={() => sendMove({ type: "unseal" })}>
              Unseal
            </button>
          )
        ) : null}
        {settings}
      </header>
      {view.mine ? <Stores mine={view.mine} /> : null}
      <Timeline view={view} />
      {view.outcome ? (
        <p className={`sp-outcome${view.outcome.won ? " is-won" : ""}`} role="status">
          {view.outcome.reason}
        </p>
      ) : null}
      {error}

      {scene === "expedition" ? (
        <div className="sp-stage">
          <div className="sp-stage__main">
            {mine && view.expedition ? (
              <section className="sp-panel sp-orders" aria-label="Your orders">
                <h2>Your orders</h2>
                <Muster view={view} sendMove={sendMove} chosen={chosen} setChosen={setChosen} openBattle={hidden ? () => setHidden(false) : undefined} />
              </section>
            ) : null}
            <div className="sp-stage__pair">
              <ChainMap view={view} sendMove={sendMove} />
              {mine ? (
                <Formation
                  view={view}
                  people={partyPeople}
                  sendMove={sendMove}
                  canAct={!fight}
                  title="The party's formation"
                  note={mustering ? (chosen.length ? "The Scions you have chosen stand here when the first battle opens; move them now or later." : "Choose Scions in your orders to see where they will stand.") : undefined}
                />
              ) : null}
            </div>
          </div>
          <aside className="sp-stage__side">
            {battleList}
            {chronicle}
          </aside>
        </div>
      ) : (
        <div className="sp-stage">
          <div className="sp-stage__main">
            <TownMap view={view} sendMove={sendMove} canAssign={open} />
            <Tabs
              tabs={[
                ["gate", "The Rift Gate", view.phase === "settlement" || view.phase === "omens" ? <RiftGate view={view} sendMove={sendMove} canVote={open} /> : null],
                [
                  "people",
                  "Your people",
                  <>
                    <Roster view={view} sendMove={sendMove} canAct={open} />
                    {ownScions.length ? <Formation view={view} people={ownScions} sendMove={sendMove} canAct={!!mine && view.phase !== "over"} /> : null}
                  </>,
                ],
                ["readying", "Readying", view.phase === "settlement" ? <Readying view={view} sendMove={sendMove} canAct={open} /> : null],
                ["building", "Building", view.phase === "settlement" ? <Works view={view} sendMove={sendMove} canAct={open} /> : null],
                ["market", "Market", view.phase === "settlement" ? <Market view={view} sendMove={sendMove} canAct={open} /> : null],
                ["deals", "Deals", view.phase === "settlement" ? <Deals view={view} sendMove={sendMove} canAct={open} /> : null],
                ["houses", "The Houses", houses],
                ["battles", "Battles", battleList],
              ]}
            />
          </div>
          <aside className="sp-stage__side">
            {view.phase === "settlement" ? <Decisions view={view} sendMove={sendMove} canAct={open} /> : null}
            {chronicle}
          </aside>
        </div>
      )}
      {battle}
    </div>
  );
}

const TAB_KEY = "sovereign-pact:tab";

/** The town's panels, one at a time under the map; the last one opened is remembered. */
function Tabs({ tabs }: { tabs: [string, string, ReactNode][] }) {
  const live = tabs.filter(([, , body]) => body);
  const [tab, setTab] = useState(() => {
    try {
      return globalThis.localStorage?.getItem(TAB_KEY) ?? "gate";
    } catch {
      return "gate";
    }
  });
  const shown = live.find(([id]) => id === tab) ?? live[0];
  const pick = (id: string) => {
    setTab(id);
    try {
      globalThis.localStorage?.setItem(TAB_KEY, id);
    } catch {
      // Storage blocked: the tab lasts this visit.
    }
  };
  return (
    <div className="sp-tabs">
      <div className="sp-tabs__bar" role="tablist" aria-label="The town">
        {live.map(([id, label]) => (
          <button key={id} type="button" role="tab" className="sp-tabs__tab" aria-selected={shown?.[0] === id} onClick={() => pick(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="sp-tabs__body" role="tabpanel" aria-label={shown?.[1]}>
        {shown?.[2]}
      </div>
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

/** House creation (§5.1): the House designed step by step, or rolled whole, then sworn with an Ambition kept. */
function Founding({ view, sworn, sendMove }: { view: SovView; sworn: boolean; sendMove: (m: SovMove) => void }) {
  const h = view.houses[view.me!]!;
  const crunch = view.display === "crunch";
  if (sworn) {
    return (
      <div className="sp-founding">
        <ul className="sp-traits">
          {h.traits.map((id) => {
            const t = Content.HOUSE_TRAIT_BY_ID.get(id);
            return (
              <li key={id}>
                <strong>{t?.name ?? id}</strong> <small>{KIND_NAMES[t?.kind ?? "major"]}</small> — {crunch ? t?.crunch : t?.flavor}
              </li>
            );
          })}
        </ul>
        <div className="sp-actions">
          <span>Sworn. Waiting for the other Houses.</span>
          <button type="button" className="sp-button sp-button--quiet" onClick={() => sendMove({ type: "unseal" })}>
            Take back the oath
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="sp-founding">
      <HouseDesigner view={view} sendMove={sendMove} />
      <button type="button" className="sp-button sp-button--quiet" onClick={() => sendMove({ type: "random_house" })}>
        🎲 Roll a whole new House
      </button>
      <Oath dealt={view.mine!.dealt!} swear={(i) => sendMove({ type: "swear", ambition: i })} />
    </div>
  );
}

/** What each score category counts (§3.4), for choosing an Ambition. */
const CATEGORY_TEXT: Record<string, string> = {
  lineage: "living Scions and recruits, heirs, Wards hosted",
  valor: "bosses slain, expeditions attended and led, monsters killed",
  treasury: "wealth held at the end",
  holdings: "House buildings and estates",
  lore: "artifacts, discoveries, bestiary entries",
  renown: "shared projects, Crises, lives saved, votes won",
  intrigue: "favors owed to you, secrets learned, deals honored",
  relics: "unique items held at the end",
};

/** The last founding step: keep one of two secret Ambitions, then swear the Pact. */
function Oath({ dealt, swear }: { dealt: NonNullable<NonNullable<SovView["mine"]>["dealt"]>; swear: (i: 0 | 1) => void }) {
  const [choice, setChoice] = useState<0 | 1 | null>(null);
  return (
    <fieldset className="sp-oath">
      <legend>Swear the Pact</legend>
      <p className="sp-event__status">
        When you are happy with your House, choose its secret <strong>Ambition</strong>. At the end of the campaign each House scores in eight categories; your Ambition makes one of them count double and another count half. Only you will ever see it.
      </p>
      {dealt.map((a, i) => (
        <label key={i} className={`sp-oath__choice${choice === i ? " is-known" : ""}`}>
          <input type="radio" name="ambition" checked={choice === i} onChange={() => setChoice(i as 0 | 1)} />
          <span>
            <strong>{CATEGORY_NAMES[a.double]} counts double</strong>
            <span className="sp-ability__text">{CATEGORY_TEXT[a.double]}</span>
            <strong>{CATEGORY_NAMES[a.halve]} counts half</strong>
            <span className="sp-ability__text">{CATEGORY_TEXT[a.halve]}</span>
          </span>
        </label>
      ))}
      <button type="button" className="sp-button" disabled={choice === null} onClick={() => choice !== null && swear(choice)}>
        {choice === null ? "Choose an Ambition to swear" : "Swear the Pact"}
      </button>
      <p className="sp-event__status">The first Year begins once every House has sworn. Until then you can take the oath back and change anything.</p>
    </fieldset>
  );
}

/** The basic resources, always shown, then any rare material the House holds (§8.1). */
const BASICS = ["grain", "timber", "stone", "iron", "essence"] as const;
const titled = (k: string) => Content.RARE_MATERIALS.find((m) => m.id === k)?.name ?? k[0]!.toUpperCase() + k.slice(1);

/** Your House's treasury and stores in one band under the header. */
function Stores({ mine }: { mine: NonNullable<SovView["mine"]> }) {
  const rare = Object.entries(mine.stores).filter(([k, n]) => !(BASICS as readonly string[]).includes(k) && n);
  const chip = (k: string, n: number, extra?: string) => (
    <li key={k} className={`sp-stores__item sp-stores__item--${k}`}>
      <span className="sp-stores__pip" aria-hidden="true" />
      <strong>{n}</strong> {titled(k)}
      {extra ? <small> {extra}</small> : null}
    </li>
  );
  return (
    <ul className="sp-stores" aria-label="Your stores">
      {chip("gold", mine.gold, mine.debt ? `(${mine.debt} owed)` : undefined)}
      {BASICS.map((k) => chip(k, mine.stores[k] ?? 0))}
      {rare.map(([k, n]) => chip(k, n!))}
    </ul>
  );
}

/** Your Scions who can take a seat, strongest first. */
function ableOf(view: SovView) {
  return view.people.filter((p) => p.host === view.me && p.status === "scion").sort((a, b) => b.level - a.level || a.id - b.id);
}

/** The Expedition Phase (§9.2): field your Scions in your seats, then vote the party's Leader. */
function Muster({ view, sendMove, chosen, setChosen, openBattle }: { view: SovView; sendMove: (m: SovMove) => void; chosen: number[]; setChosen: (ids: number[]) => void; openBattle?: () => void }) {
  const e = view.expedition!;
  const me = view.me!;
  const seats = e.seats[me] ?? 0;
  const able = ableOf(view);
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
        {ev?.options.every((o) => o.rule === "secret") ? <p>Each House chooses in secret, for its own Scions.</p> : null}
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
  if (e.fight) {
    const f = e.fight;
    const yours = f.house === me;
    return (
      <div className="sp-muster" aria-label="The battle">
        <p>
          {f.title}. {f.person === null ? "The battle runs on." : `${name(f.person)}'s turn${yours ? ": what do they do?" : `, waiting on House ${view.houses[f.house!]?.name}.`}`}
        </p>
        {openBattle ? (
          <button type="button" className="sp-button" onClick={openBattle}>
            Open the battle
          </button>
        ) : null}
        {yours ? (
          <div className="sp-actions">
            <button type="button" className="sp-button" onClick={() => sendMove({ type: "command", auto: "turn" })}>
              Follow their gambits this turn
            </button>
            <button type="button" className="sp-button sp-button--quiet" onClick={() => sendMove({ type: "command", auto: "battle" })}>
              Let the gambits fight the rest
            </button>
          </div>
        ) : null}
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
        {e.split && !e.split.united ? (
          <p>
            The expedition walks as two parties. {name(e.split.leaders[1 - e.split.turn]!)}'s party{" "}
            {{ walking: "waits its turn", rallied: "waits at the meeting place", retreated: "has turned back", wiped: "is gone" }[e.split.state[1 - e.split.turn]!]}.
          </p>
        ) : null}
        {leads ? (
          <div className="sp-actions">
            <button type="button" className="sp-button" onClick={() => sendMove({ type: "press_on" })}>
              {e.at === e.length - 1 ? (e.split && !e.split.united ? "Go to the meeting place" : "Face the boss") : "Press on"}
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
  const toggle = (id: number) => setChosen(chosen.includes(id) ? chosen.filter((x) => x !== id) : chosen.length < seats ? [...chosen, id] : chosen);
  const full = chosen.length >= seats;
  return (
    <div className="sp-muster sp-field">
      <p className="sp-field__count" role="status">
        <strong>
          {chosen.length} of {seats}
        </strong>{" "}
        seat{seats === 1 ? "" : "s"} filled.{" "}
        {seats ? (full ? "Your seats are full; set someone down to choose another." : "Click your Scions to choose who goes.") : "Your House has no seats this time."}
      </p>
      <div className="sp-field__cards" role="group" aria-label="Your Scions">
        {able.map((p) => {
          const on = chosen.includes(p.id);
          const colors = view.houses[p.house]?.colors;
          const job = p.job ? (Content.JOB_BY_ID.get(p.job)?.name ?? p.job) : "";
          return (
            <button
              key={p.id}
              type="button"
              className={`sp-field__card${on ? " is-chosen" : ""}`}
              aria-pressed={on}
              aria-label={`${p.name}, level ${p.level} ${job}`}
              disabled={!on && full}
              onClick={() => toggle(p.id)}
            >
              <ScionSprite look={lookOf(p, colors, view.items)} anim="idle" frame={0} size={56} />
              <span className="sp-field__name">{p.name.split(" ")[0]}</span>
              <small>
                L{p.level} {job}
              </small>
              <span className="sp-field__mark" aria-hidden="true">
                {on ? `Seat ${chosen.indexOf(p.id) + 1}` : "Stays home"}
              </span>
            </button>
          );
        })}
      </div>
      <div className="sp-actions">
        <button type="button" className="sp-button" onClick={() => sendMove({ type: "field", people: chosen })}>
          {chosen.length ? `Send ${chosen.length} Scion${chosen.length === 1 ? "" : "s"} on the expedition` : "Decline the seats"}
        </button>
      </div>
    </div>
  );
}
