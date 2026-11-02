// Readying Scions in town (§6.6, §12.1, §13.1): buying a Job's abilities with JP, the primary and
// secondary Jobs, equipping passives within the budget, and putting a House's gear on its Scions.
// All of it happens in the Settlement Phase only: on an expedition Jobs, passives and gear are locked
// (§9.2). A House readies its own Scions and the Wards it hosts (§13.4: the host outfits its Wards).
import { ABILITY_SET_BY_JOB, ACTIVE_BY_ID, JOB_BY_ID, JOB_PASSIVE_BY_ID } from "./content.ts";
import { baseOf, cannotEquip, equip, itemById, stash } from "./items.ts";
import { canTakeJob, changeJob, equipPassive, jpLeft, knows, learn, passiveBudget, passivePoints, setSecondary, unequipPassive } from "./progression.ts";
import { GEAR_SLOTS, type GearSlot, type Item, type JobId, type Person, type SovMove, type SovState } from "./state.ts";

export type OutfitMove = Extract<SovMove, { type: "learn" | "take_job" | "secondary" | "passive" | "equip" | "unequip" }>;

const SLOTS: readonly GearSlot[] = GEAR_SLOTS;

/** One of House `house`'s Scions (its own or a Ward it hosts), Retired ones included. */
function readied(s: SovState, house: number, id: unknown): Person | undefined {
  const p = s.people.find((x) => x.id === id);
  return p && p.host === house && (p.status === "scion" || p.status === "retired") ? p : undefined;
}

const put = (s: SovState, p: Person): void => {
  s.people[s.people.indexOf(s.people.find((x) => x.id === p.id)!)] = p;
};

/** Why House `house` cannot make this outfitting move, or null. */
export function cannotOutfit(s: SovState, house: number, m: OutfitMove): string | null {
  const p = readied(s, house, m.person);
  if (!p) return "Ready only your own Scions.";
  switch (m.type) {
    case "learn": {
      const id = m.ability;
      const job = ACTIVE_BY_ID.get(id)?.job ?? JOB_PASSIVE_BY_ID.get(id)?.job;
      if (!job) return "There is no such ability.";
      if (job !== p.job) return "Abilities are bought in the primary Job.";
      if (knows(p, id)) return `${p.name} already knows it.`;
      const price = ACTIVE_BY_ID.get(id)?.jp ?? JOB_PASSIVE_BY_ID.get(id)!.jp;
      return jpLeft(p, job) < price ? `It costs ${price} JP; ${p.name} has ${jpLeft(p, job)}.` : null;
    }
    case "take_job":
      if (!JOB_BY_ID.has(m.job)) return "There is no such Job.";
      if (m.job === p.job) return `${p.name} is already a ${JOB_BY_ID.get(m.job)!.name}.`;
      return canTakeJob(p, m.job) ? null : `${p.name} cannot take that Job yet.`;
    case "secondary": {
      if (m.job === null) return null;
      if (!JOB_BY_ID.has(m.job)) return "There is no such Job.";
      if (m.job === p.job) return "The secondary set must be another Job's.";
      const actives = ABILITY_SET_BY_JOB.get(m.job)?.actives ?? [];
      return actives.some((a) => knows(p, a.id)) ? null : `${p.name} knows none of that Job's actives.`;
    }
    case "passive": {
      const def = JOB_PASSIVE_BY_ID.get(m.ability);
      if (!def || !knows(p, m.ability)) return `${p.name} has not bought that passive.`;
      if (!m.on) return p.passives.includes(m.ability) ? null : "It is not equipped.";
      if (p.passives.includes(m.ability)) return "It is already equipped.";
      return passivePoints(p) + def.points > passiveBudget(p) ? "No room left in the passive budget." : null;
    }
    case "equip": {
      const item = itemById(s, m.item);
      if (!item) return "There is no such item.";
      if (!SLOTS.includes(m.slot)) return "There is no such slot.";
      if (cursedIn(s, p, m.slot)) return "A cursed item will not come off.";
      if (item.cursed && worn(s, item)) return "A cursed item will not come off.";
      const why = cannotEquip(s, p, item, m.slot);
      return why ? `${p.name} cannot wear it: ${why}.` : null;
    }
    case "unequip":
      if (!SLOTS.includes(m.slot) || p.gear[m.slot] === undefined) return "Nothing is worn there.";
      return cursedIn(s, p, m.slot) ? "A cursed item will not come off." : null;
  }
}

