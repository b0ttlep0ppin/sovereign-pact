// Idols (§14.9): the otherworld's old gods, met at the end of Pilgrimage cards and never as random
// encounters. An Idol is an offer first, an event before the boss: kneel and pay for its blessing (the
// expedition ends there, in triumph), refuse it, or take the gift and refuse the price. Refused or
// cheated, it is the boss; killing it pays Valor and Renown (standing in for Piety, DECISIONS Q92) and
// drops its Relic, a Lore artifact. Each Idol is met once a campaign.
import type { Rng } from "../../rng.ts";
import { IDOL_BY_ID, IDOLS } from "./content.ts";
import type { ExpeditionCard, NodeKind, SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { log } from "./year.ts";

const I = TUNING.idol;
const met = (s: SovState, id: string): boolean => s.flags.includes(`idol_${id}`);

/** A Pilgrimage card's Idol at its level, if one of its pool's waits unmet. */
export function idolFor(s: SovState, rng: Rng, card: ExpeditionCard): string | undefined {
  if (card.type !== "pilgrimage" || card.level < I.minLevel) return undefined;
  const here = IDOLS.filter((i) => i.pool === card.pool && !met(s, i.id));
  return here.length && rng.int(100) < I.pct ? rng.pick(here).id : undefined;
}

/** The chain with the Idol's offer just before its boss; the Idol is met for the campaign. */
export function withIdol(s: SovState, chain: NodeKind[]): NodeKind[] {
  const id = s.expedition!.card.idol!;
  if (!met(s, id)) s.flags.push(`idol_${id}`);
  return [...chain.slice(0, -1), "idol", chain.at(-1)!];
}

/** The offer's event. */
export const idolEvent = (s: SovState): string => IDOL_BY_ID.get(s.expedition!.card.idol!)!.event;

/** The Idol falls: Valor and Renown for each House in the party (its Relic falls with the boss's loot). */
export function idolSlain(s: SovState, houses: number[]): void {
  for (const h of houses) {
    s.houses[h]!.score.valor += I.valor;
    s.houses[h]!.score.renown += I.renown;
  }
  log(s, "A god is dead, and the Houses that killed it will be talked about.");
}
