// Building in the Settlement Phase (SPEC §8.2, §8.5): the House's own buildings, each with what its
// next level does and costs, a Build button (or why not) and Cancel for this Year's works; then the
// Commons' projects, what each still needs, a pledge (public and final), and the House's one proposal a Year to
// spend the Commons' stock on it.
import { Content, TUNING, type SovMove, type SovView } from "@vibepulse/shared/games/sovereign-pact";
import { useState } from "react";
import Amount from "./Amount";

type Props = { view: SovView; sendMove: (m: SovMove) => void; canAct: boolean };
type Mine = NonNullable<SovView["mine"]>;

const word = (k: string) => (k === "gold" ? "Gold" : (Content.RARE_MATERIALS.find((m) => m.id === k)?.name ?? k[0]!.toUpperCase() + k.slice(1)));
export const costText = (r: Partial<Record<string, number>>) =>
  Object.entries(r)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([k, n]) => `${n} ${word(k)}`)
    .join(", ") || "nothing";

export default function Works({ view, sendMove, canAct }: Props) {
  const mine = view.mine;
  const me = view.me;
  if (me === null || !mine) return null;
  const works = view.houses[me]?.works ?? [];
  return (
    <section className="sp-panel sp-works" aria-label="Building">
      <h2>Building</h2>
      <h3>Your House</h3>
      <ul className="sp-lots sp-abilities">
        {mine.builds.map((b) => {
          const def = Content.BUILDING_BY_ID.get(b.id);
          const rising = works.includes(b.id);
          const now = b.level - 1;
          return (
            <li key={b.id} className={rising ? "is-rising" : undefined}>
              <span>
                <strong>{def?.name ?? b.id}</strong> <small>{now ? `level ${now}` : "not built"}</small>
                {rising ? <small> · level {b.level} rising this Year</small> : null}
                <span className="sp-ability__text">{b.cost ? `Level ${b.level}: ${def?.levels[b.level - 1] ?? ""}` : "At its highest level."}</span>
              </span>
              {rising ? (
                <button type="button" className="sp-button sp-button--quiet" disabled={!canAct} onClick={() => sendMove({ type: "unbuild", building: b.id })}>
                  Cancel, refund {costText(b.cost ?? {})}
                </button>
              ) : b.cost ? (
                <button type="button" className="sp-button sp-button--quiet" disabled={!canAct || !!b.why} title={b.why ?? undefined} onClick={() => sendMove({ type: "build", building: b.id })}>
                  Build, {costText(b.cost)}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <h3>The Commons</h3>
      <p className="sp-event__status">
        Pledges are public and final, and earn Renown by share. The Commons holds {costText({ gold: view.commons.gold, ...view.commons.stores })}; spending it takes a vote.
      </p>
      {mine.projects.length ? (
        <ul className="sp-lots sp-projects">
          {mine.projects.map((p) => (
            <Project key={p.id} p={p} mine={mine} sendMove={sendMove} canAct={canAct} />
          ))}
        </ul>
      ) : (
        <p className="sp-event__status">No project is open.</p>
      )}
      <Standing view={view} open={mine.projects.map((p) => p.id)} />
      {mine.altar ? <Altar altar={mine.altar} sendMove={sendMove} canAct={canAct} /> : null}
    </section>
  );
}

/** What stands in the Commons, and what waits on another project first (the tech tree). */
function Standing({ view, open }: { view: SovView; open: string[] }) {
  const built = view.commons.built;
  const name = (id: string) => Content.PROJECT_BY_ID.get(id)?.name ?? id;
  const standing = Content.PROJECTS.filter((p) => built[p.id]);
  const waiting = Content.PROJECTS.filter((p) => !built[p.id] && !open.includes(p.id) && p.requires && !p.unlockedBy);
  if (!standing.length && !waiting.length) return null;
  return (
    <div className="sp-standing">
      {standing.length ? (
        <p className="sp-event__status">
          Standing: {standing.map((p) => `${p.name}${p.tiers.length > 1 ? ` (level ${built[p.id]})` : ""}`).join(", ")}.
        </p>
      ) : null}
      {waiting.length ? (
        <p className="sp-event__status">
          Waiting on another: {waiting.map((p) => `${p.name} (needs the ${name(p.requires!)})`).join(", ")}.
        </p>
      ) : null}
    </div>
  );
}

const OFFER_LABEL = { grain: "Lay Grain", recruit: "Lay a recruit", blood: "Bleed your Scions" } as const;
const offerCost = (gift: keyof typeof OFFER_LABEL) => {
  const o = TUNING.commons.altar[gift];
  return "grain" in o ? `${o.grain} Grain` : "recruits" in o ? "your last-sworn recruit" : `${o.sanity} Sanity from each Scion`;
};

/** The Altar of Offerings: one offering a Year, for what the House's Scions carry on the expedition. */
function Altar({ altar, sendMove, canAct }: { altar: NonNullable<Mine["altar"]>; sendMove: Props["sendMove"]; canAct: boolean }) {
  return (
    <section className="sp-altar" aria-label="The Altar of Offerings">
      <h3>The Altar of Offerings</h3>
      {altar.laid ? (
        <p className="sp-event__status">
          Your House has laid {TUNING.commons.altar[altar.laid].told} on the altar. On this Year's expedition: {TUNING.commons.altar[altar.laid].text}
        </p>
      ) : (
        <>
          <p className="sp-event__status">Once a Year, before the Gate opens. What you lay down is gone; your Scions carry what the altar gives back on this Year's expedition.</p>
          <ul className="sp-lots sp-abilities">
            {altar.offers.map((o) => (
              <li key={o.gift}>
                <span>
                  <strong>{OFFER_LABEL[o.gift]}</strong> <small>costs {offerCost(o.gift)}</small>
                  <span className="sp-ability__text">{TUNING.commons.altar[o.gift].text}</span>
                </span>
                <button type="button" className="sp-button sp-button--quiet" disabled={!canAct || !!o.why} title={o.why ?? undefined} onClick={() => sendMove({ type: "altar", gift: o.gift })}>
                  Offer
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Project({ p, mine, sendMove, canAct }: { p: Mine["projects"][number]; mine: Mine; sendMove: Props["sendMove"]; canAct: boolean }) {
  const def = Content.PROJECT_BY_ID.get(p.id);
  const [give, setGive] = useState<Record<string, number>>({});
  const keys = Object.keys(p.need);
  const have = (k: string) => (k === "gold" ? mine.gold : (mine.stores[k] ?? 0));
  const any = keys.some((k) => (give[k] ?? 0) > 0);
  return (
    <li>
      <span>
        <strong>{def?.name ?? p.id}</strong> <small>level {p.level}</small>
        <span className="sp-ability__text">{def?.text}</span>
        <span className="sp-ability__text">Still needs {costText(p.need)}.</span>
      </span>
      {canAct ? (
        <span className="sp-pledge">
          {keys.map((k) => (
            <span key={k} className="sp-amount-row">
              <span>{word(k)}</span>
              <Amount label={word(k)} max={Math.min(have(k), p.need[k] ?? 0)} value={give[k] ?? 0} onChange={(n) => setGive({ ...give, [k]: n })} />
            </span>
          ))}
          <button
            type="button"
            className="sp-button sp-button--quiet"
            disabled={!any}
            onClick={() => {
              sendMove({ type: "pledge", project: p.id, give: Object.fromEntries(keys.filter((k) => (give[k] ?? 0) > 0).map((k) => [k, give[k]!])) });
              setGive({});
            }}
          >
            Pledge
          </button>
          <button type="button" className="sp-button sp-button--quiet" disabled={!!p.propose} title={p.propose ?? undefined} onClick={() => sendMove({ type: "propose", project: p.id })}>
            Propose the Commons pay
          </button>
        </span>
      ) : null}
    </li>
  );
}