const slotOf = (p: Person, item: Item): GearSlot | undefined => SLOTS.find((k) => p.gear[k] === item.id);
const worn = (s: SovState, item: Item): Person | undefined => s.people.find((x) => slotOf(x, item));
const cursedIn = (s: SovState, p: Person, slot: GearSlot): boolean => !!itemById(s, p.gear[slot])?.cursed;

/** Makes the (checked) outfitting move. */
export function outfit(s: SovState, house: number, m: OutfitMove): void {
  const p = readied(s, house, m.person)!;
  switch (m.type) {
    case "learn":
      return put(s, learn(p, m.ability));
    case "take_job": {
      const q = changeJob(p, m.job);
      put(s, q);
      // Gear the new Job may not wear goes back to the stash (a cursed piece stays on).
      for (const k of SLOTS) {
        const it = itemById(s, q.gear[k]);
        if (it && !it.cursed && cannotEquip(s, q, it, k)) delete q.gear[k];
      }
      return;
    }
    case "secondary":
      return put(s, setSecondary(p, m.job ?? undefined));
    case "passive":
      return put(s, m.on ? equipPassive(p, m.ability) : unequipPassive(p, m.ability));
    case "equip":
      return equip(s, p, itemById(s, m.item)!, m.slot);
    case "unequip":
      delete p.gear[m.slot];
      return;
  }
}

/** How good an item is to the bot: its tier, then the level it was made for. */
const worth = (it: Item | undefined): number => (it ? it.tier * 100 + it.ilvl : -1);

/**
 * The bot readies its Scions one step at a time: buys the cheapest ability it can afford in the primary
 * Job (skipping those whose system is not built yet), equips bought passives while the budget allows, sets a secondary
 * set it has actives in, and puts the best stashed gear in each slot it fits.
 */
export function botOutfit(s: SovState, house: number): OutfitMove | null {
  const mine = s.people.filter((p) => p.host === house && p.status === "scion");
  for (const p of mine) {
    const set = p.job ? ABILITY_SET_BY_JOB.get(p.job) : undefined;
    // Cheapest first (actives before passives at a price), so a Scion soon has a few of each.
    const shop = [...(set?.actives ?? []), ...(set?.passives ?? [])].sort((a, b) => a.jp - b.jp);
    for (const a of shop) {
      const m: OutfitMove = { type: "learn", person: p.id, ability: a.id };
      if (!a.later && !cannotOutfit(s, house, m)) return m;
    }
    for (const a of set?.passives ?? []) {
      const m: OutfitMove = { type: "passive", person: p.id, ability: a.id, on: true };
      if (!a.later && !cannotOutfit(s, house, m)) return m;
    }
    if (!p.secondary) {
      const other = (Object.keys(p.jp) as JobId[]).find((j) => j !== p.job && !cannotOutfit(s, house, { type: "secondary", person: p.id, job: j }));
      if (other) return { type: "secondary", person: p.id, job: other };
    }
  }
  const spare = stash(s, house).sort((a, b) => worth(b) - worth(a));
  for (const it of spare) {
    for (const p of mine) {
      const slots = baseOf(it).slot === "acc" ? (["acc1", "acc2"] as const) : baseOf(it).slot === "main" && (baseOf(it).hands ?? 1) === 1 ? (["main", "off"] as const) : [baseOf(it).slot as GearSlot];
      for (const slot of slots) {
        if (worth(itemById(s, p.gear[slot])) >= worth(it)) continue;
        // A two-hander only replaces an empty or weaker main hand when the off hand holds nothing better.
        if (slot === "main" && (baseOf(it).hands ?? 1) === 2 && worth(itemById(s, p.gear.off)) > worth(it)) continue;
        const m: OutfitMove = { type: "equip", person: p.id, item: it.id, slot };
        if (!cannotOutfit(s, house, m)) return m;
      }
    }
  }
  return null;
}
