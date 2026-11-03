// The Rift Gate (§9.1) [DECIDED, to try]: each Year it offers 2–3 expedition cards, seeded, at the
// Year's level band; in a mandatory Year it offers the arc's card alone (§14.7). The Houses vote on the card
// in the Settlement Phase, sealed with the Year: the most votes take it, a tie costs Accord and goes to
// the higher Renown, and no votes at all take the first card.
import { arcanaHuntFor } from "./arcana.ts";
import { idolFor } from "./idols.ts";
import { quarryFor } from "./hunt.ts";
import { loseAccord } from "./commons.ts";
import { goAlong } from "./votes.ts";
import { ARCANA_BY_TAROT, BOSS_BY_ID, IDOL_BY_ID, POOL_BY_ID, POOLS, TOWN_EVENT_BY_ID, TOWN_EVENTS } from "./content.ts";
import { year20 } from "./crisis.ts";
import type { ExpeditionCard, SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { campaignYears, log, mandatoryYears, withRng } from "./year.ts";

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
    // §9.9: the Lost are sought where they were left, on a Rescue card of its own beside the offer.
    const cards: ExpeditionCard[] = rescues(s);
    const fixed = cards.length;
    // The first card is always for 4 at the band's floor (tuning pass: a House can always pick a card
    // its Scions can take); a pool that reaches the floor is dealt first.
    const pools = rng.shuffle(POOLS.filter((p) => p.levels[0] <= hi && lo <= p.levels[1]));
    pools.sort((a, b) => +(b.levels[0] <= lo) - +(a.levels[0] <= lo));
    for (const pool of pools) {
      if (cards.length - fixed >= count) break;
      const floor = cards.length === fixed && G.floorCard;
      const level = floor ? Math.max(lo, pool.levels[0]) : Math.max(lo, pool.levels[0]) + rng.int(Math.min(hi, pool.levels[1]) - Math.max(lo, pool.levels[0]) + 1);
      let roll = rng.int(100);
      const size = floor ? 4 : G.sizes.find(([, w]) => (roll -= w) < 0)![0];
      const type = rng.pick(pool.cards) as ExpeditionCard["type"];
      // A Hunt card names its quarry (§14.9), while the pool has one left alive.
      const quarry = type === "hunt" ? quarryFor(s, rng, pool.id, level) : undefined;
      const card: ExpeditionCard = { type, pool: pool.id, level, size, ...(quarry ? { quarry } : {}) };
      // A high Pilgrimage may end at an Idol (§14.9): it is the card's boss.
      const idol = idolFor(s, rng, card);
      if (idol) Object.assign(card, { idol, boss: IDOL_BY_ID.get(idol)!.boss });
      // A high card of a great Arcana's pool may be its Hunt instead (§14.9): the Arcana is the boss.
      const arcana = idol ? undefined : arcanaHuntFor(s, rng, card);
      if (arcana) {
        cards.push({ type: "hunt", pool: pool.id, level, size, arcana, boss: ARCANA_BY_TAROT.get(arcana)!.boss });
        continue;
      }
      cards.push(card);
    }
    return cards;
  });
}

/** The card a forcing event makes (§3.2): its pool, at a level in both the Year's band and the pool's range. */
function forcedCard(s: SovState, pool: string, size: 4 | 8 = 4): ExpeditionCard {
  const [lo, hi] = band(year20(s));
  const [plo, phi] = POOL_BY_ID.get(pool)!.levels;
  const [a, b] = [Math.max(lo, plo), Math.min(hi, phi)];
  const level = a <= b ? a + withRng(s, (rng) => rng.int(b - a + 1)) : Math.min(Math.max(lo, plo), phi);
  return { type: "forced", pool, level, size };
}

/**
 * Foreshadows a forced expedition (§3.2): now and then, a forcing event is queued hidden on the
 * timeline for next Year, where a Watchtower can read it. At most two a campaign; never for a Year
 * before Year 3, a mandatory Year, or past the end.
 */
