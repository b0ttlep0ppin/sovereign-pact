// The mandatory arc's stakes (§14.7): what winning or losing each Year's assault does to the rest of the
// campaign. Year 5 (the Tide at the Walls) won unlocks the Bastion of the Gate for the final assault.
// Year 10 (the Hollow Court) lost: the Court's knights raid every expedition after. Year 15 (the Nest)
// lost: more Doom, and Unknown fodder in every pool's fights; won: Doom falls. The final Year ends the
// campaign either way (year.ts). Devastation itself is timeline.ts's.
import { offerCrown } from "./bargains.ts";
import { built } from "./commons.ts";
import type { Combatant } from "./combat/types.ts";
import type { NodeKind, SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";
import type { Rng } from "../../rng.ts";
import { log, mandatoryYears } from "./year.ts";

const A = TUNING.arc;

/** The flags the arc leaves: read by the Commons, the chain, the fights and the Devastation. */
export const ARC = {
  gateWon: "arc_gate_won",
  courtRaids: "arc_court_raids",
  nestLost: "arc_nest_lost",
  bastionUsed: "arc_bastion_used",
} as const;

const flag = (s: SovState, f: string): void => {
  if (!s.flags.includes(f)) s.flags.push(f);
};

/** Which step of the arc this Year is (0 the Tide, 1 the Court, 2 the Nest, 3 the end), or -1. */
export const arcStep = (s: SovState): number => mandatoryYears(s).indexOf(s.year);

/** The Doom a failed mandatory expedition's Devastation adds this Year, if the arc sets its own. */
export const arcDoom = (s: SovState): number | undefined => (arcStep(s) === 2 ? A.nestFailDoom : undefined);

/** A mandatory expedition came home: the arc's stakes for the rest of the campaign. */
export function arcResult(s: SovState, won: boolean): void {
  const step = arcStep(s);
  if (step === 0 && won) {
    flag(s, ARC.gateWon);
    log(s, "The tide breaks on the walls. The Bastion of the Gate may now be raised.");
  }
  if (step === 1 && won) offerCrown(s);
  if (step === 1 && !won) {
    flag(s, ARC.courtRaids);
    log(s, "The Cursed King keeps his crown, and his knights will ride against every expedition from now on.");
  }
  if (step === 2) {
    if (won) {
      s.doom = Math.max(0, s.doom - A.nestWinDoom);
      log(s, "The Nest burns. Doom recedes.");
    } else {
      flag(s, ARC.nestLost);
      log(s, "The Nest still breeds, and the Unknown spill into every land beyond the Gate.");
    }
  }
}

/** The chain with a raid of the Court's knights put in before the boss, once the Court has won (Year 10 lost). */
export function withRaid(s: SovState, rng: Rng, chain: NodeKind[]): NodeKind[] {
  if (!s.flags.includes(ARC.courtRaids)) return chain;
  const at = rng.int(chain.length);
  return [...chain.slice(0, at), "raid", ...chain.slice(at)];
}

/** The final assault, with the Bastion of the Gate standing. */
const bastion = (s: SovState): boolean => s.expedition?.card.type === "mandatory" && arcStep(s) === mandatoryYears(s).length - 1 && built(s, "bastion_of_the_gate") > 0;

/** The Bastion's shields: every Scion starts each battle of the final assault behind one. */
export function bastionShields(s: SovState, party: Combatant[]): void {
  if (!bastion(s)) return;
  for (const u of party) u.statuses.push({ id: "shield", ticks: 0, value: Math.round((u.maxHp * A.bastionShieldPct) / 100) });
}

/** Whether the party may fall back behind the Bastion from a lost battle (once), using it up. */
export function bastionFallBack(s: SovState): boolean {
  if (!bastion(s) || s.flags.includes(ARC.bastionUsed)) return false;
  flag(s, ARC.bastionUsed);
  log(s, "The party falls back behind the Bastion's shields, and regroups.");
  return true;
}
