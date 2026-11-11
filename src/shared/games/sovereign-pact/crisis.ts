// Crises (§3.5): a settlement event the Houses meet by private pledges. The result is the share of the
// Need pledged (each resource counting up to its own Need), moved by a hidden swing of about ±20 and by
// every temptation taken; it falls in a band from Triumph to Calamity. Only the total is ever shown, and
// a Crisis can fail even when everyone gave fully, so a failure proves nothing.
import { TOWN_EVENT_BY_ID, type TownEventDef } from "./content.ts";
import { applyEffects } from "./effects.ts";
import { recordOmen } from "./omens.ts";
import type { SovState } from "./state.ts";
import { forHouses, TUNING } from "./tuning.ts";
import { log, withRng } from "./year.ts";

const C = TUNING.crises;

/** A Year as a 20-Year campaign counts it (the Short campaign runs twice as fast). */
export const year20 = (s: SovState): number => (s.opts.length === "short" ? s.year * 2 : s.year);

export function yearBand(s: SovState): keyof typeof C.needScale {
  const y = year20(s);
  return y <= 6 ? "early" : y <= 13 ? "mid" : "late";
}

/** Whether an event may be drawn this Year: its Years, and its `requires` (a building is the House's own for a House event). */
export function eligible(s: SovState, ev: TownEventDef, house?: number): boolean {
  const y = year20(s);
  // A forcing event comes only from the timeline, a Year after it is foreshadowed (§3.2).
  if (ev.forces || ev.chained || y < ev.years[0] || y > ev.years[1]) return false;
  return (ev.requires ?? []).every((r) => {
    const not = r.startsWith("!");
    const [kind, id] = r.replace(/^!/, "").split(":") as [string, string];
    const yes =
      kind === "flag" ? s.flags.includes(id) : kind === "built" ? !!s.commons.built[id] : house !== undefined ? !!s.houses[house]!.buildings[id] : s.houses.some((h) => h.buildings[id]);
    return yes !== not;
  });
}

/** Opens a drawn Crisis, its Need scaled to the Year band and the kingdom's size. */
export function openCrisis(s: SovState, ev: TownEventDef): void {
  // The kingdom's income, against four Houses', sizes the Need (§4.3).
  const H = s.houses.length;
  const scale = C.needScale[yearBand(s)] * ((H * forHouses(TUNING.economy.incomeScale, H)) / 4);
  const need = Object.fromEntries(Object.entries(ev.crisis!.need).map(([k, n]) => [k, Math.round((n ?? 0) * scale)]));
  s.crisis = { id: ev.id, need, pledges: s.houses.map(() => ({})), tempted: s.houses.map(() => false) };
  log(s, `Crisis: ${ev.title}. The city needs ${describe(need)}.`);
}

const describe = (r: Partial<Record<string, number>>) => Object.entries(r).map(([k, n]) => `${n} ${k[0]!.toUpperCase()}${k.slice(1)}`).join(" and ");

/**
 * How much more of `k` House `house` may pledge (Josh 2026-11-11: "you shouldn't be able to pledge more than
 * is needed"): the Need less its own pledge and the Commons' gift. Other Houses' pledges stay private, so
 * they do not count here; what the Houses give together beyond the Need still goes back at the seal.
 */
export function crisisRoom(s: SovState, house: number, k: string): number {
  const c = s.crisis;
  if (!c) return 0;
  return Math.max(0, (c.need[k] ?? 0) - (c.pledges[house]![k] ?? 0) - (c.commons?.[k] ?? 0));
}

export function cannotCrisisPledge(s: SovState, house: number, give: Partial<Record<string, number>>): string | null {
  if (!s.crisis) return "There is no Crisis this Year.";
  const h = s.houses[house]!;
  const parts = Object.entries(give).filter(([, n]) => (n ?? 0) > 0);
  if (!parts.length || parts.some(([k, n]) => !Number.isInteger(n) || !(k in s.crisis!.need))) return "Pledge whole amounts of what the Crisis needs.";
  if (parts.some(([k, n]) => (k === "gold" ? h.gold : (h.stores[k] ?? 0)) < (n ?? 0))) return "You do not have that much to give.";
  const over = parts.find(([k, n]) => (n ?? 0) > crisisRoom(s, house, k));
  if (over) return `The city needs only ${crisisRoom(s, house, over[0])} more ${over[0]} from you.`;
  return null;
}

/** A private pledge: it leaves the House now and is spent on the Crisis whatever the result. */
export function crisisPledge(s: SovState, house: number, give: Partial<Record<string, number>>): void {
  const h = s.houses[house]!;
  const mine = s.crisis!.pledges[house]!;
  for (const [k, n] of Object.entries(give)) {
    if (!n) continue;
    if (k === "gold") h.gold -= n;
    else h.stores[k] = (h.stores[k] ?? 0) - n;
    mine[k] = (mine[k] ?? 0) + n;
  }
}

export function cannotTempt(s: SovState, house: number): string | null {
  if (!s.crisis || !TOWN_EVENT_BY_ID.get(s.crisis.id)!.crisis!.temptation) return "Nothing tempts you this Year.";
  if (s.crisis.tempted[house]) return "You have already given in.";
  return null;
}

/** Gives in to the temptation: the House gains, the Crisis result loses its penalty. Nobody else knows. */
export function tempt(s: SovState, house: number): void {
  s.crisis!.tempted[house] = true;
  applyEffects(s, TOWN_EVENT_BY_ID.get(s.crisis!.id)!.crisis!.temptation!.effects, house, false);
}

/** All that went to the Crisis of resource `k`: the Houses' pledges and the Commons' gift. */
const given = (c: NonNullable<SovState["crisis"]>, k: string) => c.pledges.reduce((t, p) => t + (p[k] ?? 0), 0) + (c.commons?.[k] ?? 0);

