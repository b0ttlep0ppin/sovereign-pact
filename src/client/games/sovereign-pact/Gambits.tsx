// A Scion's own gambits (SPEC §6.11; Josh 2026-11-10): a short list of rules in priority order, each
// "When … do … at …", that they follow whenever they fight without commands (a Sortie, a battle handed
// over, an absent player). Whatever none of the rules covers, they fight their usual way.
import { Content, GAMBIT_ACTS, GAMBIT_TARGETS, GAMBIT_WHEN, TUNING, type SovMove, type SovView } from "@vibepulse/shared/games/sovereign-pact";

type Person = SovView["people"][number];
type Rule = NonNullable<Person["kit"]>["gambits"][number];

const ALLY_TARGETS = new Set(["ally_lowest_hp", "ally_down"]);

/** Whom a rule's act may aim at: a single foe or ally; nothing for Defend, Wait or an area. */
function targetsFor(act: string): string[] {
  if (act === "attack") return Object.keys(GAMBIT_TARGETS).filter((t) => !ALLY_TARGETS.has(t));
  const ab = Content.ACTIVE_BY_ID.get(act);
  if (!ab || ab.side === "self" || !ab.shape.startsWith("single")) return [];
  return Object.keys(GAMBIT_TARGETS).filter((t) => (ab.side === "ally") === ALLY_TARGETS.has(t));
}

export default function Gambits({ p, send, canAct }: { p: Person; send: (m: SovMove) => void; canAct: boolean }) {
  const kit = p.kit!;
  const rules = kit.gambits;
  const set = (next: Rule[]) => send({ type: "gambits", person: p.id, rules: next });
  const change = (i: number, r: Rule) => {
    // A target that no longer fits the act is dropped.
    const fits = r.target && targetsFor(r.do).includes(r.target);
    set(rules.map((x, j) => (j === i ? { ...(r.if ? { if: r.if } : {}), do: r.do, ...(fits ? { target: r.target } : {}) } : x)));
  };
  const swap = (i: number, j: number) => {
    const next = [...rules];
    [next[i], next[j]] = [next[j]!, next[i]!];
    set(next);
  };
  const acts: [string, string][] = [...Object.entries(GAMBIT_ACTS), ...kit.actives.map((id): [string, string] => [id, Content.ACTIVE_BY_ID.get(id)?.name ?? id])];
  return (
    <>
      <h3>
        Gambits <small>{rules.length} of {TUNING.gambits.maxRules}</small>
      </h3>
      <p className="sp-event__status">When {p.name} fights without your commands (a Sortie, or a battle handed to the gambits), the first of these that applies is done. Otherwise they fight their usual way.</p>
      <ol className="sp-gambits" aria-label="Gambits">
        {rules.map((r, i) => {
          const targets = targetsFor(r.do);
          return (
            <li key={i} className="sp-gambit">
              <select aria-label={`Gambit ${i + 1}: when`} disabled={!canAct} value={r.if ?? "always"} onChange={(e) => change(i, { ...r, if: e.target.value === "always" ? undefined : e.target.value })}>
                {Object.entries(GAMBIT_WHEN).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <select aria-label={`Gambit ${i + 1}: do`} disabled={!canAct} value={r.do} onChange={(e) => change(i, { ...r, do: e.target.value })}>
                {acts.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              {targets.length ? (
                <select aria-label={`Gambit ${i + 1}: at`} disabled={!canAct} value={r.target ?? ""} onChange={(e) => change(i, { ...r, target: e.target.value || undefined })}>
                  <option value="">{r.do === "attack" || Content.ACTIVE_BY_ID.get(r.do)?.side !== "ally" ? "The weakest (usual)" : "The most hurt (usual)"}</option>
                  {targets.map((t) => (
                    <option key={t} value={t}>
                      {GAMBIT_TARGETS[t]}
                    </option>
                  ))}
                </select>
              ) : (
                <span />
              )}
              <span className="sp-gambit__order">
                <button type="button" className="sp-button sp-button--quiet" disabled={!canAct || i === 0} aria-label={`Move gambit ${i + 1} up`} onClick={() => swap(i, i - 1)}>
                  ▲
                </button>
                <button type="button" className="sp-button sp-button--quiet" disabled={!canAct || i === rules.length - 1} aria-label={`Move gambit ${i + 1} down`} onClick={() => swap(i, i + 1)}>
                  ▼
                </button>
                <button type="button" className="sp-button sp-button--quiet" disabled={!canAct} aria-label={`Remove gambit ${i + 1}`} onClick={() => set(rules.filter((_, j) => j !== i))}>
                  ✕
                </button>
              </span>
            </li>
          );
        })}
      </ol>
      {rules.length < TUNING.gambits.maxRules ? (
        <button type="button" className="sp-button sp-button--quiet" disabled={!canAct} onClick={() => set([...rules, { do: "attack" }])}>
          Add a gambit
        </button>
      ) : null}
    </>
  );
}
