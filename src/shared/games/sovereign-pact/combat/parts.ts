// The Tinkerer's Components (§12.2): an offer at the start of each turn, the ones kept, and the
// abilities that use them up. Held Components are battle-only and lost when it ends.
import type { Rng } from "../../../rng.ts";
import type { AbilityDef, Combatant } from "./types.ts";

export const PARTS = ["spring", "gear", "powder", "lens", "wire", "vial", "plate", "core"] as const;
export type Part = (typeof PARTS)[number];

/** Scavenge: 3 Components offered (4 with Tinker's Eye), none repeated. */
export function offerParts(rng: Rng, u: Combatant): void {
  const n = u.mods.scavenge ?? 0;
  if (n > 0) u.offer = rng.shuffle(PARTS).slice(0, n);
}

/** How many of the offer a Tinkerer keeps: one, two with Scavenger. */
export const keepLimit = (u: Combatant): number => 1 + (u.mods.keepParts ?? 0);

/** Components `ab` still needs that `u` does not hold (a multiset check). */
export function missingParts(u: Pick<Combatant, "parts">, ab: AbilityDef): string[] {
  const held = [...(u.parts ?? [])];
  const missing: string[] = [];
  for (const p of ab.parts ?? []) {
    const i = held.indexOf(p);
    if (i >= 0) held.splice(i, 1);
    else missing.push(p);
  }
  return missing;
}

/** Uses up the Components `ab` needs. */
export function spendParts(u: Combatant, parts: readonly string[]): void {
  for (const p of parts) {
    const i = (u.parts ?? []).indexOf(p);
    if (i >= 0) u.parts!.splice(i, 1);
  }
}

/** The bots' pick: whatever brings the nearest recipe closest to done, else the first offered. */
export function pickParts(u: Combatant): string[] {
  const offer = [...(u.offer ?? [])];
  const out: string[] = [];
  while (out.length < keepLimit(u) && offer.length) {
    const held = { parts: [...(u.parts ?? []), ...out] };
    const needs = u.abilities
      .filter((a) => a.parts?.length)
      .map((a) => missingParts(held, a))
      .filter((m) => m.length)
      .sort((a, b) => a.length - b.length);
    const want = needs.flat().find((p) => offer.includes(p)) ?? offer[0]!;
    out.push(want);
    offer.splice(offer.indexOf(want), 1);
  }
  return out;
}

/** Takes the kept Components out of the offer (the bots' pick when none are named); the rest are lost. */
export function keepParts(u: Combatant, keep?: string[]): void {
  if (!u.offer) return;
  const pick = keep ?? pickParts(u);
  if (pick.length > keepLimit(u)) throw new Error(`keep at most ${keepLimit(u)}`);
  const offer = [...u.offer];
  for (const p of pick) {
    const i = offer.indexOf(p);
    if (i < 0) throw new Error(`${p} was not offered`);
    offer.splice(i, 1);
  }
  u.parts = [...(u.parts ?? []), ...pick];
  delete u.offer;
}
