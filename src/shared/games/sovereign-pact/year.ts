// The Year (§3.1): Omens → Settlement Phase → Expedition Phase → Reckoning. The Settlement Phase is the
// only step that waits for players so far; the others resolve on their own until their milestones
// (Omens and Reckoning: 4, the Expedition Phase: 6) give them decisions.
import { createRng, type Rng } from "../../rng.ts";
import { rollRecruit } from "./generate.ts";
import { yearOfAssignments } from "./assign.ts";
import { maxMp } from "./formulas.ts";
import type { House, SovState } from "./state.ts";
import { built, completeProjects } from "./commons.ts";
import { completeWorks, produce } from "./town.ts";
import { settleVote } from "./votes.ts";
import { resolveCrisis } from "./crisis.ts";
import { closeEvents, drawOmens } from "./omens.ts";
import { restock, settleAuctions } from "./market.ts";
import { foreshadow } from "./timeline.ts";
import { forHouses, TUNING } from "./tuning.ts";

/** A deep copy, so a rule never changes the state it was given (plain JSON, so this is exact). */
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const campaignYears = (s: Pick<SovState, "opts">): number => TUNING.campaign.years[s.opts.length];
export const mandatoryYears = (s: Pick<SovState, "opts">): readonly number[] => TUNING.campaign.mandatoryYears[s.opts.length];
/** "Accord" with two or more Houses, "Unrest" solo (§3.3). */
export const trackName = (s: Pick<SovState, "houses">): "Accord" | "Unrest" => (s.houses.length === 1 ? "Unrest" : "Accord");

export function log(s: SovState, line: string): void {
  s.log.push(line);
  if (s.log.length > TUNING.logLines) s.log.splice(0, s.log.length - TUNING.logLines);
}

/** Runs `fn` with the state's own RNG, then stores where the sequence got to. */
export function withRng<T>(s: SovState, fn: (rng: Rng) => T): T {
  const rng = createRng(s.rng);
  const out = fn(rng);
  s.rng = rng.seed();
  return out;
}

/** Opens Year `s.year`: Omens, then the Settlement Phase. */
export function openYear(s: SovState): void {
  s.phase = "omens";
  log(s, `Year ${s.year} of ${campaignYears(s)}.`);
  const due = mandatoryYears(s).filter((y) => y > s.year && y - s.year <= foreshadow(s));
  for (const y of due) log(s, `The timeline darkens: a mandatory expedition comes in Year ${y}.`);
  // Omens: the settlement event (perhaps a Crisis) and the House events (§8.8).
  drawOmens(s);
  restock(s);
  s.phase = "settlement";
  s.phaseMoves = 0;
  s.proposers = [];
  for (const h of s.houses) h.sealed = false;
}

/** Everyone sealed: the Expedition Phase, the Reckoning, and the next Year (or the end). */
export function closeSettlement(s: SovState): void {
  // An open vote is settled with the votes cast; the rest abstain.
  settleVote(s);
  closeEvents(s);
  settleAuctions(s);
  // Offers left on the table lapse.
  s.deals = [];
  resolveCrisis(s);
  s.phase = "expedition";
  // The Rift Gate, the party and the chain go here (Milestone 6).
  log(s, "No expedition departs: the Rift Gate is not yet built.");
  reckoning(s);
}

function payUpkeep(s: SovState, house: number, h: House): void {
  const u = TUNING.economy.upkeep;
  let gold = 0;
  let grain = 0;
  for (const p of s.people) {
    if (p.host !== house || p.status === "lost") continue;
    if (p.status === "scion") {
      gold += u.scionGold;
      grain += u.scionGrain;
    } else if (p.status === "retired") {
      gold += Math.ceil(u.scionGold / 2);
      grain += Math.ceil(u.scionGrain / 2);
    } else grain += u.recruitGrain;
  }
  if (built(s, "granary")) grain = Math.round((grain * (100 - TUNING.commons.granaryUpkeepPct)) / 100);
  // §8.1: Grain runs out first (the Scions go Hungry), then Gold becomes Debt.
  const stock = h.stores.grain ?? 0;
  h.stores.grain = Math.max(0, stock - grain);
  if (h.gold >= gold) h.gold -= gold;
  else {
    h.debt += gold - h.gold;
    h.gold = 0;
  }
}

/** §8.10, the parts that exist so far: income and tithe, upkeep, buildings, recovery, the tracks, arrivals. */
export function reckoning(s: SovState): void {
  s.phase = "reckoning";
  const H = s.houses.length;
  const scale = forHouses(TUNING.economy.incomeScale, H);
  produce(s);
  s.houses.forEach((h, i) => {
    const gold = Math.round(TUNING.economy.income.gold * scale);
    const grain = Math.round(TUNING.economy.income.grain * scale);
    const titheGold = Math.round(gold * TUNING.economy.tithe);
    const titheGrain = Math.round(grain * TUNING.economy.tithe);
    s.commons.gold += titheGold;
    s.commons.stores.grain = (s.commons.stores.grain ?? 0) + titheGrain;
    h.gold += gold - titheGold;
    h.stores.grain = (h.stores.grain ?? 0) + grain - titheGrain;
    if (built(s, "great_market")) {
      const titheMarket = Math.round(TUNING.commons.marketGold * TUNING.economy.tithe);
      s.commons.gold += titheMarket;
      h.gold += TUNING.commons.marketGold - titheMarket;
    }
    payUpkeep(s, i, h);
  });
  completeWorks(s);
  completeProjects(s);
  // Injuries tick down, everyone recovers and grows by assignment, and MP refills (§8.3, §8.10).
  yearOfAssignments(s);
  for (const p of s.people) p.mp = maxMp(p);
  s.doom = Math.min(100, s.doom + TUNING.tracks.doomPerYear);
  arrivals(s);
  if (s.doom >= 100) return end(s, false, `The city was overwhelmed in Year ${s.year}.`);
  if (s.accord <= 0) return end(s, false, H === 1 ? `The people rose against their lords in Year ${s.year}.` : `The Houses turned on each other in Year ${s.year}.`);
  if (s.year >= campaignYears(s)) return end(s, true, `The kingdom endured ${s.year} Years.`);
  s.year += 1;
  openYear(s);
}

/** Recruit arrivals per House (§6.2); a full pool turns them away. */
function arrivals(s: SovState): void {
  // A Devastation turns the roads empty for a Year (§3.3).
  if (s.flags.includes("no_arrivals")) {
    s.flags = s.flags.filter((f) => f !== "no_arrivals");
    return log(s, "No one comes to the settlement this Year: the roads remember the Devastation.");
  }
  withRng(s, (rng) => {
    // Not logged: a House's recruit pool is its own business (§6.9 counts it among the secrets a Ward can leak).
    s.houses.forEach((_, i) => {
      const boosts = (built(s, "beacon") ? 1 : 0) + ((s.houses[i]!.buildings.hall_of_petitions ?? 0) >= 1 ? 1 : 0);
      const chance = forHouses(TUNING.houses.arrivalChance, s.houses.length) * (1 + (boosts * TUNING.commons.arrivalBoostPct) / 100);
      if (rng.int(100) >= chance) return;
      const pool = s.people.filter((p) => p.host === i && p.status === "recruit").length;
      if (pool >= TUNING.houses.recruitPoolCap) return;
      s.people.push(rollRecruit(rng, s.nextId++, i));
    });
  });
}

function end(s: SovState, won: boolean, reason: string): void {
  s.phase = "over";
  s.outcome = { won, reason };
  log(s, reason);
}
