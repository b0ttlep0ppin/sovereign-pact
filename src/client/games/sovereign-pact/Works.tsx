// Building in the Settlement Phase (SPEC §8.2, §8.5): the House's own buildings, each with what its
// next level does and costs, a Build button (or why not) and Cancel for this Year's works; then the
// Commons' projects, what each still needs, a pledge (public and final), and the House's one proposal a Year to
// spend the Commons' stock on it.
import { Content, type SovMove, type SovView } from "@vibepulse/shared/games/sovereign-pact";
import { useState } from "react";

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
            <label key={k}>
              {word(k)}{" "}
              <input type="number" min={0} max={Math.min(have(k), p.need[k] ?? 0)} value={give[k] ?? 0} onChange={(e) => setGive({ ...give, [k]: Math.max(0, Math.min(have(k), p.need[k] ?? 0, Math.floor(Number(e.target.value) || 0))) })} />
            </label>
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
