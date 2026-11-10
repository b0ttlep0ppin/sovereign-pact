// The save's compact form of `people` and `items` (§4.4: 64 KB for a whole late campaign). They are
// most of a save, and as objects their field names and repeated content ids would be most of that.
// Here each person is a fixed-order run of varints in one string, and every string (content ids,
// names) is written once into a dictionary and referenced by its index. Content is still stored by id, so reordering or adding
// content never breaks a save; only this field order is part of the save format (SAVE_VERSION).
import {
  ELEMENTS,
  GEAR_SLOTS,
  HIST_KEYS,
  type Element,
  type HistKey,
  type Item,
  type ItemTier,
  type JobId,
  type Person,
  type PersonStatus,
  type PotentialTier,
  type Six,
} from "./state.ts";

const STATUSES: readonly PersonStatus[] = ["recruit", "scion", "retired", "lost"];
const POTENTIALS: readonly PotentialTier[] = ["common", "promising", "gifted", "prodigy"];

export interface PackedPeople {
  /** Every string the rows refer to. */
  dict: string[];
  /** One varint string per person (`encodeInts`, signed values zigzagged, lists length-first). */
  rows: string[];
}

/** Builds a dictionary of strings, each written once. */
function dictionary() {
  const dict: string[] = [];
  const index = new Map<string, number>();
  const ref = (str: string): number => {
    let i = index.get(str);
    if (i === undefined) {
      i = dict.length;
      dict.push(str);
      index.set(str, i);
    }
    return i;
  };
  return { dict, ref };
}

const zig = (n: number) => (n >= 0 ? 2 * n : -2 * n - 1);
const zag = (z: number) => (z % 2 === 0 ? z / 2 : -(z + 1) / 2);

/** Trailing zeros dropped, so mostly-empty counters cost nothing. */
const trimZeros = (xs: number[]): number[] => {
  let n = xs.length;
  while (n > 0 && xs[n - 1] === 0) n--;
  return xs.slice(0, n);
};

export function packPeople(people: readonly Person[]): PackedPeople {
  const { dict, ref } = dictionary();
  const rows = people.map((p) => {
    const out: number[] = [];
    const int = (n: number) => out.push(zig(n));
    const list = (xs: readonly number[]) => {
      int(xs.length);
      xs.forEach(int);
    };
    const refs = (strs: readonly string[]) => list(strs.map(ref));
    int(p.id);
    int(STATUSES.indexOf(p.status));
    int(p.house);
    int(p.host);
    int(ref(p.name));
    int(p.sex === "f" ? 0 : 1);
    refs(p.look);
    int(p.age);
    p.base.forEach(int);
    p.growth.forEach(int);
    p.carry.forEach(int);
    int(POTENTIALS.indexOf(p.potential));
    int(p.level);
    int(p.xp);
    int(p.job === null ? -1 : ref(p.job));
    int(p.secondary === undefined ? -1 : ref(p.secondary));
    list(Object.entries(p.jp).flatMap(([job, jp]) => [ref(job), jp ?? 0]));
    refs(p.mastered);
    refs(p.learned);
    refs(p.passives);
    refs(p.traits);
    int(ref(p.tarot));
    int(p.reversed ? 1 : 0);
    list(p.aff ? ELEMENTS.map((e) => p.aff?.[e] ?? 0) : []);
    list(p.injuries.flatMap((inj) => [ref(inj.id), inj.years]));
    int(p.sanity);
    int(p.mp);
    list(trimZeros(GEAR_SLOTS.map((slot) => p.gear[slot] ?? 0)));
    list(trimZeros(HIST_KEYS.map((key) => p.hist[key] ?? 0)));
    int(p.loyalty ?? -1);
    int(p.wardSince ?? -1);
    list((p.blessed ?? []).flatMap((b) => [ref(b.id), b.years]));
    list(p.lost ? [p.lost.year, ref(p.lost.pool), p.lost.level] : []);
    // A Change (§9.6) and the body it replaced.
    int(p.change ? ref(p.change.id) : -1);
    if (p.change) {
      const w = p.change.was;
      int(w.level);
      w.base.forEach(int);
      w.growth.forEach(int);
      w.carry.forEach(int);
      refs(w.traits);
      refs(w.look);
      list(w.injuries.flatMap((inj) => [ref(inj.id), inj.years]));
      int(w.job === null ? -1 : ref(w.job));
      int(w.secondary === undefined ? -1 : ref(w.secondary));
    }
    list(p.post ?? []);
    // Their own gambits (gambitset.ts): when, do, and target (+1, 0 for none). Older saves end before it.
    list((p.gambits ?? []).flatMap((g) => [ref(g.if ?? "always"), ref(g.do), g.target ? ref(g.target) + 1 : 0]));
    return encodeInts(out);
  });
  return { dict, rows };
}

