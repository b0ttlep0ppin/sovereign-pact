// House buildings (§8.3–8.4): starting one costs its materials and Gold at once and it stands at the
// Reckoning, so its benefit starts the next Year. Producers, the Shrine and the Vault pay out at the
// Reckoning; the other buildings' effects are read by the systems they belong to (Insight, the
// Infirmary, the Chapel…), each by its level in `House.buildings`.
import { workers } from "./assign.ts";
import { built } from "./commons.ts";
import { BUILDING_BY_ID, RARE_MATERIALS } from "./content.ts";
import { byPct, econ } from "./houses.ts";
import type { House, Material, SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { withRng } from "./year.ts";

export type Cost = Partial<Record<"gold" | Material, number>>;

const T = TUNING.town;

export const levelOf = (h: House, building: string): number => h.buildings[building] ?? 0;

/** What the next level of `building` costs, or null past level 3 or for an unknown building. */
/** What a level costs; for `house`, its traits' discounts (Scholarly: Insight buildings −20%, §5.7). */
export function buildCost(building: string, level: number, house?: House): Cost | null {
  const def = BUILDING_BY_ID.get(building);
  if (!def || level < 1 || level > 3) return null;
  const cost = T.costs[def.cost][level - 1]!;
  const pct = house && INSIGHT.includes(building) ? econ(house, "insightCostPct") : 0;
  return pct ? Object.fromEntries(Object.entries(cost).map(([k, n]) => [k, byPct(n ?? 0, pct)])) : cost;
}

/** The buildings that raise Insight (§6.4). */
const INSIGHT = ["scriptorium"];

/** A House's upkeep for the Year (§8.1): Gold and Grain per Scion, half for the Retired, Grain per recruit; its traits' %, the Granary. */
export function upkeepDue(s: SovState, house: number): { gold: number; grain: number } {
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
  return { gold: byPct(gold, econ(s.houses[house]!, "upkeepPct")), grain };
}

const has = (h: House, cost: Cost): boolean =>
  Object.entries(cost).every(([k, n]) => (k === "gold" ? h.gold : (h.stores[k] ?? 0)) >= (n ?? 0));

function pay(h: House, cost: Cost, sign: 1 | -1): void {
  for (const [k, n] of Object.entries(cost)) {
    if (k === "gold") h.gold -= sign * (n ?? 0);
    else h.stores[k] = (h.stores[k] ?? 0) - sign * (n ?? 0);
  }
}

/** Why House `house` cannot start `building` now, or null if it can. */
export function cannotBuild(s: SovState, house: number, building: string): string | null {
  const h = s.houses[house]!;
  if (!BUILDING_BY_ID.has(building)) return "There is no such building.";
  if (h.works.includes(building)) return "That building is already going up this Year.";
  if (h.works.length >= T.buildsPerYear) return "Your masons are busy until the Year ends.";
  const cost = buildCost(building, levelOf(h, building) + 1);
  if (!cost) return "That building is already at its highest level.";
  if (!has(h, cost)) return "You cannot pay for it.";
  return null;
}

export function build(s: SovState, house: number, building: string): void {
  const h = s.houses[house]!;
  pay(h, buildCost(building, levelOf(h, building) + 1, h)!, 1);
  h.works.push(building);
}

/** Takes back a build started this Year, refunding it in full. */
export function unbuild(s: SovState, house: number, building: string): boolean {
  const h = s.houses[house]!;
  if (!h.works.includes(building)) return false;
  pay(h, buildCost(building, levelOf(h, building) + 1, h)!, -1);
  h.works = h.works.filter((w) => w !== building);
  return true;
}

/** §8.10 step 2: this Year's builds stand. */
export function completeWorks(s: SovState): void {
  for (const h of s.houses) {
    for (const w of h.works) h.buildings[w] = levelOf(h, w) + 1;
    h.works = [];
  }
}

/** Adds `n` of a material to a House, the Commons taking its tithe (§8.1). */
export function income(s: SovState, h: House, material: string, n: number): void {
  const tithe = Math.round(n * TUNING.economy.tithe);
  s.commons.stores[material] = (s.commons.stores[material] ?? 0) + tithe;
  h.stores[material] = (h.stores[material] ?? 0) + n - tithe;
}

/** §8.10 step 1, the buildings' part: producers, the Shrine's Essence, the Mine's rare finds and the Vault's interest. */
export function produce(s: SovState): void {
  for (const [i, h] of s.houses.entries()) {
    for (const [id, level] of Object.entries(h.buildings)) {
      const made = BUILDING_BY_ID.get(id)?.produces;
      if (made && level) income(s, h, made, T.produce[level - 1]! + TUNING.assignments.work * workers(s, i, id));
    }
    if (levelOf(h, "shrine") >= 1) income(s, h, "essence", T.shrineEssence);
    if (levelOf(h, "mine") >= 3 && s.year % T.mineRareEvery === 0) {
      const rare = withRng(s, (rng) => rng.pick(RARE_MATERIALS).id);
      h.stores[rare] = (h.stores[rare] ?? 0) + 1;
    }
    if (levelOf(h, "vault") >= 2 && h.gold > 0) h.gold += Math.floor((h.gold * T.vaultInterestPct) / 100);
  }
}
