// Items (§13): making them, what a worn set adds up to in battle, weight and carry, who may wear what,
// and the Crude starting kit a new Scion gets. Bases are content (content/items.json); numbers are in
// tuning.items. Properties (§13.4) come next and add to the same totals.
import { ITEM_BASE_BY_ID, type ArmorClass, type ItemBase } from "./content.ts";
import { jobStat } from "./formulas.ts";
import { jobOf, mayWear, mayWield } from "./progression.ts";
import { type GearSlot, type Item, type ItemTier, type Location, type Person, type SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";
import type { Weapon } from "./combat/types.ts";

const T = TUNING.items;
const block = (k: "power" | "defense", L: number) => (k === "power" ? 6 + 3 * L + 0.1 * L * L : 1 + L + 0.08 * L * L);

export const baseOf = (item: Pick<Item, "base">): ItemBase => {
  const b = ITEM_BASE_BY_ID.get(item.base);
  if (!b) throw new Error(`unknown item base ${item.base}`);
  return b;
};

/** Tier multiplier, less a step per dent (§13.3, §13.4). */
const quality = (item: Item) => T.tierMult[Math.max(0, item.tier - 1 - (item.dented ?? 0))]!;

/** Mints an item into the state and returns it. */
export function mint(s: SovState, base: string, house: number, tier: ItemTier = 2, ilvl = 1): Item {
  baseOf({ base });
  const item: Item = { id: s.nextId++, base, tier, ilvl, house };
  s.items.push(item);
  return item;
}

export const itemById = (s: Pick<SovState, "items">, id: number | undefined): Item | undefined =>
  id === undefined ? undefined : s.items.find((i) => i.id === id);

/** A weapon item as combat reads it: power from the index at its level and tier (§13.2). */
export function weaponOf(item: Item): Weapon {
  const b = baseOf(item);
  return {
    kind: b.type,
    power: Math.round(((b.power ?? 0) / 100) * block("power", item.ilvl) * quality(item)),
    acc: b.acc ?? 90,
    crit: b.crit ?? 0,
    reach: b.reach ?? "melee",
    hands: b.hands ?? 1,
    critStatus: b.critStatus,
    armorPierce: b.armorPierce,
    tpGain: b.tpGain,
    attackCost: b.attackCost,
    aims: b.aims,
  };
}

/** Bare hands: a fifth of a sword at level 1 (Pugilists' knuckles do better). */
export const UNARMED: Weapon = { kind: "unarmed", power: 5, acc: 90, crit: 5, reach: "melee", hands: 1 };

export interface GearTotals {
  weapon: Weapon;
  defense: number;
  durabilityPct: Partial<Record<Location, number>>;
  evasion: number;
  guard: number;
  weight: number;
  /** Spell damage and max MP bonuses from a staff or focus, in %. */
  spellPct: number;
  mpPct: number;
}

/** What a Scion's worn gear adds up to (§13.1–13.3), carry overload included. */
export function gearTotals(s: Pick<SovState, "items">, p: Person): GearTotals {
  const t: GearTotals = { weapon: UNARMED, defense: 0, durabilityPct: {}, evasion: 0, guard: 0, weight: 0, spellPct: 0, mpPct: 0 };
  for (const [slot, id] of Object.entries(p.gear) as [GearSlot, number][]) {
    const item = itemById(s, id);
    if (!item) continue;
    const b = baseOf(item);
    if (slot === "main" && b.power !== undefined) t.weapon = weaponOf(item);
    if (b.type === "shield") t.guard += b.guard ?? 0;
    if (b.armor && b.slot !== "main" && b.slot !== "off" && b.slot !== "acc") {
      const loc = b.slot as Location;
      t.defense += T.armorDefense[b.armor] * T.slotShare[loc] * block("defense", item.ilvl) * quality(item);
      t.durabilityPct[loc] = (t.durabilityPct[loc] ?? 0) + T.armorDurabilityPct[b.armor];
      t.evasion += T.armorEvasion[b.armor];
      t.weight += T.armorWeight[b.armor];
    } else if (b.type === "shield") t.weight += b.weight ?? 0;
    else if (b.power !== undefined) t.weight += T.weaponWeight[(b.hands ?? 1) - 1]!;
    t.spellPct += b.spellPct ?? 0;
    t.mpPct += b.mpPct ?? 0;
  }
  t.defense = Math.round(t.defense);
  t.evasion -= Math.max(0, t.weight - carry(p));
  return t;
}

/** How much a Scion carries before it slows them: 10 + Might/2 (§13.1). */
export const carry = (p: Person): number => Math.floor(T.carry.base + jobStat(p, "might") / T.carry.mightDiv);

/** Why `p` may not wear `item` in `slot`, or null if they may (§12.3, §13.1). */
export function cannotEquip(s: Pick<SovState, "items">, p: Person, item: Item, slot: GearSlot): string | null {
  const b = baseOf(item);
  if (item.house !== p.host) return "not this House's";
  const want = b.slot === "acc" ? ["acc1", "acc2"] : [b.slot];
  if (!want.includes(slot)) return "wrong slot";
  if (b.slot === "main" && !mayWield(p, b.type, b.hands ?? 1)) return "the Job forbids it";
  if (b.type === "shield" && !jobOf(p)?.shields) return "the Job forbids shields";
  if (b.type === "thrown" && !mayWield(p, "thrown", 1)) return "the Job forbids it";
  if (b.armor && !mayWear(p, b.armor as ArmorClass)) return "too heavy for the Job";
  if (slot === "off") {
    const main = itemById(s, p.gear.main);
    if (main && (baseOf(main).hands ?? 1) === 2) return "two-handed weapon";
  }
  return null;
}

/** Puts `item` on `p` in `slot` (taking off what was there and, for a two-hander, the off hand). */
export function equip(s: SovState, p: Person, item: Item, slot: GearSlot): void {
  const why = cannotEquip(s, p, item, slot);
  if (why) throw new Error(`${p.name} cannot wear ${baseOf(item).name}: ${why}`);
  for (const other of s.people) for (const [k, v] of Object.entries(other.gear)) if (v === item.id) delete other.gear[k as GearSlot];
  p.gear[slot] = item.id;
  if (slot === "main" && (baseOf(item).hands ?? 1) === 2) delete p.gear.off;
}

/** A House's items nobody wears. */
export function stash(s: Pick<SovState, "items" | "people">, house: number): Item[] {
  const worn = new Set(s.people.flatMap((p) => Object.values(p.gear)));
  return s.items.filter((i) => i.house === house && !worn.has(i.id));
}

/** The Crude kit of a newly promoted Scion (§13.4: "starting gear"): the Job's first weapon and armor of its class. */
export function equipStarter(s: SovState, p: Person): void {
  const job = jobOf(p);
  if (!job) return;
  const [type, hands] = job.weapons.find((w) => w !== "unarmed")?.split(":") ?? [];
  const weapon = [...ITEM_BASE_BY_ID.values()].find((b) => b.slot === "main" && b.type === type && (!hands || `${b.hands}h` === hands));
  if (weapon) equip(s, p, mint(s, weapon.id, p.host, 1), "main");
  const cls = job.armor === "heavy" ? "medium" : job.armor;
  for (const loc of ["body", "head"] as const satisfies readonly Location[]) {
    const piece = [...ITEM_BASE_BY_ID.values()].find((b) => b.slot === loc && b.armor === cls);
    if (piece) equip(s, p, mint(s, piece.id, p.host, 1), loc);
  }
}

