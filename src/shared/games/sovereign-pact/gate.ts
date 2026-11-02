// The Rift Gate (§9.1) [DECIDED, to try]: each Year it offers 2–3 expedition cards, seeded, at the
// Year's level band; in a mandatory Year it offers the arc's card alone (§14.7). The Houses vote on the card
// in the Settlement Phase, sealed with the Year: the most votes take it, a tie costs Accord and goes to
// the higher Renown, and no votes at all take the first card.
import { loseAccord } from "./commons.ts";
import { BOSS_BY_ID, POOLS } from "./content.ts";
import { year20 } from "./crisis.ts";
import type { ExpeditionCard, SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { log, mandatoryYears, withRng } from "./year.ts";

const G = TUNING.gate;

/** The card level band of a Year of 20 (§9.1). */
export function band(year: number): [number, number] {
  return G.bands.find((b) => year <= b.until)!.levels as [number, number];
}

/** The Year's offer: the mandatory card when one is due, else 2–3 cards of different pools. */
export function offer(s: SovState): ExpeditionCard[] {
  const y = year20(s);
  return withRng(s, (rng) => {
    const due = mandatoryYears(s).indexOf(s.year);
    if (due >= 0) {
      const { boss, level } = G.arc[due]!;
      return [{ type: "mandatory", pool: BOSS_BY_ID.get(boss)!.pool, level, size: 8, boss }];
    }
    const [lo, hi] = band(y);
    const count = G.cards[0] + rng.int(G.cards[1] - G.cards[0] + 1);
    const cards: ExpeditionCard[] = [];
    for (const pool of rng.shuffle(POOLS.filter((p) => p.levels[0] <= hi && lo <= p.levels[1]))) {
      if (cards.length >= count) break;
      const level = Math.max(lo, pool.levels[0]) + rng.int(Math.min(hi, pool.levels[1]) - Math.max(lo, pool.levels[0]) + 1);
      let roll = rng.int(100);
      const size = G.sizes.find(([, w]) => (roll -= w) < 0)![0];
      cards.push({ type: rng.pick(pool.cards) as ExpeditionCard["type"], pool: pool.id, level, size });
    }
    return cards;
  });
}

/** Opens the Gate for the Year. */
export function openGate(s: SovState): void {
  // A test's still Year (testing.ts `calm`) sends no one.
  if (s.flags.includes("calm")) return void delete s.gate;
  s.gate = { cards: offer(s), votes: s.houses.map(() => null) };
}

export function cannotPick(s: SovState, card: number): string | null {
  if (!s.gate || s.gate.cards.length < 2) return "There is no card to choose this Year.";
  return Number.isInteger(card) && card >= 0 && card < s.gate.cards.length ? null : "That card is not on offer.";
}

/** A House's vote for a card; it may change it until the seal. */
export const pick = (s: SovState, house: number, card: number): void => void (s.gate!.votes[house] = card);

/** At the seal: the card the Houses chose (§9.1), or undefined if the Gate offered none. */
export function chosenCard(s: SovState): ExpeditionCard | undefined {
  const gate = s.gate;
  if (!gate?.cards.length) return undefined;
  const tally = gate.cards.map((_, i) => gate.votes.filter((v) => v === i).length);
  const top = Math.max(...tally);
  if (top === 0) return gate.cards[0];
  const tied = tally.flatMap((n, i) => (n === top ? [i] : []));
  if (tied.length === 1) return gate.cards[tied[0]!];
  loseAccord(s, TUNING.tracks.tieCost);
  // The tie goes to the card of the highest-Renown House among those who voted for a tied card.
  const voters = gate.votes.flatMap((v, h) => (v !== null && tied.includes(v) ? [h] : []));
  const by = voters.reduce((a, h) => (s.houses[h]!.score.renown > s.houses[a]!.score.renown ? h : a));
  log(s, `The Houses split over the Rift Gate; House ${s.houses[by]!.name} has the final word, at a cost of trust.`);
  return gate.cards[gate.votes[by]!];
}

/** The bot's card: the lowest level on offer (it is cautious). */
export const botCard = (s: SovState): number =>
  s.gate!.cards.reduce((best, c, i) => (c.level < s.gate!.cards[best]!.level ? i : best), 0);
