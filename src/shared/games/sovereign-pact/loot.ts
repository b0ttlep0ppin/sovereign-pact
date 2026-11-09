// Loot (§9.8, §9.10): what battles, Caches and the boss leave. It goes into the haul the party
// carries. At home it becomes one pool of shares (an item each, materials in bundles) that the
// Houses still in the party draft, in a random order then snake order. A wipe loses the haul. Drop tables are per pool
// (content/pools.json); numbers are in tuning.loot.
import { ITEM_BASES, NAMED, NAMED_BY_ID, POOL_BY_ID, RARE_MATERIALS } from "./content.ts";
import { baseOf, cannotEquip, madeNamed, mintNamed, rollProps, stock } from "./items.ts";
import { present } from "./events.ts";
import { battle } from "./journey.ts";
import type { GearSlot, Item, ItemTier, Share, SovState, Stores } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { built } from "./commons.ts";
import { log, withRng } from "./year.ts";
import { claimed } from "./homecoming.ts";

const L = TUNING.loot;
const RARE = new Map(RARE_MATERIALS.map((m) => [m.id, m.name]));
export const TIER_NAMES = ["Crude", "Common", "Fine", "Masterwork", "Relic"] as const;

const materialName = (id: string) => RARE.get(id) ?? id[0]!.toUpperCase() + id.slice(1);
export const itemName = (item: Item) => (item.named ? (NAMED_BY_ID.get(item.named)?.name ?? item.named) : `${TIER_NAMES[item.tier - 1]} ${baseOf(item).name}`);
const haul = (s: SovState) => (s.expedition!.haul ??= { items: [], stores: {} });
const add = (to: Stores, k: string, n: number) => (to[k] = (to[k] ?? 0) + n);
const list = (st: Stores) => Object.entries(st).map(([k, n]) => `${n} ${materialName(k)}`).join(", ");

/** Rolls on the card's pool's drop table `times` over, into the haul. */
export function gather(s: SovState, times = 1): void {
  const { pool, level } = s.expedition!.card;
  const drops = POOL_BY_ID.get(pool)!.drops;
  const got: Stores = {};
  withRng(s, (rng) => {
    for (let i = 0; i < times; i++) {
      for (const [id, pct] of drops.materials) if (rng.int(100) < pct) add(got, id, RARE.has(id) ? 1 : 1 + Math.floor(level / L.qtyDiv.common));
      if (rng.int(100) < drops.essencePct) add(got, "essence", 1 + Math.floor(level / L.qtyDiv.essence));
    }
  });
  if (!Object.keys(got).length) return;
  for (const [k, n] of Object.entries(got)) add(haul(s).stores, k, n!);
  log(s, `The party gathers ${list(got)}.`);
}

/** A found item for the haul: any base, at the card's level, its properties rolled (and maybe a bad one). Fine or better is now and then a named item of the pool. */
export function find(s: SovState, tier: ItemTier): Item {
  // The Rift Assayers (a Commons project): now and then a find is one tier finer.
  if (tier < 4 && built(s, "rift_assayers") && chance(s, TUNING.commons.assayPct * built(s, "rift_assayers"))) tier = (tier + 1) as ItemTier;
  const named = tier >= 3 && chance(s, L.namedPct) ? namedFor(s) : undefined;
  if (named) return carryNamed(s, named);
  const item = withRng(s, (rng) => rollProps(rng, { id: s.nextId++, base: rng.pick(ITEM_BASES).id, tier, ilvl: s.expedition!.card.level, house: -1 }, { negativeChance: L.negativePct }));
  haul(s).items.push(item);
  log(s, `The party finds a ${itemName(item)}.`);
  return item;
}

/** A pool's named item not yet made this campaign, at or below the card's level, or none. */
function namedFor(s: SovState): string | undefined {
  const { pool, level } = s.expedition!.card;
  const open = NAMED.filter((n) => n.pools?.includes(pool) && (n.minLevel ?? 1) <= level && !madeNamed(s, n.id));
  return open.length ? withRng(s, (rng) => rng.pick(open).id) : undefined;
}

export function carryNamed(s: SovState, id: string): Item {
  const item = mintNamed(s, id, -1, s.expedition!.card.level);
  haul(s).items.push(item);
  log(s, `The party finds ${itemName(item)}.`);
  return item;
}

/** An event's find (§9.10): to `house`, or into the haul for the draft when it is null; a named item if it is not yet made. */
export function found(s: SovState, tier: ItemTier, house: number | null, named?: string): void {
  const item = named && !madeNamed(s, named) ? carryNamed(s, named) : find(s, tier);
  if (house === null) return;
  haul(s).items.pop();
  give(s, item, house);
}

const chance = (s: SovState, pct: number) => withRng(s, (rng) => rng.int(100) < pct);

/** A won Encounter: a roll on the drop table, and now and then an item. */
export function encounterLoot(s: SovState): void {
  gather(s);
  if (chance(s, L.encounterGearPct)) find(s, chance(s, L.finePct + L.finePerLevel * s.expedition!.card.level) ? 3 : 2);
}

/** A Cache node (§9.3): 1–2 items and two rolls on the table; sometimes something waits inside first. */
export function cache(s: SovState): void {
  if (chance(s, L.cache.trapPct)) {
    // Reading: until the Mimic has its enemy entry, a trapped Cache is an ambush a level above the card.
    log(s, "The cache is a trap: something inside was waiting.");
    return battle(s, false, { modifier: "ambush", level: 1 }, { cache: true });
  }
  openCache(s);
}

