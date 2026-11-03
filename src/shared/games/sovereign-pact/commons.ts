// Shared projects (§8.5–8.6): built in the Commons from pledges (public and final) and, by vote, from
// the tithe. A project's level stands at the Reckoning of the Year it is fully paid for, and benefits
// every House; contributors are credited only through Renown, by the share they pledged.
import { PROJECT_BY_ID, PROJECTS } from "./content.ts";
import type { ProjectFund, SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { log } from "./year.ts";

const C = TUNING.commons;

/** Whether a shared project stands (at any level). */
export const built = (s: SovState, project: string): number => s.commons.built[project] ?? 0;

/** The full cost of a project's next level, or null if it is complete, unknown, or waits on another. */
export function projectCost(s: SovState, project: string): Partial<Record<string, number>> | null {
  const def = PROJECT_BY_ID.get(project);
  if (!def) return null;
  const level = built(s, project);
  if (level >= def.tiers.length || (def.requires && !built(s, def.requires)) || (def.unlockedBy && !s.flags.includes(def.unlockedBy))) return null;
  const base = TUNING.town.costs[def.cost][def.tiers[level]! - 1]!;
  return Object.fromEntries(Object.entries(base).map(([k, n]) => [k, Math.round((n ?? 0) * C.costMult)]));
}

/** What a project's next level still needs, by resource. */
export function stillNeeded(s: SovState, project: string): Partial<Record<string, number>> {
  const cost = projectCost(s, project) ?? {};
  const paid = s.commons.funds[project]?.paid ?? {};
  return Object.fromEntries(Object.entries(cost).map(([k, n]) => [k, Math.max(0, (n ?? 0) - (paid[k] ?? 0))]).filter(([, n]) => (n as number) > 0));
}

const fund = (s: SovState, project: string): ProjectFund =>
  (s.commons.funds[project] ??= { paid: {}, by: s.houses.map(() => 0) });

/** What of `give` a pledge would take: whole, positive amounts, no more than is needed. */
function useful(s: SovState, project: string, give: Partial<Record<string, number>>): [string, number][] {
  const need = stillNeeded(s, project);
  return Object.entries(give).flatMap(([k, n]) => {
    const take = Math.min(Math.floor(n ?? 0), need[k] ?? 0);
    return take > 0 ? [[k, take] as [string, number]] : [];
  });
}

/** Why House `house` cannot make that pledge, or null. */
export function cannotPledge(s: SovState, house: number, project: string, give: Partial<Record<string, number>>): string | null {
  if (!PROJECT_BY_ID.has(project)) return "There is no such project.";
  if (!projectCost(s, project)) return built(s, project) ? "That project is complete." : "That project must wait for another to stand.";
  const h = s.houses[house]!;
  const parts = useful(s, project, give);
  if (!parts.length) return "That pledge gives nothing the project still needs.";
  for (const [k, n] of parts) if ((k === "gold" ? h.gold : (h.stores[k] ?? 0)) < n) return "You do not have that much to give.";
  return null;
}

/** Moves the pledge into the project and grants its Renown (§8.5). Returns the units given. */
export function pledge(s: SovState, house: number, project: string, give: Partial<Record<string, number>>): number {
  const h = s.houses[house]!;
  const f = fund(s, project);
  let units = 0;
  for (const [k, n] of useful(s, project, give)) {
    if (k === "gold") h.gold -= n;
    else h.stores[k] = (h.stores[k] ?? 0) - n;
    f.paid[k] = (f.paid[k] ?? 0) + n;
    units += n;
  }
  f.by[house] = (f.by[house] ?? 0) + units;
  h.score.renown += Math.floor(f.by[house]! / C.renownPer) - Math.floor((f.by[house]! - units) / C.renownPer);
  log(s, `House ${h.name} pledges ${units} to the ${PROJECT_BY_ID.get(project)!.name}.`);
  return units;
}

/** Pays from the Commons' own stock (after a vote) into a project; the tithe earns no one Renown. */
export function spendCommons(s: SovState, project: string): number {
  const f = fund(s, project);
  let units = 0;
  for (const [k, n] of Object.entries(stillNeeded(s, project))) {
    const have = k === "gold" ? s.commons.gold : (s.commons.stores[k] ?? 0);
    const take = Math.min(have, n ?? 0);
    if (take <= 0) continue;
    if (k === "gold") s.commons.gold -= take;
    else s.commons.stores[k] = have - take;
    f.paid[k] = (f.paid[k] ?? 0) + take;
    units += take;
  }
  return units;
}

/** What the Commons' standing projects give every Scion in battle: each project's mods once per level. */
export function commonsMods(s: Pick<SovState, "commons">): Record<string, number> {
  const mods: Record<string, number> = {};
  for (const def of PROJECTS) {
    const level = s.commons.built[def.id] ?? 0;
    if (level) for (const [k, v] of Object.entries(def.mods ?? {})) mods[k] = (mods[k] ?? 0) + v * level;
  }
  return mods;
}

/** §8.10 step 2, the Commons' part: fully paid projects stand. */
export function completeProjects(s: SovState): void {
  for (const def of PROJECTS) {
    if (!s.commons.funds[def.id] || !projectCost(s, def.id) || Object.keys(stillNeeded(s, def.id)).length) continue;
    s.commons.built[def.id] = built(s, def.id) + 1;
    delete s.commons.funds[def.id];
    log(s, `The ${def.name} stands in the Commons.`);
    if (def.id === "court_of_peers" && s.houses.length === 1) s.accord = Math.min(100, s.accord + C.courtUnrest);
  }
}

/** Accord (or Unrest) lost, softened by the Court of Peers (§8.5). */
export function loseAccord(s: SovState, n: number): void {
  const cut = built(s, "court_of_peers") ? Math.round((n * (100 - C.courtAccordPct)) / 100) : n;
  s.accord = Math.max(0, s.accord - cut);
}