/** What the Commons could give the Crisis from its stock: each needed resource, up to its Need. */
export function commonsCrisisGift(s: SovState): Partial<Record<string, number>> {
  const c = s.crisis;
  if (!c) return {};
  const out: Partial<Record<string, number>> = {};
  for (const [k, n] of Object.entries(c.need)) {
    const has = k === "gold" ? s.commons.gold : (s.commons.stores[k] ?? 0);
    const give = Math.min(has, n ?? 0);
    if (give > 0) out[k] = give;
  }
  return out;
}

/** Why the Commons cannot be asked to give to the Crisis now, or null. */
export function cannotAskCommons(s: SovState): string | null {
  if (!s.crisis) return "There is no Crisis this Year.";
  if (s.crisis.asked) return "The Commons has already been asked this Year.";
  if (s.vote) return "A vote is already open.";
  if (!Object.keys(commonsCrisisGift(s)).length) return "The Commons holds nothing the Crisis needs.";
  return null;
}

/** The vote passed: the Commons gives what it holds of the Need. Returns what it gave. */
export function commonsGive(s: SovState): Partial<Record<string, number>> {
  const c = s.crisis;
  if (!c) return {};
  const gift = commonsCrisisGift(s);
  for (const [k, n] of Object.entries(gift)) {
    if (k === "gold") s.commons.gold -= n!;
    else s.commons.stores[k] = (s.commons.stores[k] ?? 0) - n!;
    (c.commons ??= {})[k] = (c.commons[k] ?? 0) + n!;
  }
  return gift;
}

/** The Crisis's result in points before the swing: the pledged share of the Need, less the temptations. */
export function crisisScore(s: SovState): number {
  const c = s.crisis!;
  const need = Object.values(c.need).reduce<number>((a, n) => a + (n ?? 0), 0);
  const met = Object.entries(c.need).reduce((a, [k, n]) => a + Math.min(n ?? 0, given(c, k)), 0);
  const penalty = TOWN_EVENT_BY_ID.get(c.id)!.crisis!.temptation?.penalty ?? 0;
  return (met * 100) / Math.max(1, need) - penalty * c.tempted.filter(Boolean).length;
}

export function bandOf(score: number): "triumph" | "holds" | "falters" | "calamity" {
  return score >= C.bands.triumph ? "triumph" : score >= C.bands.holds ? "holds" : score >= C.bands.falters ? "falters" : "calamity";
}

/**
 * Josh 2026-11-02: what the Houses pledge beyond a resource's Need goes back to them in proportion to
 * what each gave (whole units, the odd ones to the largest remainders, then the earlier House). The
 * pledges then hold only what the city used, which is what earns Renown.
 */
export function refundExcess(s: SovState): void {
  const c = s.crisis;
  if (!c) return;
  let refunded = false;
  for (const [k, need] of Object.entries(c.need)) {
    // The Commons only tops up what the Houses leave short: its gift goes back first (Josh 2026-11-11).
    const spare = Math.min(c.commons?.[k] ?? 0, given(c, k) - (need ?? 0));
    if (spare > 0) {
      c.commons![k]! -= spare;
      if (k === "gold") s.commons.gold += spare;
      else s.commons.stores[k] = (s.commons.stores[k] ?? 0) + spare;
      log(s, `The Commons takes back ${spare} ${k} the city did not need.`);
    }
    const total = c.pledges.reduce((a, p) => a + (p[k] ?? 0), 0);
    const excess = total - Math.max(0, (need ?? 0) - (c.commons?.[k] ?? 0));
    if (excess <= 0) continue;
    const shares = c.pledges.map((p, i) => ({ i, exact: ((p[k] ?? 0) * excess) / total }));
    const back = shares.map((x) => Math.floor(x.exact));
    let left = excess - back.reduce((a, n) => a + n, 0);
    for (const x of [...shares].sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)) || a.i - b.i)) {
      if (left <= 0) break;
      back[x.i]!++;
      left--;
    }
    back.forEach((n, i) => {
      if (!n) return;
      const h = s.houses[i]!;
      if (k === "gold") h.gold += n;
      else h.stores[k] = (h.stores[k] ?? 0) + n;
      c.pledges[i]![k] = (c.pledges[i]![k] ?? 0) - n;
      refunded = true;
    });
  }
  if (refunded) log(s, "The Houses gave more than the city needed; what was left over goes back to each House in proportion to what it gave.");
}

/** At the Year's seal: the swing, the band and its effects, and Renown by what each House pledged. */
export function resolveCrisis(s: SovState): void {
  const c = s.crisis;
  if (!c) return;
  const ev = TOWN_EVENT_BY_ID.get(c.id)!;
  const swing = withRng(s, (rng) => rng.int(2 * C.swing + 1) - C.swing);
  const band = bandOf(crisisScore(s) + swing);
  const total = Object.keys(c.need).reduce<Record<string, number>>((t, k) => ({ ...t, [k]: given(c, k) }), {});
  log(s, `${ev.title}: the ${c.commons ? "Houses and the Commons" : "Houses"} gave ${describe(total) || "nothing"} of ${describe(c.need)}. ${band[0]!.toUpperCase()}${band.slice(1)}. ${ev.crisis![band].text}`);
  refundExcess(s);
  c.pledges.forEach((p, i) => {
    const units = Object.values(p).reduce<number>((a, n) => a + (n ?? 0), 0);
    s.houses[i]!.score.renown += Math.floor(units / C.renownPer);
  });
  delete s.crisis;
  recordOmen(s, ev.id, undefined, null, `${band[0]!.toUpperCase()}${band.slice(1)}.`, ev.crisis![band].text, () => applyEffects(s, ev.crisis![band].effects, null));
}
