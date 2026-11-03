// Dark Bargains (§14.7a): the otherworld's private offers to one House. Offered at Omens (now and then,
// at most twice a campaign a House) and by the Crown after the Year 10 assault is won. Only the offered
// House sees the offer, its answer and what it learns; a bane's victim reads an ordinary misfortune.
// An accepted bargain is paid at once and settles on a hidden roll: as promised, nothing, or twisted.
// Some carry a hidden Pact mark, which costs the House at the final score (score.ts). Bots refuse.
import type { Rng } from "../../rng.ts";
import { BARGAIN_BY_ID, BARGAINS, ITEM_BASES, type BargainDef, type BargainEffect } from "./content.ts";
import { applyEffects } from "./effects.ts";
import { mint } from "./items.ts";
import { STATS, type ItemTier, type SovMove, type SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { note, withRng } from "./year.ts";

const B = TUNING.bargain;

export type BargainMove = Extract<SovMove, { type: "bargain" }>;

const has = (s: SovState, house: number, traits: readonly string[]): boolean => s.houses[house]!.traits.some((t) => traits.includes(t));

/** One offer for the House from those made `when`: banes only with a rival to name, never one it already holds. */
function draw(s: SovState, rng: Rng, house: number, when: BargainDef["when"][number]): BargainDef | undefined {
  const held = s.bargains.pending.filter((b) => b.house === house).map((b) => b.id);
  const pool = BARGAINS.filter((b) => b.when.includes(when) && !held.includes(b.id) && (!b.bane || s.houses.length > 1));
  return pool.length ? rng.pick(pool) : undefined;
}

function offer(s: SovState, house: number, def: BargainDef): void {
  s.bargains.pending.push({ house, id: def.id });
  note(s, house, `A Dark Bargain is offered: ${def.title}.`);
}

/** At Omens: now and then a whisper in a House's Seat (from Year 2, at most `omenMax` a campaign). */
export function offerOmenBargains(s: SovState): void {
  if (s.flags.includes("calm") || s.year < B.fromYear) return;
  s.houses.forEach((_, i) => {
    if (s.bargains.offered[i]! >= B.omenMax) return;
    const pct = has(s, i, B.wary) ? B.omenPct / 2 : B.omenPct;
    const def = withRng(s, (rng) => (rng.int(100) < pct ? draw(s, rng, i, "omen") : undefined));
    if (!def) return;
    s.bargains.offered[i]! += 1;
    offer(s, i, def);
  });
}

/** The Cursed King kneels (Year 10 won): the crown makes each House an offer. */
export function offerCrown(s: SovState): void {
  s.houses.forEach((_, i) => {
    const def = withRng(s, (rng) => draw(s, rng, i, "crown"));
    if (def) offer(s, i, def);
  });
}

/** The Gate's Reflection (Year 20, §9.7, §14.7a): before the final boss, each House in the party is made an offer. */
export function offerReflection(s: SovState, houses: readonly number[]): void {
  for (const i of houses) {
    const def = withRng(s, (rng) => draw(s, rng, i, "reflection"));
    if (def) offer(s, i, def);
  }
}

/** Why House `house` cannot give this answer, or null. */
export function cannotBargain(s: SovState, house: number, m: BargainMove): string | null {
  if (!s.bargains.pending.some((b) => b.house === house && b.id === m.id)) return "No such bargain is offered to you.";
  if (!m.accept || !BARGAIN_BY_ID.get(m.id)!.bane) return null;
  const t = m.target;
  if (typeof t !== "number" || !Number.isInteger(t) || t < 0 || t >= s.houses.length) return "Name the House it falls on.";
  return t === house ? "Name a rival House." : null;
}

/** An effect made bigger or smaller (a twisted boon, a Grudge-Holder's bane). */
function scale(e: BargainEffect, f: number): BargainEffect {
  const each = (r: Partial<Record<string, number>> | undefined) => (r ? Object.fromEntries(Object.entries(r).map(([k, n]) => [k, Math.round((n ?? 0) * f)])) : undefined);
  const n = (x: number | undefined) => (x === undefined ? undefined : Math.round(x * f));
  const out: BargainEffect = { ...e, resources: each(e.resources), score: each(e.score), sanity: n(e.sanity), ruin: n(e.ruin), recruits_lost: n(e.recruits_lost), recruit_gain: n(e.recruit_gain), stat: n(e.stat), building: n(e.building) };
  if (e.item) out.item = Math.max(2, Math.min(4, e.item + (f < 1 ? -1 : 0))) as 2 | 3 | 4;
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as BargainEffect;
}

/** The level an item made by a bargain is made for: the House's best Scion's mark. */
const ilvlFor = (s: SovState, house: number): number => Math.max(1, Math.min(10, Math.ceil(Math.max(1, ...s.people.filter((p) => p.host === house && p.status === "scion").map((p) => p.level)) / 3)));

/** Applies a bargain's effect to one House. */
function apply(s: SovState, e: BargainEffect, house: number): void {
  const { resources, sanity, score, ruin, recruits_lost, recruit_gain } = e;
  applyEffects(s, [{ to: "house", resources, sanity, score, ruin, recruits_lost, recruit_gain }], house, false);
  withRng(s, (rng) => {
    const base = () => rng.pick(ITEM_BASES).id;
    if (e.item) mint(s, base(), house, e.item as ItemTier, ilvlFor(s, house));
    if (e.cursed) mint(s, base(), house, 2, ilvlFor(s, house)).cursed = true;
    if (e.stat) {
      const best = s.people.filter((p) => p.host === house && p.status === "scion").sort((a, b) => b.level - a.level || a.id - b.id)[0];
      if (best) {
        const k = rng.int(STATS.length - 1);
        best.base[k] = best.base[k]! + e.stat;
      }
    }
    for (let n = 0; n < (e.building ?? 0); n++) {
      const h = s.houses[house]!;
      const room = Object.keys(h.buildings).filter((b) => (h.buildings[b] ?? 0) > 0 && (h.buildings[b] ?? 0) < 3);
      if (room.length) h.buildings[rng.pick(room)]! += 1;
    }
  });
}

/** Answers a (checked) bargain. */
export function bargain(s: SovState, house: number, m: BargainMove): void {
  s.bargains.pending = s.bargains.pending.filter((b) => !(b.house === house && b.id === m.id));
  const def = BARGAIN_BY_ID.get(m.id)!;
  if (!m.accept) return void note(s, house, `${def.title}: you turn the whisper away.`);
  apply(s, def.price, house);
  const dark = has(s, house, B.dark) ? B.darkPct : 0;
  const [roll, marked] = withRng(s, (rng) => [rng.int(100), rng.int(100) < def.mark] as const);
  if (marked) s.houses[house]!.pactMarks += 1;
  const promised = roll < B.promisedPct + dark;
  const nothing = !promised && roll < B.promisedPct + B.nothingPct;
  if (def.boon) {
    if (promised) apply(s, def.boon, house);
    else if (!nothing) apply(s, scale(def.boon, B.twistScale), house);
    note(s, house, `${def.title}: ${promised ? def.promise : nothing ? "nothing comes of it." : "it comes, but less than was promised."}`);
  } else {
    const bane = has(s, house, B.grudge) ? scale(def.bane!, B.grudgeScale) : def.bane!;
    // The bargainer cannot see a rival's misfortune: as promised or not, it reads the same.
    note(s, house, `${def.title}: ${def.promise}`);
    const victim = promised ? m.target! : nothing ? null : house;
    if (victim !== null) {
      apply(s, bane, victim);
      note(s, victim, def.misfortune!);
    }
  }
  // A Watchtower at L3 sometimes sees the light burn, never whose (§14.7a).
  s.houses.forEach((h, i) => {
    if (i === house || (h.buildings.watchtower ?? 0) < 3) return;
    if (withRng(s, (rng) => rng.int(100) < B.watchPct)) note(s, i, "Your watchmen saw a light burning where none should be: some House has struck a bargain with the dark.");
  });
}

/** At the seal: whatever was left unanswered fades, refused. */
export function closeBargains(s: SovState): void {
  for (const b of s.bargains.pending) note(s, b.house, `${BARGAIN_BY_ID.get(b.id)!.title}: the whisper fades, unanswered.`);
  s.bargains.pending = [];
}

/** The bot always refuses (§14.7a). */
export function botBargain(s: SovState, house: number): BargainMove | null {
  const b = s.bargains.pending.find((x) => x.house === house);
  return b ? { type: "bargain", id: b.id, accept: false } : null;
}
