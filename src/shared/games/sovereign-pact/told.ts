// What an event did (Josh's playtest, 2026-11-02: "did he actually become younger?"): the state just
// before an outcome's effects and just after, told as plain lines for the outcome card. Each line names
// the House it concerns and whether every House may read it: wounds, injuries, deaths and the haul are
// open; Sanity, XP, JP, traits, growth and a House's own stores are its own business (view.ts filters).
import { CHANGE_BY_ID, INJURY_BY_ID, PROPERTY_BY_ID, TRAIT_BY_ID, type TripEffect } from "./content.ts";
import { itemName } from "./loot.ts";
import { GEAR_SLOTS, STATS, type SovState, type Stores, type Told } from "./state.ts";
import { TUNING } from "./tuning.ts";

export type { Told };

interface PersonSnap {
  name: string;
  host: number;
  status: string;
  hurt: number;
  sanity: number;
  mp: number;
  xp: number;
  jp: number;
  level: number;
  age: number;
  injuries: string[];
  traits: string[];
  growth: number[];
  change?: string;
  /** What they wear: each piece's name, properties, curse, dents and tier. */
  gear: { id: number; name: string; props: string[]; cursed: boolean; dented: number; tier: number }[];
}

export interface Snap {
  people: Record<number, PersonSnap>;
  houses: Record<number, { gold: number; stores: Stores; items: number[]; consumables: Partial<Record<string, number>> }>;
  haul: { items: number[]; stores: Stores };
}

const STAT_NAMES: Record<string, string> = { might: "Might", resilience: "Resilience", guile: "Guile", acuity: "Acuity", sagacity: "Sagacity", speed: "Speed" };
const word = (id: string) => id.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function snap(s: SovState, ids: number[], houses: number[]): Snap {
  const e = s.expedition;
  const people: Snap["people"] = {};
  for (const id of ids) {
    const p = s.people.find((x) => x.id === id);
    if (!p) continue;
    people[id] = {
      name: p.name,
      host: p.host,
      status: p.status,
      hurt: e?.carry[id]?.hurt ?? 0,
      sanity: p.sanity,
      mp: p.mp,
      xp: p.level * TUNING.progression.xpPerLevel + p.xp,
      jp: Object.values(p.jp).reduce((n, x) => n + (x ?? 0), 0),
      level: p.level,
      age: p.age,
      injuries: p.injuries.map((i) => i.id),
      traits: [...p.traits, ...(p.blessed ?? []).map((b) => b.id)],
      growth: [...p.growth],
      ...(p.change ? { change: p.change.id } : {}),
      gear: GEAR_SLOTS.flatMap((k) => {
        const item = s.items.find((i) => i.id === p.gear[k]);
        return item ? [{ id: item.id, name: itemName(item), props: (item.props ?? []).map(([x]) => x), cursed: !!item.cursed, dented: item.dented ?? 0, tier: item.tier }] : [];
      }),
    };
  }
  const out: Snap["houses"] = {};
  for (const h of houses) {
    const house = s.houses[h]!;
    out[h] = { gold: house.gold, stores: { ...house.stores }, items: s.items.filter((i) => i.house === h).map((i) => i.id), consumables: { ...(house.consumables ?? {}) } };
  }
  return { people, houses: out, haul: { items: (e?.haul?.items ?? []).map((i) => i.id), stores: { ...(e?.haul?.stores ?? {}) } } };
}

const signed = (n: number) => (n > 0 ? `+${n}` : `−${-n}`);
const less = (a: string[], b: string[]) => {
  const left = [...b];
  return a.filter((x) => {
    const i = left.indexOf(x);
    if (i < 0) return true;
    left.splice(i, 1);
    return false;
  });
};
const amounts = (was: Partial<Record<string, number>>, now: Partial<Record<string, number>>) =>
  [...new Set([...Object.keys(was), ...Object.keys(now)])].flatMap((k) => {
    const d = (now[k] ?? 0) - (was[k] ?? 0);
    return d ? [`${signed(d)} ${word(k)}`] : [];
  });

