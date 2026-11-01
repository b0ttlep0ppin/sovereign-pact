// The settlement bot (HANDOFF §3.4): cautious. It never spends the Gold it needs for next Year's
// upkeep, and it builds along a fixed plan: food first if the House cannot feed itself, then
// materials, then the buildings that keep Scions alive and growing.
import type { SovState } from "./state.ts";
import { buildCost, cannotBuild, levelOf } from "./town.ts";
import { forHouses, TUNING } from "./tuning.ts";

/** Building and level, in the order the bot wants them. */
const PLAN: readonly (readonly [string, number])[] = [
  ["lumber_camp", 1],
  ["quarry", 1],
  ["infirmary", 1],
  ["lumber_camp", 2],
  ["chapel", 1],
  ["training_ground", 1],
  ["scriptorium", 1],
  ["mine", 1],
  ["forge", 1],
  ["quarry", 2],
  ["infirmary", 2],
  ["chapel", 2],
  ["mine", 2],
  ["vault", 1],
  ["shrine", 1],
  ["training_ground", 2],
  ["scriptorium", 2],
  ["forge", 2],
  ["watchtower", 1],
  ["workshop", 1],
  ["hall_of_petitions", 1],
  ["quarry", 3],
  ["mine", 3],
  ["infirmary", 3],
  ["chapel", 3],
  ["vault", 2],
  ["training_ground", 3],
  ["scriptorium", 3],
  ["forge", 3],
  ["crypt", 1],
  ["kennels", 1],
];

/** Gold a House pays in upkeep a Year (§6.2), the bot's reserve. */
export function upkeepGold(s: SovState, house: number): number {
  const u = TUNING.economy.upkeep;
  return s.people.reduce((sum, p) => sum + (p.host !== house ? 0 : p.status === "scion" ? u.scionGold : p.status === "retired" ? Math.ceil(u.scionGold / 2) : 0), 0);
}

const grainNeed = (s: SovState, house: number): number => {
  const u = TUNING.economy.upkeep;
  return s.people.reduce((sum, p) => sum + (p.host !== house || p.status === "lost" ? 0 : p.status === "scion" ? u.scionGrain : p.status === "retired" ? Math.ceil(u.scionGrain / 2) : u.recruitGrain), 0);
};

/** The building the bot starts next for `house`, or null. */
export function botBuild(s: SovState, house: number): string | null {
  const h = s.houses[house]!;
  const reserve = upkeepGold(s, house);
  // Food first while the Year's Grain falls short of the House's mouths and the stock will not cover two Years.
  const farm = levelOf(h, "farm");
  const grainIn = (TUNING.economy.income.grain * forHouses(TUNING.economy.incomeScale, s.houses.length) + (farm ? TUNING.town.produce[farm - 1]! : 0)) * (1 - TUNING.economy.tithe);
  const short = grainIn < grainNeed(s, house) && (h.stores.grain ?? 0) < 2 * grainNeed(s, house);
  const wants = short ? [["farm", farm + 1] as const, ...PLAN] : PLAN;
  for (const [id, level] of wants) {
    if (levelOf(h, id) + 1 !== level) continue;
    if (cannotBuild(s, house, id)) continue;
    if (h.gold - (buildCost(id, level)!.gold ?? 0) < reserve) continue;
    return id;
  }
  return null;
}
