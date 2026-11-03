// The Altar of Offerings (a Commons project; Josh 2026-11-03: "some let you sacrifice small stuff for an
// expedition bonus"): once a Year, before the Rift Gate opens, a House lays something on the altar, and its
// Scions carry what the altar gives back on that Year's expedition. The offering is gone at the Reckoning.
import { built } from "./commons.ts";
import { recordOmen } from "./omens.ts";
import type { Offering, SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { log } from "./year.ts";

const A = TUNING.commons.altar;
export const OFFERINGS = Object.keys(A) as Offering[];

export function cannotLay(s: SovState, house: number, gift: string): string | null {
  if (!built(s, "altar_of_offerings")) return "The Altar of Offerings does not stand in the Commons.";
  const h = s.houses[house]!;
  if (h.offering) return "Your House has made its offering this Year.";
  const o = A[gift as Offering];
  if (!o) return "The altar does not take that.";
  if ("grain" in o && (h.stores.grain ?? 0) < o.grain) return `The altar asks ${o.grain} Grain, and you have not got it.`;
  if ("recruits" in o && !s.people.some((p) => p.host === house && p.status === "recruit")) return "The altar asks a recruit, and you have none.";
  if ("sanity" in o && !s.people.some((p) => p.host === house && p.status === "scion")) return "The altar asks your Scions' blood, and you have no Scions.";
  return null;
}

/** Lays the offering down: Grain, the last-sworn recruit, or Sanity from every Scion of the House. */
export function lay(s: SovState, house: number, gift: Offering): void {
  const h = s.houses[house]!;
  const o = A[gift];
  recordOmen(s, "altar:offering", undefined, house, `Lays ${o.told} on the Altar of Offerings.`, `Its Scions carry the altar's gift on this Year's expedition: ${o.text}`, () => pay(s, house, gift));
  h.offering = gift;
  // Public: the altar stands in the Commons, and everyone sees what is laid on it.
  log(s, `House ${h.name} lays ${o.told} on the Altar of Offerings.`);
}

function pay(s: SovState, house: number, gift: Offering): void {
  const h = s.houses[house]!;
  const o = A[gift];
  if ("grain" in o) h.stores.grain = (h.stores.grain ?? 0) - o.grain;
  if ("recruits" in o) {
    const gone = s.people.filter((p) => p.host === house && p.status === "recruit").at(-1)!;
    s.people = s.people.filter((p) => p !== gone);
    delete s.assign[gone.id];
  }
  if ("sanity" in o) for (const p of s.people) if (p.host === house && p.status === "scion") p.sanity = Math.max(0, p.sanity - o.sanity);
}

/** What the altar gives a House's Scions this Year, for the battle mods. */
export const offeringMods = (s: SovState, house: number): Record<string, number> => {
  const gift = s.houses[house]?.offering;
  return gift ? { ...A[gift].mods } : {};
};
