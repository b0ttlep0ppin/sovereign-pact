// The six stats as a battle reads them (§7.2): the rolled base in the primary Job (§12.3), then every
// flat and percent bonus a Person carries: their birth House, traits, Change, Tarot, lasting injuries,
// their Job's innate passive, worn gear, and, for their own House only, masteries and chosen passives.
// The character card shows these, each with the bonuses that made it.
import { CHANGE_BY_ID, INJURY_BY_ID, JOB_BY_ID, JOB_PASSIVE_BY_ID, TAROT_BY_ID, TRAIT_BY_ID } from "./content.ts";
import { jobStat } from "./formulas.ts";
import { houseEffects } from "./houses.ts";
import { gearTotals } from "./items.ts";
import { tarotMods } from "./progression.ts";
import { ELEMENTS, STATS, type House, type Person, type Six, type SovState, type Stat } from "./state.ts";

interface Source {
  name: string;
  mods: Record<string, number> | undefined;
}

/** Where a Person's stat bonuses come from, by name. `own`: the viewer's own, whose passives they know. */
function sources(s: Pick<SovState, "items" | "houses">, p: Person, own: boolean): Source[] {
  const out: Source[] = [];
  const house: House | undefined = s.houses[p.house];
  if (house) out.push({ name: `House ${house.name}`, mods: houseEffects(house).mods });
  for (const id of p.traits) out.push({ name: TRAIT_BY_ID.get(id)?.name ?? id, mods: TRAIT_BY_ID.get(id)?.mods });
  if (p.change) out.push({ name: CHANGE_BY_ID.get(p.change.id)?.name ?? p.change.id, mods: CHANGE_BY_ID.get(p.change.id)?.mods });
  const tarot = TAROT_BY_ID.get(p.tarot);
  if (tarot) out.push({ name: `${tarot.name}${p.reversed ? " (reversed)" : ""}`, mods: tarotMods(p) });
  for (const inj of p.injuries) {
    const res = INJURY_BY_ID.get(inj.id);
    if (res) out.push({ name: res.name, mods: { ...res.lasting?.mods, ...res.stat } });
  }
  const job = p.job ? JOB_BY_ID.get(p.job) : undefined;
  if (job) out.push({ name: job.innate.name, mods: job.innate.mods });
  if (own) {
    for (const id of p.mastered) {
      const m = JOB_BY_ID.get(id)?.mastery;
      if (m) out.push({ name: m.name, mods: m.mods });
    }
    for (const id of p.passives) out.push({ name: JOB_PASSIVE_BY_ID.get(id)?.name ?? id, mods: JOB_PASSIVE_BY_ID.get(id)?.mods });
  }
  if (Object.keys(p.gear ?? {}).length) out.push({ name: "Gear", mods: gearTotals(s, p).mods });
  return out;
}

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/**
 * Each stat as a battle reads it, and the lines that explain it ("×1.2 Knight", "+1 Fleet"), in
 * STATS order. Speed takes flat bonuses only; the others take flat bonuses, then percents.
 */
export function shownStats(
  s: Pick<SovState, "items" | "houses">,
  p: Person,
  own: boolean,
): { stats: Six; from: string[][]; aff: number[]; affFrom: string[][] } {
  const all = sources(s, p, own);
  const job = p.job ? JOB_BY_ID.get(p.job) : undefined;
  const stats: number[] = [];
  const from: string[][] = [];
  for (const k of STATS) {
    const lines: string[] = [];
    const sum = (key: string) =>
      all.reduce((n, src) => {
        const v = src.mods?.[key] ?? 0;
        if (v) lines.push(`${signed(v)}${key.endsWith("Pct") ? "%" : ""} ${src.name}`);
        return n + v;
      }, 0);
    const before = jobStat(p, k);
    if (job && k === "speed" && job.speed) lines.push(`${signed(job.speed)} ${job.name}`);
    else if (job && k !== "speed" && (job.mult[k as Exclude<Stat, "speed">] ?? 1) !== 1) lines.push(`×${job.mult[k as Exclude<Stat, "speed">]} ${job.name}`);
    if (k === "speed") stats.push(Math.max(1, before + sum("speed")));
    else {
      const flat = sum(`${k}Flat`);
      const pct = sum(`${k}Pct`);
      stats.push(Math.max(1, Math.floor((before + flat) * (1 + pct / 100))));
    }
    from.push(lines);
  }
  // Elemental affinity in ELEMENTS order (§7.3): +50 takes half, −50 half again; born, then warded or exposed.
  const aff: number[] = [];
  const affFrom: string[][] = [];
  for (const el of ELEMENTS) {
    const lines: string[] = [];
    const born = p.aff?.[el] ?? 0;
    if (born) lines.push(`${signed(born)} born`);
    let n = born;
    for (const src of all) {
      const v = src.mods?.[`ward.${el}`] ?? 0;
      if (v) lines.push(`${signed(v)} ${src.name}`);
      n += v;
    }
    aff.push(n);
    affFrom.push(lines);
  }
  return { stats: stats as Six, from, aff, affFrom };
}