const pairs = (xs: number[]): [number, number][] => Array.from({ length: xs.length / 2 }, (_, i) => [xs[2 * i]!, xs[2 * i + 1]!]);

/** The people a save holds. Throws on a malformed save; the caller (save.ts restore) catches. */
export function unpackPeople({ dict, rows }: PackedPeople): Person[] {
  const str = (i: number): string => {
    const s = dict[i];
    if (typeof s !== "string") throw new Error("bad save: string index");
    return s;
  };
  return rows.map((row) => {
    const xs = decodeInts(row);
    let at = 0;
    const int = (): number => {
      if (at >= xs.length) throw new Error("bad save: short row");
      return zag(xs[at++]!);
    };
    const six = () => Array.from({ length: 6 }, int) as Six;
    const list = (): number[] => Array.from({ length: int() }, int);
    const strs = () => list().map(str);
    const id = int();
    const status = STATUSES[int()] ?? "recruit";
    const house = int();
    const host = int();
    const name = str(int());
    const sex = int() === 0 ? "f" : "m";
    const look = strs();
    const age = int();
    const base = six();
    const growth = six();
    const carry = six();
    const potential = POTENTIALS[int()] ?? "common";
    const level = int();
    const xp = int();
    const job = int();
    const secondary = int();
    const jp = Object.fromEntries(pairs(list()).map(([j, n]) => [str(j), n]));
    const mastered = strs() as JobId[];
    const learned = strs();
    const passives = strs();
    const traits = strs();
    const tarot = str(int());
    const reversed = int();
    const aff = list();
    const injuries = pairs(list()).map(([i, years]) => ({ id: str(i), years }));
    const sanity = int();
    const mp = int();
    const gear = list();
    const hist = list();
    const loyalty = int();
    const wardSince = int();
    const blessed = pairs(list()).map(([i, years]) => ({ id: str(i), years }));
    const lost = list();
    const changed = int();
    let change: Person["change"];
    if (changed !== -1) {
      const level = int();
      const [b, g, c] = [six(), six(), six()];
      const [traits, look] = [strs(), strs()];
      const injuries = pairs(list()).map(([i, years]) => ({ id: str(i), years }));
      const [j, sec] = [int(), int()];
      change = { id: str(changed), was: { level, base: b, growth: g, carry: c, traits, look, injuries, job: j === -1 ? null : (str(j) as JobId) } };
      if (sec !== -1) change.was.secondary = str(sec) as JobId;
    }
    const post = list();
    const rules = at < xs.length ? list() : [];
    const person: Person = {
      id, status, house, host, name, sex, look, age, base, growth, carry, potential, level, xp,
      job: job === -1 ? null : (str(job) as JobId),
      jp, mastered, learned, passives, traits, tarot, injuries, sanity, mp,
      gear: Object.fromEntries(gear.flatMap((item, i) => (item ? [[GEAR_SLOTS[i]!, item]] : []))),
      hist: Object.fromEntries(hist.flatMap((n, i) => (n ? [[HIST_KEYS[i]! as HistKey, n]] : []))),
    };
    if (secondary !== -1) person.secondary = str(secondary) as JobId;
    if (reversed) person.reversed = true;
    if (aff.length) person.aff = Object.fromEntries(aff.flatMap((n, i) => (n ? [[ELEMENTS[i]! as Element, n]] : [])));
    if (loyalty !== -1) person.loyalty = loyalty;
    if (wardSince !== -1) person.wardSince = wardSince;
    if (blessed.length) person.blessed = blessed;
    if (lost.length === 3) person.lost = { year: lost[0]!, pool: str(lost[1]!), level: lost[2]! };
    if (change) person.change = change;
    if (post.length === 2) person.post = [post[0]!, post[1]!];
    if (rules.length) {
      person.gambits = Array.from({ length: rules.length / 3 }, (_, i) => {
        const [w, d, t] = rules.slice(3 * i, 3 * i + 3) as [number, number, number];
        const when = str(w);
        return { ...(when !== "always" ? { if: when } : {}), do: str(d), ...(t ? { target: str(t - 1) } : {}) };
      });
    }
    return person;
  });
}

