// Wards (§6.9) [DECIDED model, numbers to tune]: a Scion given to another House in a deal. The Ward
// keeps their blood (traits, element, emblem); the host outfits them, though a cursed item they wear
// goes with them. Loyalty 0–100 is hidden from both Houses (the host reads it with Insight 3). Below 50
// the Ward may leak a secret of the host's to their birth House each Year; at 80 they are Sworn, the
// host's entirely, and may be given onward; at 10 or less they may slip home between Years.
import { ascendancy } from "./score.ts";
import type { Person, SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { log, note, withRng } from "./year.ts";

const W = TUNING.wards;

export const isWard = (p: Person): boolean => p.house !== p.host;
export const sworn = (p: Person): boolean => isWard(p) && (p.loyalty ?? 0) >= W.sworn;

/** Why House `from` cannot give person `id` to House `to` as a Ward, or null. */
export function cannotGiveWard(s: SovState, from: number, to: number, id: number): string | null {
  const p = s.people.find((x) => x.id === id);
  if (!p || p.host !== from || p.status !== "scion") return "Only a Scion of your House can be given as a Ward.";
  if (!isWard(p)) return null;
  if (to === p.house) return s.year - (p.wardSince ?? 0) < W.noReturnYears ? `A Ward cannot be given back within ${W.noReturnYears} Years.` : null;
  return sworn(p) ? null : "Only a Sworn Ward may be given onward.";
}

/** Where a new Ward's Loyalty starts: lower from a Bad Blood House, higher with a Hound-Loyal host. */
export function startingLoyalty(s: SovState, p: Person, host: number): number {
  if (s.houses[p.house]!.traits.includes("bad_blood")) return W.badBlood;
  if (s.houses[host]!.traits.includes("hound_loyal")) return W.houndLoyal;
  return W.start;
}

/** The person moves to House `to`: their gear stays in the old host's stash, but a cursed piece goes with them. */
function move(s: SovState, p: Person, to: number): void {
  for (const [slot, item] of Object.entries(p.gear)) {
    const it = s.items.find((i) => i.id === item);
    if (it?.cursed) it.house = to;
    else delete p.gear[slot as keyof typeof p.gear];
  }
  delete s.assign[p.id];
  p.host = to;
  if (to === p.house) {
    delete p.loyalty;
    delete p.wardSince;
  }
}

/** The Scion goes to House `to` as its Ward, or home. */
export function giveWard(s: SovState, _from: number, to: number, id: number): void {
  const p = s.people.find((x) => x.id === id)!;
  const onward = isWard(p);
  move(s, p, to);
  if (to === p.house) return;
  // A Sworn Ward given onward keeps their Loyalty: it is the bond to their birth House that matters.
  if (!onward) p.loyalty = startingLoyalty(s, p, to);
  p.wardSince = s.year;
}

/**
 * Valor or Lore a Ward earns (§6.9): the host's at Loyalty %, the birth House's at the rest; all the
 * host's once Sworn. The Expedition Phase (Milestone 6) calls this as Wards earn.
 */
export function creditWard(s: SovState, p: Person, category: "valor" | "lore", points: number): void {
  const share = !isWard(p) || sworn(p) ? 100 : (p.loyalty ?? 0);
  const host = Math.round((points * share) / 100);
  s.houses[p.host]!.score[category] += host;
  s.houses[p.house]!.score[category] += points - host;
}

/** A secret of the host's, as the birth House hears it. */
function secret(s: SovState, rng: { int(n: number): number }, p: Person): string {
  const h = s.houses[p.host]!;
  const pool = s.people.filter((x) => x.host === p.host && x.status === "recruit").length;
  const told = [
    `${p.name} writes that House ${h.name} holds ${h.gold} Gold and owes ${h.debt}.`,
    `${p.name} writes that House ${h.name} stands at ${ascendancy(s, p.host)} Ascendancy.`,
    `${p.name} writes that House ${h.name} has ${pool} recruit${pool === 1 ? "" : "s"} waiting.`,
  ];
  return told[rng.int(told.length)]!;
}

/** The Reckoning's Ward step: leaks below 50 (Hound-Loyal hosts leak less), and the Estranged slipping home. */
export function wardYear(s: SovState): void {
  withRng(s, (rng) => {
    for (const p of s.people) {
      if (!isWard(p) || p.status === "lost" || sworn(p)) continue;
      const loyalty = p.loyalty ?? W.start;
      if (loyalty <= W.estranged && rng.int(100) < W.defectPct) {
        log(s, `${p.name} slips away from House ${s.houses[p.host]!.name} and returns to House ${s.houses[p.house]!.name}.`);
        move(s, p, p.house);
        continue;
      }
      const hound = s.houses[p.host]!.traits.includes("hound_loyal");
      const chance = hound ? (W.leakPct * (100 - W.houndLeakCut)) / 100 : W.leakPct;
      if (loyalty < W.leakBelow && rng.int(100) < chance) note(s, p.house, secret(s, rng, p));
    }
  });
}
