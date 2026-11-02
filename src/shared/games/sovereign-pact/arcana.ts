// Arcana nodes (§14.9): each Major Arcana has a mini-boss met at most once a campaign, as a face-down
// card in an expedition's chain, far likelier when a Scion of that Tarot walks with the party. Killing it
// gives that Scion (if they still stand) the Arcana's trait for good, and drops its Relic into the haul.
import type { Rng } from "../../rng.ts";
import { ARCANA, ARCANA_BY_TAROT, TRAIT_BY_ID } from "./content.ts";
import { madeNamed } from "./items.ts";
import { carryNamed } from "./loot.ts";
import type { NodeKind, Person, SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { log } from "./year.ts";

const A = TUNING.arcana;
const met = (s: SovState, tarot: string): boolean => s.flags.includes(`arcana_${tarot}`);

/** The Arcana this chain meets, if any: a party member's own, much likelier, else any not yet met. */
export function arcanaFor(s: SovState, rng: Rng, party: readonly Person[]): string | undefined {
  const card = s.expedition!.card;
  if (card.type === "mandatory" || card.type === "forced" || s.expedition!.arcana) return undefined;
  const borne = [...new Set(party.map((p) => p.tarot))].filter((t) => ARCANA_BY_TAROT.has(t) && !met(s, t));
  if (borne.length && rng.int(100) < A.bearerPct) return rng.pick(borne);
  const any = ARCANA.filter((a) => !met(s, a.tarot));
  return any.length && rng.int(100) < A.basePct ? rng.pick(any).tarot : undefined;
}

/** The chain with the Arcana's node put in at random before the boss; the Arcana is met for the campaign. */
export function withArcana(s: SovState, rng: Rng, chain: NodeKind[], tarot: string): NodeKind[] {
  s.expedition!.arcana = tarot;
  s.flags.push(`arcana_${tarot}`);
  const at = rng.int(chain.length);
  return [...chain.slice(0, at), "arcana", ...chain.slice(at)];
}

/** The boss the Arcana node fights. */
export const arcanaBoss = (s: SovState): string => ARCANA_BY_TAROT.get(s.expedition!.arcana!)!.boss;

/** The Arcana falls: its bearers in the party gain its trait, and its Relic is carried home. */
export function arcanaWon(s: SovState, marching: readonly number[]): void {
  const def = ARCANA_BY_TAROT.get(s.expedition!.arcana!)!;
  for (const p of s.people.filter((x) => marching.includes(x.id) && x.tarot === def.tarot && !x.traits.includes(def.trait))) {
    p.traits.push(def.trait);
    log(s, `${p.name} is marked by the card: ${TRAIT_BY_ID.get(def.trait)!.name}.`);
  }
  if (!madeNamed(s, def.relic)) carryNamed(s, def.relic);
}