/** Every change between `before` and now, in plain words. */
export function tell(s: SovState, before: Snap): Told[] {
  const out: Told[] = [];
  const say = (text: string, of: number | null, open: boolean) => out.push({ text, of, open });
  for (const [key, was] of Object.entries(before.people)) {
    const id = Number(key);
    const p = s.people.find((x) => x.id === id);
    const of = was.host;
    if (!p) {
      say(`${was.name} dies.`, of, true);
      continue;
    }
    const n = p.name;
    if (p.status === "lost" && was.status !== "lost") say(`${n} is left behind in the otherworld.`, of, true);
    if (p.status !== "lost" && was.status === "lost") say(`${n} is found.`, of, true);
    const hurt = s.expedition?.carry[id]?.hurt ?? 0;
    if (hurt !== was.hurt) say(`${n}: HP ${signed(was.hurt - hurt)}.`, of, true);
    for (const inj of less(p.injuries.map((i) => i.id), was.injuries)) say(`${n} is injured: ${INJURY_BY_ID.get(inj)?.name ?? word(inj)}.`, of, true);
    for (const inj of less(was.injuries, p.injuries.map((i) => i.id))) say(`${n} is healed of ${INJURY_BY_ID.get(inj)?.name ?? word(inj)}.`, of, true);
    if (p.change?.id !== was.change) say(p.change ? `${n} is Changed: ${CHANGE_BY_ID.get(p.change.id)?.name ?? word(p.change.id)}.` : `${n} is restored to their own body.`, of, true);
    if (p.level !== was.level) say(`${n}: level ${was.level} → ${p.level}.`, of, true);
    if (p.sanity !== was.sanity) say(`${n}: Sanity ${signed(p.sanity - was.sanity)}.`, of, false);
    if (p.mp !== was.mp) say(`${n}: MP ${signed(p.mp - was.mp)}.`, of, false);
    const xp = p.level * TUNING.progression.xpPerLevel + p.xp - was.xp;
    if (xp) say(`${n}: ${signed(xp)} XP.`, of, false);
    const jp = Object.values(p.jp).reduce((t, x) => t + (x ?? 0), 0) - was.jp;
    if (jp) say(`${n}: ${signed(jp)} JP.`, of, false);
    if (p.age !== was.age) say(`${n} is ${p.age < was.age ? "younger" : "older"}: age ${was.age} → ${p.age}.`, of, false);
    const traits = [...p.traits, ...(p.blessed ?? []).map((b) => b.id)];
    for (const t of less(traits, was.traits)) say(`${n} gains ${TRAIT_BY_ID.get(t)?.name ?? word(t)}.`, of, false);
    for (const t of less(was.traits, traits)) say(`${n} loses ${TRAIT_BY_ID.get(t)?.name ?? word(t)}.`, of, false);
    // Their gear: a piece lost, a property gained or lost, a curse, a dent, a better make.
    for (const was of p ? before.people[id]!.gear : []) {
      const item = s.items.find((i) => i.id === was.id);
      if (!item) {
        say(`${n} loses the ${was.name}.`, of, true);
        continue;
      }
      const props = (item.props ?? []).map(([x]) => x);
      const prop = (x: string) => PROPERTY_BY_ID.get(x)?.name ?? word(x);
      for (const x of less(props, was.props)) say(`${n}'s ${was.name} gains ${prop(x)}${PROPERTY_BY_ID.get(x)?.text ? ` (${PROPERTY_BY_ID.get(x)!.text.toLowerCase()})` : ""}.`, of, true);
      for (const x of less(was.props, props)) say(`${n}'s ${was.name} loses ${prop(x)}.`, of, true);
      if (item.cursed && !was.cursed) say(`${n}'s ${was.name} is cursed.`, of, true);
      if (!item.cursed && was.cursed) say(`The curse on ${n}'s ${was.name} is lifted.`, of, true);
      if ((item.dented ?? 0) > was.dented) say(`${n}'s ${was.name} is dented: it fights a tier worse until a Forge mends it.`, of, true);
      if ((item.dented ?? 0) < was.dented) say(`${n}'s ${was.name} is mended.`, of, true);
      if (item.tier > was.tier) say(`${n}'s ${was.name} is made better: now the ${itemName(item)}.`, of, true);
    }
    STATS.forEach((stat, i) => {
      const d = p.growth[i]! - was.growth[i]!;
      if (d) say(`${n}'s ${STAT_NAMES[stat]} grows ${d > 0 ? "faster" : "slower"} (${signed(d)}% a level).`, of, false);
    });
  }
  for (const [key, was] of Object.entries(before.houses)) {
    const h = Number(key);
    const house = s.houses[h]!;
    const name = `House ${house.name}`;
    if (house.gold !== was.gold) say(`${name}: ${signed(house.gold - was.gold)} Gold.`, h, false);
    for (const line of amounts(was.stores, house.stores)) say(`${name}: ${line}.`, h, false);
    for (const line of amounts(was.consumables, house.consumables ?? {})) say(`${name}: ${line}.`, h, false);
    for (const item of s.items.filter((i) => i.house === h && !was.items.includes(i.id))) say(`${name} gains the ${itemName(item)}.`, h, false);
  }
  const haul = s.expedition?.haul;
  for (const item of (haul?.items ?? []).filter((i) => !before.haul.items.includes(i.id))) say(`The party carries the ${itemName(item)}.`, null, true);
  for (const line of amounts(before.haul.stores, haul?.stores ?? {})) say(`The haul: ${line}.`, null, true);
  return out;
}