/** 64 JSON-safe characters: a value's last 5-bit digit uses the first 32, earlier digits the other 32. */
const DIGITS = "0123456789abcdefghijklmnopqrstuvABCDEFGHIJKLMNOPQRSTUVWXYZ-_.~!*";

/** Non-negative integers as base-32 varints: 0–31 take one character, up to 1023 two. */
export function encodeInts(xs: readonly number[]): string {
  let out = "";
  for (const x of xs) {
    if (!Number.isInteger(x) || x < 0) throw new RangeError(`cannot pack ${x}`);
    const digits: number[] = [];
    let v = x;
    do {
      digits.unshift(v & 31);
      v = Math.floor(v / 32);
    } while (v > 0);
    digits.forEach((d, i) => (out += DIGITS[i < digits.length - 1 ? d + 32 : d]));
  }
  return out;
}

export function decodeInts(str: string): number[] {
  const out: number[] = [];
  let v = 0;
  for (const ch of str) {
    const d = DIGITS.indexOf(ch);
    if (d < 0) throw new RangeError(`bad character ${ch}`);
    v = v * 32 + (d & 31);
    if (d < 32) {
      out.push(v);
      v = 0;
    }
  }
  return out;
}

/**
 * Items packed tighter still, since a late campaign holds hundreds: per House, one string of varints
 * (`encodeInts`), items in id order, each `idDelta, base, tier × 16 + ilvl, flags, propCount,
 * (prop, value)…`, then `dented` if flags has 1 and `named` if flags has 4 (2 is cursed). Strings go
 * through the dictionary. Property values are whole numbers.
 */
export interface PackedItems {
  dict: string[];
  houses: string[];
}

export function packItems(items: readonly Item[]): PackedItems {
  const { dict, ref } = dictionary();
  const houses: number[][] = [];
  const last: number[] = [];
  for (const it of [...items].sort((a, b) => a.id - b.id)) {
    const out = (houses[it.house] ??= []);
    const flags = (it.dented ? 1 : 0) | (it.cursed ? 2 : 0) | (it.named !== undefined ? 4 : 0);
    out.push(it.id - (last[it.house] ?? 0), ref(it.base), it.tier * 16 + it.ilvl, flags, it.props?.length ?? 0);
    for (const [id, v] of it.props ?? []) out.push(ref(id), v);
    if (it.dented) out.push(it.dented);
    if (it.named !== undefined) out.push(ref(it.named));
    last[it.house] = it.id;
  }
  return { dict, houses: Array.from({ length: houses.length }, (_, h) => encodeInts(houses[h] ?? [])) };
}

export function unpackItems(packed: PackedItems): Item[] {
  const { dict } = packed;
  const items: Item[] = [];
  packed.houses.forEach((str, house) => {
    const xs = decodeInts(str);
    let id = 0;
    for (let i = 0; i < xs.length; ) {
      id += xs[i++]!;
      const base = dict[xs[i++]!]!;
      const ti = xs[i++]!;
      const flags = xs[i++]!;
      const n = xs[i++]!;
      const item: Item = { id, base, tier: Math.floor(ti / 16) as ItemTier, ilvl: ti % 16, house };
      if (n) {
        item.props = [];
        for (let k = 0; k < n; k++, i += 2) item.props.push([dict[xs[i]!]!, xs[i + 1]!]);
      }
      if (flags & 1) item.dented = xs[i++]!;
      if (flags & 2) item.cursed = true;
      if (flags & 4) item.named = dict[xs[i++]!]!;
      items.push(item);
    }
  });
  return items.sort((a, b) => a.id - b.id);
}
