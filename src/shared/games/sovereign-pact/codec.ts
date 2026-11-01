// The save's compact form of `people` (§4.4: 64 KB for a whole late campaign). People are most of a
// save, and as objects their field names and repeated content ids would be most of that. Here each
// person is a fixed-order array, and every string (content ids, names) is written once into a
// dictionary and referenced by its index. Content is still stored by id, so reordering or adding
// content never breaks a save; only this field order is part of the save format (SAVE_VERSION).
import {
  ELEMENTS,
  GEAR_SLOTS,
  HIST_KEYS,
  type Element,
  type HistKey,
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
  rows: unknown[][];
}

/** Trailing zeros dropped, so mostly-empty counters cost nothing. */
const trimZeros = (xs: number[]): number[] => {
  let n = xs.length;
  while (n > 0 && xs[n - 1] === 0) n--;
  return xs.slice(0, n);
};

export function packPeople(people: readonly Person[]): PackedPeople {
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
  const refs = (strs: readonly string[]) => strs.map(ref);
  const rows = people.map((p) => [
    p.id,
    STATUSES.indexOf(p.status),
    p.house,
    p.host,
    ref(p.name),
    p.sex === "f" ? 0 : 1,
    refs(p.look),
    p.age,
    p.base,
    p.growth,
    p.carry,
    POTENTIALS.indexOf(p.potential),
    p.level,
    p.xp,
    p.job === null ? -1 : ref(p.job),
    p.secondary === undefined ? -1 : ref(p.secondary),
    Object.entries(p.jp).flatMap(([job, jp]) => [ref(job), jp ?? 0]),
    refs(p.mastered),
    refs(p.learned),
    refs(p.passives),
    refs(p.traits),
    ref(p.tarot),
    p.reversed ? 1 : 0,
    p.aff ? ELEMENTS.map((e) => p.aff?.[e] ?? 0) : 0,
    p.injuries.flatMap((inj) => [ref(inj.id), inj.years]),
    p.sanity,
    p.mp,
    trimZeros(GEAR_SLOTS.map((slot) => p.gear[slot] ?? 0)),
    trimZeros(HIST_KEYS.map((key) => p.hist[key] ?? 0)),
    p.loyalty ?? -1,
  ]);
  return { dict, rows };
}

const pairs = (xs: number[]): [number, number][] => Array.from({ length: xs.length / 2 }, (_, i) => [xs[2 * i]!, xs[2 * i + 1]!]);

/** The people a save holds. Throws on a malformed save; the caller (save.ts restore) catches. */
export function unpackPeople({ dict, rows }: PackedPeople): Person[] {
  const str = (i: unknown): string => {
    const s = dict[i as number];
    if (typeof s !== "string") throw new Error("bad save: string index");
    return s;
  };
  const strs = (xs: unknown) => (xs as number[]).map(str);
  return rows.map((r) => {
    const [id, status, house, host, name, sex, look, age, base, growth, carry, potential, level, xp, job, secondary, jp, mastered, learned, passives, traits, tarot, reversed, aff, injuries, sanity, mp, gear, hist, loyalty] = r as [
      number, number, number, number, number, number, number[], number, Six, Six, Six, number, number, number, number, number,
      number[], number[], number[], number[], number[], number, number, number[] | 0, number[], number, number, number[], number[], number,
    ];
    const person: Person = {
      id,
      status: STATUSES[status] ?? "recruit",
      house,
      host,
      name: str(name),
      sex: sex === 0 ? "f" : "m",
      look: strs(look),
      age,
      base,
      growth,
      carry,
      potential: POTENTIALS[potential] ?? "common",
      level,
      xp,
      job: job === -1 ? null : (str(job) as JobId),
      jp: Object.fromEntries(pairs(jp).map(([j, n]) => [str(j), n])),
      mastered: strs(mastered) as JobId[],
      learned: strs(learned),
      passives: strs(passives),
      traits: strs(traits),
      tarot: str(tarot),
      injuries: pairs(injuries).map(([i, years]) => ({ id: str(i), years })),
      sanity,
      mp,
      gear: Object.fromEntries(gear.flatMap((item, i) => (item ? [[GEAR_SLOTS[i]!, item]] : []))),
      hist: Object.fromEntries(hist.flatMap((n, i) => (n ? [[HIST_KEYS[i]! as HistKey, n]] : []))),
    };
    if (secondary !== -1) person.secondary = str(secondary) as JobId;
    if (reversed) person.reversed = true;
    if (aff) person.aff = Object.fromEntries(aff.flatMap((n, i) => (n ? [[ELEMENTS[i]! as Element, n]] : [])));
    if (loyalty !== -1) person.loyalty = loyalty;
    return person;
  });
}