const PLACES: Record<string, string> = { encounter: "a fight", event: "something strange", camp: "a camp", cache: "a cache", rally: "a rally", raid: "a raid", lair: "a lair", gate: "the Gate" };

/**
 * What an outcome does that a before-and-after cannot see (Josh's playtest, 2026-11-03: "something
 * answers, nothing happens … is this even an event?"): the fight it starts, the way it shortens or
 * changes, what the next battle starts with, armor worn down, score, Doom and Accord. Read up to the
 * first fight; what follows a won fight is told after it.
 */
export function effectLines(s: SovState, effects: readonly TripEffect[], scions: number[], party: number[], house: number | null): Told[] {
  const out: Told[] = [];
  const names = (ids: number[]) => ids.map((id) => s.people.find((p) => p.id === id)?.name).filter(Boolean).join(", ");
  for (const fx of effects) {
    const ids = fx.to === "party" ? party : scions;
    const who = fx.to === "party" ? "The party" : names(ids) || "The party";
    const of = house ?? (ids.length ? (s.people.find((p) => p.id === ids[0])?.host ?? null) : null);
    if (fx.status) out.push({ text: `${who} ${fx.to !== "party" && ids.length > 1 ? "start" : "starts"} the next battle with ${word(fx.status)}.`, of, open: true });
    if (fx.tp) out.push({ text: `${who} ${fx.to !== "party" && ids.length > 1 ? "start" : "starts"} the next battle with ${fx.tp >= 100 ? "full" : `${fx.tp}%`} TP.`, of, open: true });
    if (fx.durability) out.push({ text: `${who}: ${fx.loc ? `${fx.loc} armor` : "armor"} ${fx.durability > 0 ? "mended" : "worn down"} (${signed(fx.durability)}% Durability).`, of, open: true });
    for (const [k, n] of Object.entries(fx.score ?? {})) if (n) out.push({ text: `${house === null ? "Every House present" : `House ${s.houses[house]?.name}`}: ${signed(n)} ${word(k)}.`, of: house, open: false });
    if (fx.doom) out.push({ text: `Doom ${signed(fx.doom)}.`, of: null, open: true });
    if (fx.accord) out.push({ text: `Accord ${signed(fx.accord)}.`, of: null, open: true });
    if (fx.skip) out.push({ text: `A shorter way: the next ${fx.skip === 1 ? "place" : `${fx.skip} places`} on the road ${fx.skip === 1 ? "is" : "are"} passed by.`, of: null, open: true });
    if (fx.fork) out.push({ text: `The way ahead changes${fx.fork.drop ? `: ${fx.fork.drop} ${fx.fork.drop === 1 ? "place" : "places"} passed by` : ""}${fx.fork.add?.length ? `${fx.fork.drop ? "," : ":"} ${fx.fork.add.map((k) => PLACES[k] ?? word(k)).join(" and ")} ahead` : ""}.`, of: null, open: true });
    if (fx.retreat) out.push({ text: "The party turns back for home.", of: null, open: true });
    if (fx.encounter) {
      const how = fx.encounter.modifier === "ambush" ? "It falls on you from ambush: a battle." : fx.encounter.modifier === "surprise" ? "You fall on it before it is ready: a battle." : "It comes to a fight.";
      out.push({ text: how, of: null, open: true });
      break;
    }
  }
  return out;
}
