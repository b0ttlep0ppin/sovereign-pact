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

/** Construction (Josh 2026-11-11): one page for the House's own buildings, one for the Commons' projects. */
export default function Works({ view, sendMove, canAct, part }: Props & { part: "house" | "commons" }) {
  const mine = view.mine;
  const me = view.me;
  if (me === null || !mine) return null;
  if (part === "commons") return <Commons view={view} mine={mine} sendMove={sendMove} canAct={canAct} />;
  const works = view.houses[me]?.works ?? [];
  return (
    <section className="sp-panel sp-works" aria-label="Your House's buildings">
      <h2>Your House</h2>
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
              {b.orders.length ? <Orders building={b.id} orders={b.orders} view={view} sendMove={sendMove} canAct={canAct} /> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const STOCK = ["gold", "grain", "timber", "stone", "iron", "essence"] as const;

/** A gift to the Commons' stock (Josh 2026-11-11: "donate resources to the commons"): public, final, Renown by share. */
function Donate({ mine, sendMove }: { mine: Mine; sendMove: Props["sendMove"] }) {
  const [give, setGive] = useState<Record<string, number>>({});
  const have = (k: string) => (k === "gold" ? mine.gold : (mine.stores[k] ?? 0));
  const any = STOCK.some((k) => (give[k] ?? 0) > 0);
  return (
    <div className="sp-pledge sp-donate" aria-label="Give to the Commons" role="group">
      {STOCK.map((k) => (
        <span key={k} className="sp-amount-row">
          <span>{k[0]!.toUpperCase() + k.slice(1)}</span>
          <Amount label={`Give ${k}`} max={have(k)} value={give[k] ?? 0} onChange={(n) => setGive({ ...give, [k]: n })} />
          <small> of {have(k)}</small>
        </span>
      ))}
      <button
        type="button"
        className="sp-button sp-button--quiet"
        disabled={!any}
        onClick={() => {
          sendMove({ type: "donate", give: Object.fromEntries(STOCK.filter((k) => (give[k] ?? 0) > 0).map((k) => [k, give[k]!])) });
          setGive({});
        }}
      >
        Give to the Commons
      </button>
    </div>
  );
}

function Commons({ view, mine, sendMove, canAct }: { view: SovView; mine: Mine; sendMove: Props["sendMove"]; canAct: boolean }) {
  const held = (k: string) => (k === "gold" ? view.commons.gold : (view.commons.stores[k] ?? 0));
  return (
    <section className="sp-panel sp-works" aria-label="The Commons">
      <h2>The Commons</h2>
      {/* What the Commons holds, at a glance (Josh 2026-11-11). */}
      <ul className="sp-commons__stock" aria-label="The Commons holds">
        {STOCK.map((k) => (
          <li key={k} className={held(k) ? undefined : "is-empty"}>
            <strong>{held(k)}</strong> <small>{k[0]!.toUpperCase() + k.slice(1)}</small>
          </li>
        ))}
      </ul>
      {canAct ? <Donate mine={mine} sendMove={sendMove} /> : null}
      <p className="sp-event__status">
        Every House tithes into the Commons, and any House may give to it; a gift earns Renown by share. Spending it takes a vote, on a project or, in a Crisis, on the city's Need. Pledges are public and final, and earn Renown by share. A project stands in the district the Houses vote to site it in
        (else the biggest pledger's), and its host takes a perk every Year.
      </p>
      {canAct && view.houses.length > 1 ? (
        <p className="sp-levy">
          <button type="button" className="sp-button sp-button--quiet" disabled={!!mine.levy} title={mine.levy ?? undefined} onClick={() => sendMove({ type: "levy" })}>
            Move a levy of {TUNING.commons.levyGold} Gold on every House
          </button>
        </p>
      ) : null}
      {mine.projects.length ? (
        <ul className="sp-lots sp-projects">
          {mine.projects.map((p) => (
            <Project key={p.id} p={p} view={view} mine={mine} sendMove={sendMove} canAct={canAct} />
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

/** A building's Year orders (once a Year each building; Josh 2026-11-03: "only Year orders"). */
function Orders({ building, orders, view, sendMove, canAct }: { building: string; orders: Mine["builds"][number]["orders"]; view: SovView; sendMove: Props["sendMove"]; canAct: boolean }) {
  const defs = Content.BUILDING_BY_ID.get(building)?.orders ?? [];
  const scions = view.people.filter((p) => p.host === view.me && (p.status === "scion" || p.status === "retired"));
  const [who, setWho] = useState<number | undefined>(scions[0]?.id);
  return (
    <ul className="sp-orders" aria-label={`${Content.BUILDING_BY_ID.get(building)?.name ?? building} orders`}>
      {orders.map((o) => {
        const def = defs.find((d) => d.id === o.id);
        if (!def) return null;
        return (
          <li key={o.id}>
            <span>
              <strong>{def.name}</strong> <small>Year order · {costText(def.cost)}</small>
              <span className="sp-ability__text">{def.text}</span>
            </span>
            {def.person ? (
              <label className="sp-amount-row">
                <span>For</span>
                <select value={who ?? ""} onChange={(e) => setWho(Number(e.target.value))}>
                  {scions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button
              type="button"
              className="sp-button sp-button--quiet"
              disabled={!canAct || !!o.why || (def.person && who === undefined)}
              title={o.why ?? undefined}
              onClick={() => sendMove(def.person ? { type: "order", building, order: o.id, person: who! } : { type: "order", building, order: o.id })}
            >
              Order
            </button>
          </li>
        );
      })}
    </ul>
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
          Standing:{" "}
          {standing
            .map((p) => {
              const at = view.commons.hosts?.[p.id];
              const bits = [p.tiers.length > 1 ? `level ${built[p.id]}` : "", at !== undefined && view.houses.length > 1 ? `House ${view.houses[at]?.name}'s district` : ""].filter(Boolean);
              return `${p.name}${bits.length ? ` (${bits.join(", ")})` : ""}`;
            })
            .join(", ")}
          .
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

function Project({ p, view, mine, sendMove, canAct }: { p: Mine["projects"][number]; view: SovView; mine: Mine; sendMove: Props["sendMove"]; canAct: boolean }) {
  const def = Content.PROJECT_BY_ID.get(p.id);
  const [give, setGive] = useState<Record<string, number>>({});
  const sited = view.commons.hosts?.[p.id] ?? view.commons.funds[p.id]?.host;
  const [host, setHost] = useState<number>(sited ?? view.me ?? 0);
  const many = view.houses.length > 1;
  const keys = Object.keys(p.need);
  const have = (k: string) => (k === "gold" ? mine.gold : (mine.stores[k] ?? 0));
  const any = keys.some((k) => (give[k] ?? 0) > 0);
  return (
    <li>
      <span>
        <strong>{def?.name ?? p.id}</strong> <small>level {p.level}</small>
        <span className="sp-ability__text">{def?.text}</span>
        <span className="sp-ability__text">Still needs {costText(p.need)}.</span>
        {many && def?.host ? (
          <span className="sp-ability__text">
            Host's perk: {def.host.text}
            {sited !== undefined ? ` Sited in House ${view.houses[sited]?.name}'s district.` : ""}
          </span>
        ) : null}
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
          {many && sited === undefined ? (
            <label className="sp-amount-row">
              <span>Site it in</span>
              <select value={host} onChange={(e) => setHost(Number(e.target.value))}>
                {view.houses.map((h, i) => (
                  <option key={i} value={i}>
                    House {h.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <button
            type="button"
            className="sp-button sp-button--quiet"
            disabled={!!p.propose}
            title={p.propose ?? undefined}
            onClick={() => sendMove(many && sited === undefined ? { type: "propose", project: p.id, host } : { type: "propose", project: p.id })}
          >
            Propose the Commons pay
          </button>
        </span>
      ) : null}
    </li>
  );
}