export function scheduleForced(s: SovState): void {
  const F = G.forced;
  const next = s.year + 1;
  const done = s.flags.filter((f) => f.startsWith("forced_y")).length;
  if (s.flags.includes("calm") || done >= F.max || next < F.fromYear || next > campaignYears(s) || mandatoryYears(s).includes(next)) return;
  const pool = TOWN_EVENTS.filter((e) => e.forces && !s.flags.includes(`forced_${e.id}`));
  if (!pool.length || withRng(s, (rng) => rng.int(100)) >= F.pct) return;
  const ev = withRng(s, (rng) => rng.pick(pool));
  s.timeline.push({ year: next, id: ev.id, hidden: true });
  s.flags.push(`forced_y${next}`, `forced_${ev.id}`);
}

/** A Rescue card for each place Scions were Lost, holding them all (§9.9). */
function rescues(s: SovState): ExpeditionCard[] {
  const groups = new Map<string, ExpeditionCard>();
  for (const p of s.people) {
    if (p.status !== "lost" || !p.lost) continue;
    const key = `${p.lost.pool}:${p.lost.level}`;
    const card = groups.get(key) ?? { type: "rescue" as const, pool: p.lost.pool, level: p.lost.level, size: 4 as const, rescue: [] };
    card.rescue!.push(p.id);
    groups.set(key, card);
  }
  return [...groups.values()];
}

/** Opens the Gate for the Year. */
export function openGate(s: SovState): void {
  // A test's still Year (testing.ts `calm`, `ashore`) sends no one.
  if (s.flags.includes("calm") || s.flags.includes("no_gate")) return void delete s.gate;
  // A Crisis's calamity can hold the Year's expedition back while the walls are manned (§3.5).
  if (s.flags.includes("expedition_delayed")) {
    s.flags = s.flags.filter((f) => f !== "expedition_delayed");
    log(s, "The walls are manned this Year; the Rift Gate stays shut.");
    return void delete s.gate;
  }
  // A forcing event in this Year's Omens replaces the whole offer with its one card (§3.2).
  const opened = [...s.events.map((e) => e.id), ...(s.vote?.kind === "event" ? [s.vote.subject] : [])];
  const forcing = opened.map((id) => TOWN_EVENT_BY_ID.get(id)?.forces).find(Boolean);
  if (forcing && !mandatoryYears(s).includes(s.year)) {
    s.gate = { cards: [forcedCard(s, forcing.pool, forcing.size)], votes: s.houses.map(() => null) };
    return log(s, "The Rift Gate shows one way only this Year: the expedition is forced.");
  }
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
  goAlong(s, gate.votes);
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

/**
 * The level the bot thinks its Scions can take: the best `seats` Scions' average level against the
 * reference Scion level of 3 per expedition level (§14.2), rounded in the party's favor.
 */
export function fairLevel(s: SovState, seats: number): number {
  const best = s.people.filter((p) => p.status === "scion").map((p) => p.level).sort((a, b) => b - a).slice(0, seats);
  const avg = best.length ? best.reduce((n, l) => n + l, 0) / best.length : 1;
  return Math.max(1, Math.floor((avg + TUNING.gate.botLevelSlack) / 3));
}

/**
 * The bot's card (it is cautious): among the cards the Houses' Scions could fill, the one nearest the
 * level they can take, a card above it counting double. It goes looking for its own Lost first, if that
 * card is not above its level.
 */
export function botCard(s: SovState, house?: number): number {
  const scions = s.people.filter((p) => p.status === "scion").length;
  const seats = (c: ExpeditionCard) => (c.size === 4 ? 4 : 8);
  const cards = s.gate!.cards.map((c, i) => ({ c, i, fits: seats(c) <= scions, fair: fairLevel(s, seats(c)) }));
  const own = cards.find((x) => x.c.rescue?.some((id) => s.people.find((p) => p.id === id)?.house === house));
  if (own && own.c.level <= own.fair) return own.i;
  const pool = cards.some((x) => x.fits) ? cards.filter((x) => x.fits) : cards;
  const miss = (x: (typeof pool)[number]) => (x.c.level > x.fair ? 2 * (x.c.level - x.fair) : x.fair - x.c.level);
  return pool.reduce((best, x) => (miss(x) < miss(best) || (miss(x) === miss(best) && x.c.level < best.c.level) ? x : best)).i;
}
