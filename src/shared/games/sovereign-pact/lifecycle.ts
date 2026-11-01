// The rest of a person's life in town (§6.12–6.13): retiring a Scion (their gear back to the stash),
// reinstating one, and a House with no one left, which is Fallen but plays on.
import type { SovState } from "./state.ts";
import { log } from "./year.ts";

export function cannotRetire(s: SovState, house: number, person: number): string | null {
  const p = s.people.find((x) => x.id === person);
  return p && p.host === house && p.status === "scion" ? null : "Only one of your Scions can retire.";
}

/** The Scion retires: their worn gear goes back to the stash (§6.12); their upkeep halves. */
export function retire(s: SovState, person: number): void {
  const p = s.people.find((x) => x.id === person)!;
  p.status = "retired";
  p.gear = {};
  log(s, `${p.name} of House ${s.houses[p.host]!.name} retires.`);
}

export function cannotReinstate(s: SovState, house: number, person: number): string | null {
  const p = s.people.find((x) => x.id === person);
  return p && p.host === house && p.status === "retired" ? null : "Only one of your Retired can return.";
}

/** "Retired" is a status the player sets, not a lock (§6.12): the Scion returns, injuries and all. */
export function reinstate(s: SovState, person: number): void {
  const p = s.people.find((x) => x.id === person)!;
  p.status = "scion";
  log(s, `${p.name} of House ${s.houses[p.host]!.name} takes up arms again.`);
}

/** A House with no Scions, recruits or Retired (§6.13): it still votes, pledges, deals and builds. */
export const fallen = (s: Pick<SovState, "people">, house: number): boolean =>
  !s.people.some((p) => p.host === house && (p.status === "scion" || p.status === "recruit" || p.status === "retired"));
