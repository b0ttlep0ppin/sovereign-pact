// Items (§13): making them, what a worn set adds up to in battle, weight and carry, who may wear what,
// the Crude starting kit a new Scion gets, and rolled properties (§13.4). Bases and properties are
// content (content/items.json, content/properties.json); numbers are in tuning.items.
import type { Rng } from "../../rng.ts";
import { CHANGE_BY_ID, ITEM_BASE_BY_ID, NAMED_BY_ID, PROPERTIES, PROPERTY_BY_ID, type ArmorClass, type ItemBase, type PropertyDef, type PropertyOn } from "./content.ts";
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

/**
 * A named item (§13.4) for `house` (-1: into a haul) at item level `ilvl`, its properties fixed. Each one
 * exists once a campaign: making it flags it, whether or not it ever reaches a House.
 */
export function mintNamed(s: SovState, id: string, house: number, ilvl: number): Item {
  const def = NAMED_BY_ID.get(id);
  if (!def) throw new Error(`unknown named item ${id}`);
  s.flags.push(`named_${id}`);
  return { id: s.nextId++, base: def.base, tier: def.tier, ilvl: Math.max(ilvl, def.minLevel ?? 1), house, named: id, props: def.props.map(([p, v]) => [p, v] as [string, number]) };
}

/** Whether a named item has been made yet this campaign. */
export const madeNamed = (s: Pick<SovState, "flags">, id: string): boolean => s.flags.includes(`named_${id}`);

/** Hands an item made earlier (loot, a shop lot) to its House, keeping the items in id order as a save restores them. */
export function stock(s: Pick<SovState, "items">, item: Item): void {
  const at = s.items.findIndex((x) => x.id > item.id);
  if (at < 0) s.items.push(item);
  else s.items.splice(at, 0, item);
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
  /** Battle mods from properties, summed (content/properties.json `mods` × value). */
  mods: Record<string, number>;
  /** The off hand's item type ("shield", "thrown", or a weapon type when dual wielding). */
  offhand?: string;
  /** A second one-hand weapon in the off hand (§13.2). */
  offWeapon?: Weapon;
}

