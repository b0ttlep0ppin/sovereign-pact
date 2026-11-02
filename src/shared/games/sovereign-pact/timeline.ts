// The timeline (§8.7) and Devastation (§3.3). Events queue consequences on the strip ("in 4 Years the
// guilds remember"); when their Year comes they take that Year's draw in the Omens. Hidden entries show
// as "?" until a Watchtower or the Rift Observatory reveals them. Devastation is what a failed
// mandatory expedition does to the settlement; the Expedition Phase (Milestone 6) calls it.
import { built, loseAccord } from "./commons.ts";
import { TOWN_EVENT_BY_ID } from "./content.ts";
import { damage } from "./effects.ts";
import type { SovState, TimelineEntry } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { log, trackName, withRng } from "./year.ts";

/**
 * Takes the town events due this Year off the strip. A settlement event takes the Year's settlement
 * draw and a House event that House's roll, so a second one due for the same slot waits a Year.
 */
export function dueEvents(s: SovState): TimelineEntry[] {
  // A forcing event (§3.2) goes first: it was foreshadowed for this Year and must not slip.
  const forcing = (t: TimelineEntry) => (TOWN_EVENT_BY_ID.get(t.id)!.forces ? 0 : 1);
  const due = s.timeline.filter((t) => t.year <= s.year && TOWN_EVENT_BY_ID.has(t.id)).sort((a, b) => forcing(a) - forcing(b));
  s.timeline = s.timeline.filter((t) => !due.includes(t));
  const taken = new Set<string>();
  return due.filter((t) => {
    const slot = TOWN_EVENT_BY_ID.get(t.id)!.scope === "house" ? `house ${t.house ?? 0}` : "settlement";
    if (taken.has(slot)) {
      s.timeline.push({ ...t, year: s.year + 1 });
      return false;
    }
    taken.add(slot);
    return true;
  });
}

/** Whether a House may read the strip's hidden entries. */
export const seesHidden = (s: SovState, viewer: number | null): boolean =>
  built(s, "rift_observatory") > 0 || (viewer !== null && (s.houses[viewer]?.buildings.watchtower ?? 0) > 0);

/** The strip as a House sees it: hidden entries show only their Year. */
export const timelineFor = (s: SovState, viewer: number | null): { year: number; id: string; house?: number }[] => {
  const all = seesHidden(s, viewer);
  return s.timeline.map((t) => {
    // Another House's own event to come (Q89): its Year and House only, whatever the Watchtower sees.
    if (t.house !== undefined && t.house !== viewer && TOWN_EVENT_BY_ID.get(t.id)?.scope === "house") return { year: t.year, id: "?", house: t.house };
    return { year: t.year, id: t.hidden && !all ? "?" : t.id, ...(t.house === undefined || (t.hidden && !all) ? {} : { house: t.house }) };
  });
};

/** How many Years ahead a mandatory expedition is foreshadowed (§3.2; the Observatory adds one, §8.5). */
export const foreshadow = (s: SovState): number => 2 + (built(s, "rift_observatory") ? 1 : 0);

/**
 * A failed mandatory (or forced) expedition: building levels ruined across the settlement, a share of
 * every store lost, the next arrivals cancelled, the trust track and Doom. Walls soften all but the stores.
 */
export function devastate(s: SovState, kind: "mandatory" | "forced"): void {
  const D = TUNING.devastation[kind];
  const walls = built(s, "walls");
  const [lo, hi] = D.ruin;
  const ruin = Math.max(0, withRng(s, (rng) => lo + rng.int(hi - lo + 1)) - walls);
  log(s, kind === "mandatory" ? "Devastation: the expedition failed, and the settlement pays for it." : "The forced expedition failed, and the town pays for it.");
  for (let n = 0; n < ruin; n++) {
    const standing = s.houses.flatMap((h, i) => Object.keys(h.buildings).flatMap((b) => (h.buildings[b] ? [[i, b] as const] : [])));
    if (!standing.length) break;
    const [i, b] = withRng(s, (rng) => rng.pick(standing));
    damage(s, i, b);
  }
  if (D.storesPct) {
    for (const store of [...s.houses.map((h) => h.stores), s.commons.stores]) {
      for (const [k, n] of Object.entries(store)) store[k] = (n ?? 0) - Math.round(((n ?? 0) * D.storesPct) / 100);
    }
    log(s, `The stores lose ${D.storesPct}% of everything they held.`);
  }
  if (D.noArrivals && !s.flags.includes("no_arrivals")) s.flags.push("no_arrivals");
  loseAccord(s, D.accord);
  s.doom = Math.min(100, s.doom + Math.max(0, D.doom - walls * TUNING.devastation.wallsDoom));
  log(s, `${trackName(s)} and Doom move against the kingdom.`);
}
