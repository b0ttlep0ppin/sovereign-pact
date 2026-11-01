// Deals between Houses (§8.9) [DECIDED: instant]: one House offers, the other accepts or declines, and
// an accepted deal executes at once. Nothing about the future is a game object. A deal is private to
// its two Houses unless made public, which counts for Renown; every deal honored counts for Intrigue.
// Wards, Mentor loans and facility use join the deal table with Milestone 5.
import type { DealSide, House, SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { log } from "./year.ts";

const D = TUNING.deals;

const stashed = (s: SovState, house: number): Set<number> => {
  const worn = new Set(s.people.flatMap((p) => Object.values(p.gear)));
  return new Set(s.items.filter((i) => i.house === house && !worn.has(i.id)).map((i) => i.id));
};

/** Why `house` cannot hand over `side` now, or null. */
function cannotGive(s: SovState, house: number, side: DealSide): string | null {
  const h = s.houses[house]!;
  const whole = (n: unknown) => Number.isInteger(n) && (n as number) >= 0;
  if (side.gold !== undefined && (!whole(side.gold) || h.gold < side.gold)) return `House ${h.name} cannot pay that Gold.`;
  for (const [k, n] of Object.entries(side.stores ?? {})) if (!whole(n) || (h.stores[k] ?? 0) < (n ?? 0)) return `House ${h.name} does not hold that much ${k}.`;
  const mine = stashed(s, house);
  if (new Set(side.items ?? []).size !== (side.items ?? []).length || (side.items ?? []).some((id) => !mine.has(id))) return `House ${h.name} does not have those items in its stash.`;
  return null;
}

const empty = (side: DealSide) => !side.gold && !Object.values(side.stores ?? {}).some(Boolean) && !(side.items ?? []).length;

export function cannotOffer(s: SovState, from: number, to: number, give: DealSide, get: DealSide): string | null {
  if (s.houses.length < 2) return "There is no other House to deal with.";
  if (!Number.isInteger(to) || to < 0 || to >= s.houses.length || to === from) return "Choose another House.";
  if (empty(give) && empty(get)) return "A deal must move something.";
  if (s.deals.filter((d) => d.from === from).length >= D.maxOpen) return "You have too many offers on the table.";
  return cannotGive(s, from, give);
}

export function offer(s: SovState, from: number, to: number, give: DealSide, get: DealSide, open: boolean): void {
  s.deals.push({ id: s.nextId++, from, to, give, get, open });
}

function add(h: House, k: string, n: number): void {
  if (k === "gold") h.gold += n;
  else h.stores[k] = (h.stores[k] ?? 0) + n;
}

function hand(s: SovState, from: number, to: number, side: DealSide): void {
  const a = s.houses[from]!;
  const b = s.houses[to]!;
  const move = (k: string, n: number) => {
    add(a, k, -n);
    add(b, k, n);
  };
  if (side.gold) move("gold", side.gold);
  for (const [k, n] of Object.entries(side.stores ?? {})) if (n) move(k, n);
  for (const id of side.items ?? []) s.items.find((i) => i.id === id)!.house = to;
}

/** Why `house` cannot accept deal `id`, or null: it must be offered to it, and both sides must still be able to pay. */
export function cannotAccept(s: SovState, house: number, id: number): string | null {
  const d = s.deals.find((x) => x.id === id);
  if (!d || d.to !== house) return "There is no such offer to you.";
  return cannotGive(s, d.from, d.give) ?? cannotGive(s, d.to, d.get);
}

export function accept(s: SovState, id: number): void {
  const d = s.deals.find((x) => x.id === id)!;
  s.deals = s.deals.filter((x) => x !== d);
  hand(s, d.from, d.to, d.give);
  hand(s, d.to, d.from, d.get);
  for (const i of [d.from, d.to]) {
    s.houses[i]!.score.intrigue += D.intrigue;
    if (d.open) s.houses[i]!.score.renown += D.publicRenown;
  }
  if (d.open) log(s, `House ${s.houses[d.from]!.name} and House ${s.houses[d.to]!.name} strike a public deal.`);
  // Offers that can no longer be paid fall away.
  s.deals = s.deals.filter((x) => !cannotGive(s, x.from, x.give));
}

/** Declined by its House, or withdrawn by its maker. */
export function cannotDecline(s: SovState, house: number, id: number): string | null {
  const d = s.deals.find((x) => x.id === id);
  return d && (d.to === house || d.from === house) ? null : "There is no such offer.";
}

export const decline = (s: SovState, id: number): void => void (s.deals = s.deals.filter((x) => x.id !== id));

/** What a House may see of the deal table: its own offers and those made to it, and public ones. */
export const dealsFor = (s: SovState, viewer: number | null) => s.deals.filter((d) => d.open || d.from === viewer || d.to === viewer);