/** What a Scion's worn gear adds up to (§13.1–13.3), carry overload included. */
export function gearTotals(s: Pick<SovState, "items">, p: Person): GearTotals {
  const t: GearTotals = { weapon: UNARMED, defense: 0, durabilityPct: {}, evasion: 0, guard: 0, weight: 0, spellPct: 0, mpPct: 0, mods: {} };
  let element: string | undefined;
  for (const [slot, id] of Object.entries(p.gear) as [GearSlot, number][]) {
    const item = itemById(s, id);
    if (!item) continue;
    const b = baseOf(item);
    for (const [key, v] of propMods(item)) {
      if (key.startsWith("element.")) element = key.slice(8);
      else t.mods[key] = (t.mods[key] ?? 0) + v;
    }
    if (slot === "main" && b.power !== undefined) t.weapon = weaponOf(item);
    if (slot === "off") t.offhand = b.type;
    if (slot === "off" && b.slot === "main" && b.power !== undefined) t.offWeapon = weaponOf(item);
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
  if (element && t.weapon !== UNARMED) t.weapon = { ...t.weapon, element: element as Weapon["element"] };
  // Quickening counts once per Scion (§13.4); Guarding needs a shield.
  if (t.mods.speed) t.mods.speed = Math.min(T.maxSpeedFromGear, t.mods.speed);
  if (t.mods.shieldGuard) {
    if (t.guard > 0) t.guard += t.mods.shieldGuard;
    delete t.mods.shieldGuard;
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
  // Any one-hand weapon may go in the off hand too: dual wield (§13.2).
  const want = b.slot === "acc" ? ["acc1", "acc2"] : b.slot === "main" && (b.hands ?? 1) === 1 ? ["main", "off"] : [b.slot];
  if (!want.includes(slot)) return "wrong slot";
  // A Change takes some slots away: a Wyrmling has no hands for a sword (§9.6).
  if (p.change && !CHANGE_BY_ID.get(p.change.id)?.slots.includes(slot)) return "the Change leaves no room for it";
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

/** The Crude kit of a newly promoted Scion (§13.4: "starting gear"): the Job's starter weapon and armor of its class. */
export function equipStarter(s: SovState, p: Person): void {
  const job = jobOf(p);
  if (!job) return;
  // The Job's own starter (a Vagabond's bow, so the Back line can reach), else its first weapon type.
  const [type, hands] = job.weapons.find((w) => w !== "unarmed")?.split(":") ?? [];
  const weapon = (job.starter ? ITEM_BASE_BY_ID.get(job.starter) : undefined) ?? [...ITEM_BASE_BY_ID.values()].find((b) => b.slot === "main" && b.type === type && (!hands || `${b.hands}h` === hands));
  if (weapon) equip(s, p, mint(s, weapon.id, p.host, 1), "main");
  const cls = job.armor === "heavy" ? "medium" : job.armor;
  for (const loc of ["body", "head"] as const satisfies readonly Location[]) {
    const piece = [...ITEM_BASE_BY_ID.values()].find((b) => b.slot === loc && b.armor === cls);
    if (piece) equip(s, p, mint(s, piece.id, p.host, 1), loc);
  }
}


/** What a property may roll on for this item: its kind, and for armor its location. */
export function propertyKinds(item: Pick<Item, "base">): PropertyOn[] {
  const b = baseOf(item);
  if (b.type === "shield") return ["shield"];
  if (b.slot === "acc") return ["accessory"];
  if (b.armor && b.slot !== "main" && b.slot !== "off") return ["armor", b.slot as Location];
  return ["weapon"];
}

/** An item's properties as battle mods, `@` resolved to the piece's location. */
export function propMods(item: Item): [string, number][] {
  const loc = baseOf(item).slot;
  return (item.props ?? []).flatMap(([id, v]) =>
    Object.entries(PROPERTY_BY_ID.get(id)?.mods ?? {}).map(([k, per]): [string, number] => [k.replace("@", loc), per * v]),
  );
}

/** Properties per tier: Fine 1, Masterwork 2, Relic 2–3 (§13.4). */
const propCount = (rng: Rng, tier: ItemTier) => (tier < 3 ? 0 : tier === 3 ? 1 : tier === 4 ? 2 : 2 + rng.int(2));

export interface RollOpts {
  /** % chance of one extra negative property (found gear, §13.4). */
  negativeChance?: number;
  /** Adds a curse (§13.5) and marks the item cursed. */
  cursed?: boolean;
}

/** Rolls `item`'s properties for its tier: weighted, no two of a group, values in their range. */
export function rollProps(rng: Rng, item: Item, opts: RollOpts = {}): Item {
  const kinds = propertyKinds(item);
  const fits = (x: PropertyDef) => x.on.some((k) => kinds.includes(k)) && (x.minTier ?? 0) <= item.tier;
  const props: [string, number][] = [];
  const draw = (pool: readonly PropertyDef[]) => {
    const open = pool.filter((x) => fits(x) && !props.some(([id]) => id === x.id || (x.group && PROPERTY_BY_ID.get(id)?.group === x.group)));
    let roll = rng.int(open.reduce((n, x) => n + (x.weight ?? 10), 0));
    const pick = open.find((x) => (roll -= x.weight ?? 10) < 0);
    if (pick) props.push([pick.id, pick.roll ? pick.roll[0] + rng.int(pick.roll[1] - pick.roll[0] + 1) : 1]);
  };
  const good = PROPERTIES.filter((x) => !x.negative && !x.curse);
  for (let n = propCount(rng, item.tier); n > 0; n--) draw(good);
  if (opts.negativeChance && rng.int(100) < opts.negativeChance) draw(PROPERTIES.filter((x) => x.negative));
  if (opts.cursed) draw(PROPERTIES.filter((x) => x.curse));
  item.props = props.length ? props : undefined;
  if (opts.cursed) item.cursed = true;
  return item;
}