/** The Cache opened, once nothing inside waits any more. */
export function openCache(s: SovState): void {
  log(s, "The party opens an old cache.");
  const [lo, hi] = L.cache.items as [number, number];
  const n = lo + withRng(s, (rng) => rng.int(hi - lo + 1));
  for (let i = 0; i < n; i++) find(s, chance(s, L.cache.masterworkPerLevel * s.expedition!.card.level) ? 4 : 3);
  gather(s, L.cache.rolls);
}

/** A beaten boss: a Masterwork item per House present and one more, and three rolls on the table. */
export function bossLoot(s: SovState): void {
  // A boss's own named item falls with it, the first time (the Crown from the Cursed King, §14.7).
  const boss = s.expedition!.card.boss;
  for (const n of NAMED.filter((x) => boss && x.boss && (x.boss === boss || boss.startsWith(`${x.boss}_`) || x.boss.startsWith(`${boss}_`)) && !madeNamed(s, x.id))) carryNamed(s, n.id);
  for (let i = 0; i < present(s).length + L.boss.extraItems; i++) find(s, 4);
  gather(s, L.boss.rolls);
}

/** The draft order (Josh, 2026-11-02): the Houses in a random order, then snake order, one pick per share. */
export function snake(s: SovState, houses: number[], picks: number): number[] {
  const first = withRng(s, (rng) => rng.shuffle(houses));
  return Array.from({ length: picks }, (_, i) => {
    const round = Math.floor(i / first.length);
    const at = i % first.length;
    return first[round % 2 ? first.length - 1 - at : at]!;
  });
}

function give(s: SovState, item: Item, house: number): void {
  item.house = house;
  stock(s, item);
  claimed(s, house, `the ${itemName(item)}`);
  log(s, `House ${s.houses[house]!.name} takes the ${itemName(item)}.`);
}

function claim(s: SovState, share: Share, house: number): void {
  if (share.item) return give(s, share.item, house);
  for (const [k, n] of Object.entries(share.stores!)) add(s.houses[house]!.stores, k, n!);
  claimed(s, house, list(share.stores!));
  log(s, `House ${s.houses[house]!.name} takes ${list(share.stores!)}.`);
}

/**
 * The haul as shares (Josh, 2026-11-02): each item is one, and each material is split into as many
 * bundles as there are Houses drafting (fewer when there is too little to go round).
 */
function shares(s: SovState, houses: number): Share[] {
  const h = s.expedition!.haul!;
  const out: Share[] = h.items.map((item) => ({ id: item.id, item }));
  for (const [k, n] of Object.entries(h.stores)) {
    const parts = Math.min(houses, n!);
    for (let i = 0; i < parts; i++) out.push({ id: s.nextId++, stores: { [k]: Math.floor(n! / parts) + (i < n! % parts ? 1 : 0) } });
  }
  return out;
}

/** The party is home with its haul: it becomes a pool of shares the Houses still in the party draft. Alone, a House takes it all. */
export function shareOut(s: SovState): void {
  const e = s.expedition!;
  // A 2×4 party that turned back still drafts what the expedition brings home (§9.3).
  const back = (e.split?.home ?? []).flatMap((id) => s.people.filter((p) => p.id === id).map((p) => p.host));
  const houses = [...new Set([...present(s), ...back])].sort((a, b) => a - b);
  if (!e.haul || !houses.length) return;
  const pool = shares(s, houses.length);
  delete e.haul;
  if (!pool.length) return;
  if (houses.length === 1) return pool.forEach((sh) => claim(s, sh, houses[0]!));
  e.pool = pool;
  e.draft = snake(s, houses, pool.length);
  log(s, `The Houses draft the haul, ${pool.length} shares. House ${s.houses[e.draft[0]!]!.name} picks first.`);
}

/** Why `house` cannot take share `id` now, or null. */
export function cannotDraft(s: SovState, house: number, id: unknown): string | null {
  const e = s.expedition;
  if (!e?.draft?.length) return "Nothing is being drafted.";
  if (e.draft[0] !== house) return "It is not your House's pick.";
  return e.pool!.some((x) => x.id === id) ? null : "That is not in the haul.";
}

export function draftPick(s: SovState, house: number, id: number): void {
  const e = s.expedition!;
  claim(s, e.pool!.splice(e.pool!.findIndex((x) => x.id === id), 1)[0]!, house);
  e.draft!.shift();
  if (!e.pool!.length) {
    delete e.draft;
    delete e.pool;
  }
}

/** What a share is worth to the bot: items by tier, materials by amount (rare ones dear). */
const worth = (sh: Share): number =>
  sh.item ? L.botWorth.tier[sh.item.tier - 1]! : Object.entries(sh.stores!).reduce((n, [k, q]) => n + q! * (RARE.has(k) ? L.botWorth.rare : k === "essence" ? L.botWorth.essence : 1), 0);

/**
 * The bot drafts blind like everyone (properties are hidden until identified, §13.4): the share it
 * values most, preferring an item one of its Scions could wear.
 */
export function botDraft(s: SovState, house: number): number {
  const pool = s.expedition!.pool!;
  const top = Math.max(...pool.map(worth));
  const best = pool.filter((x) => worth(x) === top);
  const slot = (i: Item): GearSlot => (baseOf(i).slot === "acc" ? "acc1" : (baseOf(i).slot as GearSlot));
  const wearable = best.find((x) => x.item && s.people.some((p) => p.host === house && p.status === "scion" && !cannotEquip(s, p, { ...x.item!, house }, slot(x.item!))));
  return (wearable ?? best[0]!).id;
}
