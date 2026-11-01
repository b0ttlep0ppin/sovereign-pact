// Parties as the campaign makes them, for the simulator (HANDOFF §7): rolled recruits promoted into a
// Job, levelled through the growth accumulator, JP spent on the Job's abilities (and the prerequisite
// Jobs' for advanced ones), passives equipped to the budget, and real items at the level's tier.
import type { Rng } from "../../../rng.ts";
import { createRng } from "../../../rng.ts";
import { ABILITY_SET_BY_JOB, JOB_BY_ID } from "../content.ts";
import { promote, rollRecruit } from "../generate.ts";
import { equip, gearTotals, mint } from "../items.ts";
import { changeJob, equipPassive, gainJp, jpLeft, knows, learn, passiveBudget, passivePoints, setSecondary } from "../progression.ts";
import type { BASE_JOBS, ItemTier, JobId, Person, SovState } from "../state.ts";
import { TUNING } from "../tuning.ts";
import { scionCombatant } from "./build.ts";
import { encounterBattle, type EncounterSpec } from "./encounter.ts";
import { atLevel } from "./fixtures.ts";
import type { Battle, Combatant } from "./types.ts";

const S = TUNING.sim;

/** Each Job's sim loadout and where it stands: weapons by item base, the off hand, and its column. */
export const LOADOUTS: Record<JobId, { main: string; off?: string; col: 0 | 1 | 2 }> = {
  soldier: { main: "sword", off: "heater_shield", col: 0 },
  knight: { main: "spear", col: 1 },
  magus: { main: "staff", col: 2 },
  soothsayer: { main: "staff", col: 2 },
  vagabond: { main: "bow", col: 2 },
  pugilist: { main: "knuckles", col: 0 },
  minstrel: { main: "instrument", col: 2 },
  gambler: { main: "crossbow", col: 2 },
  ravager: { main: "greataxe", col: 0 },
  sword_saint: { main: "greatsword", col: 0 },
  abjurer: { main: "mace", off: "heater_shield", col: 1 },
  conjurer: { main: "staff", col: 2 },
  tinkerer: { main: "crossbow", col: 2 },
  alterer: { main: "knife", off: "knife", col: 0 },
};

const ARMOR = { light: ["hood", "jerkin", "gloves", "boots"], medium: ["coif", "hauberk", "bracers", "greaves"], heavy: ["helm", "plate", "gauntlets", "sabatons"] } as const;

/** Buys the Job's actives, then its passives, in content order while the JP last. */
function spend(p: Person): Person {
  const set = ABILITY_SET_BY_JOB.get(p.job!);
  if (!set) return p;
  let q = p;
  for (const a of [...set.actives, ...set.passives]) {
    if (a.later || knows(q, a.id) || jpLeft(q, q.job!) < a.jp) continue;
    q = learn(q, a.id);
  }
  return q;
}

/** The item tier a Scion of this level carries (§13.4): Common, then Fine, then Masterwork. */
export const tierFor = (level: number): ItemTier => (S.tiers.filter(([from]) => level >= from).at(-1)?.[1] ?? 2) as ItemTier;

/** A Scion in `job` at `level`, built the way the campaign would build one. */
export function realScion(rng: Rng, id: number, job: JobId, level: number): Person {
  const def = JOB_BY_ID.get(job)!;
  const first = (def.requires?.[0]?.job ?? job) as (typeof BASE_JOBS)[number];
  let p = atLevel(promote(rollRecruit(rng, id, 0), first), level);
  let budget = level * S.jpPerLevel;
  for (const r of def.requires ?? []) {
    p = spend(gainJp(changeJob(p, r.job), r.jp, r.job));
    budget -= r.jp;
  }
  p = spend(gainJp(changeJob(p, job), Math.max(S.jpFloor, budget), job));
  if (def.requires?.length && p.learned.some((x) => ABILITY_SET_BY_JOB.get(first)?.actives.some((a) => a.id === x))) p = setSecondary(p, first);
  for (const x of ABILITY_SET_BY_JOB.get(job)?.passives ?? []) {
    if (!knows(p, x.id) || x.later || passivePoints(p) + x.points > passiveBudget(p)) continue;
    p = equipPassive(p, x.id);
  }
  return p;
}

/** Gear for `p` from the loadout, at the tier and item level its Scion level fights at. */
export function outfit(p: Person, level: number): SovState {
  const s = { items: [], people: [], nextId: 100_000 } as unknown as SovState;
  const look = LOADOUTS[p.job!];
  const tier = tierFor(level);
  const ilvl = Math.max(1, Math.round(level / 3));
  const put = (base: string, slot: Parameters<typeof equip>[3]) => equip(s, p, mint(s, base, p.host, tier, ilvl), slot);
  p.gear = {};
  put(look.main, "main");
  if (look.off) put(look.off, "off");
  for (const [i, base] of ARMOR[JOB_BY_ID.get(p.job!)!.armor].entries()) put(base, (["head", "body", "arms", "legs"] as const)[i]!);
  return s;
}

/** A party of the given Jobs at Scion level `level`, laid out by each Job's column. */
export function realParty(seed: number, level: number, jobs: readonly JobId[], firstId = 1): Combatant[] {
  const rng = createRng(seed);
  const rows: Record<number, number> = { 0: 2, 1: 3, 2: 2 };
  return jobs.map((job, i) => {
    const p = realScion(rng, firstId + i, job, level);
    const s = outfit(p, level);
    const col = LOADOUTS[job].col;
    const row = rows[col]!;
    rows[col] = row + 2;
    return scionCombatant(p, { id: firstId + i, col, row: row % 8, gear: gearTotals(s, p) });
  });
}

/** The real-Scion baseline party: a Soldier in Front, a Knight in Middle, a Vagabond and a Soothsayer at the Back. */
export const BASELINE: readonly JobId[] = ["soldier", "knight", "vagabond", "soothsayer"];

/** The baseline with `job` in place of the member standing in its column (the Vagabond for the Back). */
export function withJob(job: JobId): JobId[] {
  const slot = [0, 1, 2][LOADOUTS[job].col]!;
  return BASELINE.map((j, i) => (i === slot ? job : j));
}

/** What the simulator fights by default: a Barrows Warband with no Ambush or Surprise. */
export type FightSpec = Partial<Omit<EncounterSpec, "party" | "level">>;
const FIGHT = { pool: "barrows", template: "warband", modifier: null } as const;

/** An Encounter (§14.4) against a real party at Scion level 3L (§14.2). */
export function realBattle(seed: number, level: number, jobs: readonly JobId[], fight: FightSpec = {}): Battle {
  return encounterBattle(seed, realParty(seed, level * 3, jobs), { ...FIGHT, ...fight, level }).battle;
}
