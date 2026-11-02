// Statuses (§10.8): what kind each is (for resist checks and cures), what it does to the clock and to
// a turn, and applying and ending them. Damage-over-time pulses run in clock.ts.
import type { Rng } from "../../../rng.ts";
import { ABILITY_SETS, FORMS } from "../content.ts";
import { TUNING } from "../tuning.ts";
import { hasStatus } from "./grid.ts";
import type { Battle, Combatant, StatusInst, StatusKind } from "./types.ts";

export interface StatusMeta {
  kind: StatusKind;
  /** CT does not grow while it lasts. */
  freezes?: boolean;
  /** The combatant cannot act on its turn. */
  blocks?: boolean;
  /** Ends a charge in progress when applied (§10.5). Silence only ends spells. */
  cancelsCharge?: boolean | "spells";
  /** Bosses ignore it (§10.10); their adds do not. */
  bossImmune?: boolean;
  /** Ends when the combatant is hit. */
  wakesOnHit?: boolean;
  /** Used up on the combatant's next turn. */
  oneTurn?: boolean;
  /** Ends when the combatant's next turn starts, without costing it (Mirror Stance). */
  endsOnTurn?: boolean;
  /** Never dispelled or cured: it ends by its own rule (a Form's status ends with the Form). */
  fixed?: boolean;
  /** Default duration in ticks when none is given (0: battle). */
  ticks: number;
}

export const STATUSES: Record<string, StatusMeta> = {
  poison: { kind: "physical", ticks: 300 },
  bleed: { kind: "physical", ticks: 0 },
  stun: { kind: "physical", ticks: 100, freezes: true, blocks: true, cancelsCharge: true },
  knockdown: { kind: "physical", ticks: 0, oneTurn: true, cancelsCharge: true },
  slow: { kind: "physical", ticks: 300 },
  haste: { kind: "buff", ticks: 300 },
  /** Actions cost half their CT: it acts twice as often (§14.6 Infernal Order). */
  quickened: { kind: "buff", ticks: 300 },
  stop: { kind: "physical", ticks: 150, freezes: true, blocks: true, bossImmune: true },
  blind: { kind: "physical", ticks: 300 },
  burn: { kind: "physical", ticks: 300 },
  frozen: { kind: "physical", ticks: 200 },
  disease: { kind: "physical", ticks: 0 },
  disarmed: { kind: "physical", ticks: 0 },
  berserk: { kind: "mental", ticks: 300 },
  confusion: { kind: "mental", ticks: 200 },
  sleep: { kind: "mental", ticks: 300, freezes: true, blocks: true, cancelsCharge: true, wakesOnHit: true, bossImmune: true },
  charm: { kind: "mental", ticks: 200, bossImmune: true },
  fear: { kind: "mental", ticks: 300 },
  silence: { kind: "mental", ticks: 200, cancelsCharge: "spells" },
  deaf: { kind: "mental", ticks: 0 },
  madness: { kind: "mental", ticks: 0 },
  skip_turn: { kind: "mental", ticks: 0, oneTurn: true },
  protect: { kind: "buff", ticks: 300 },
  shell: { kind: "buff", ticks: 300 },
  regen: { kind: "buff", ticks: 300 },
  mp_regen: { kind: "buff", ticks: 300 },
  tp_regen: { kind: "buff", ticks: 300 },
  reflect: { kind: "buff", ticks: 0 },
  guard_up: { kind: "buff", ticks: 300 },
  provoke: { kind: "buff", ticks: 300 },
  hidden: { kind: "buff", ticks: 100 },
  shield: { kind: "buff", ticks: 0 },
  enrage: { kind: "buff", ticks: 300 },
  marked: { kind: "debuff", ticks: 200 },
  /** A lurker that leapt into the formation (§14.3): any Scion's melee reaches it until its next turn. */
  exposed: { kind: "debuff", ticks: 0, endsOnTurn: true },
  rooted: { kind: "physical", ticks: 200 },
  /** Wine (§13.7): its Accuracy malus rides in its mods. */
  tipsy: { kind: "debuff", ticks: 100 },
  /** Consumables (§13.7), their effects in their mods: a weapon edge (Ember Oil, Brine, Stormwax)… */
  edged: { kind: "buff", ticks: 0 },
  /** …Oathwine's +damage… */
  oathbound: { kind: "buff", ticks: 0 },
  /** …Grave Dust's Turning: the undead flee as if Afraid, though they are fearless… */
  turned: { kind: "debuff", ticks: 200 },
  /** …the Mourning Veil's Sanity-proofing… */
  veiled: { kind: "buff", ticks: 0 },
  /** …the Bottled Chorus's March without a Minstrel… */
  bottled_chorus: { kind: "buff", ticks: 200 },
  /** …and Blackroot Chew's Durability each turn. */
  blackroot: { kind: "buff", ticks: 300 },
  /** Answers the next melee blow with a counter, then ends (§14.7 the Cursed King's Royal Parry). */
  parry: { kind: "buff", ticks: 300 },
  /** Under the water (§14.6 Scylla): nothing can target or reach it, area or not, until it surfaces. */
  submerged: { kind: "buff", ticks: 200, fixed: true },
  /** Shielded by its own Parts (§14.6 Orochi's body): untouchable like Submerged, until a phase clears it. */
  guarded: { kind: "buff", ticks: 0, fixed: true },
  // From Job abilities (§12.4–12.11): their value is the %.
  counter_up: { kind: "buff", ticks: 500 },
  thorns: { kind: "buff", ticks: 200 },
  envenom: { kind: "buff", ticks: 300 },
  hex: { kind: "debuff", ticks: 300 },
  loaded_dice: { kind: "buff", ticks: 0 },
  loaded_card: { kind: "debuff", ticks: 0 },
  // Statuses that carry their effect as mods (§12.12–12.13): Steal Strength, Frenzy, Unstoppable.
  might_up: { kind: "buff", ticks: 300 },
  might_down: { kind: "debuff", ticks: 300 },
  frenzy: { kind: "buff", ticks: 500 },
  unstoppable: { kind: "buff", ticks: 300 },
  mirror_stance: { kind: "buff", ticks: 0, endsOnTurn: true },
  // The Abjurer's wards (§12.14): a Brand's element rides in its mods; a Null Zone stops casting.
  enchant: { kind: "buff", ticks: 300 },
  anchored: { kind: "buff", ticks: 300 },
  null_zone: { kind: "debuff", ticks: 200, cancelsCharge: "spells" },
  // The Alterer (§12.17): a Revert's Exhaustion and a Graft.
  exhausted: { kind: "debuff", ticks: 300 },
  graft: { kind: "buff", ticks: 200 },
};

// A Form's mods ride on a status of its own, which only Revert removes.
for (const f of FORMS) STATUSES[`form_${f.id}`] = { kind: "buff", ticks: 0, fixed: true };

// Songs are statuses on their hearers: buffs on allies, debuffs on enemies (§12.2).
for (const set of ABILITY_SETS)
  for (const a of set.actives) if (a.song) STATUSES[a.id] = { kind: a.side === "foe" ? "debuff" : "buff", ticks: 0 };

export const meta = (id: string): StatusMeta => STATUSES[id] ?? { kind: "debuff", ticks: 0 };

export const isMental = (id: string): boolean => meta(id).kind === "mental";

/** Resist % against an ailment: physical from Resilience, mental from Acuity (§7.3, §10.6 step 7). */
export function resistOf(u: Combatant, id: string): number {
  const kind = meta(id).kind;
  if (kind === "buff" || kind === "debuff") return 0;
  // Resistant: <ailment> armor adds to that one ailment (§13.4).
  return (kind === "mental" ? u.resist.mental : u.resist.physical) + (u.mods[`resist.${id}`] ?? 0);
}

export function isImmune(u: Combatant, id: string): boolean {
  if (u.hazard || u.immune.includes(id) || u.mods[`immune.${id}`]) return true;
  if (u.boss && meta(id).bossImmune) return true;
  if (u.lastStand && id === "fear") return true;
  return false;
}

/** Puts a status on, replacing a weaker copy. Returns whether it took hold. Pushes the event. */
export function addStatus(b: Battle, u: Combatant, id: string, ticks?: number, extra?: Partial<StatusInst>): boolean {
  if (u.dead || isImmune(u, id)) return false;
  const m = meta(id);
  const inst: StatusInst = { id, ticks: ticks ?? m.ticks, ...extra };
  const i = u.statuses.findIndex((s) => s.id === id);
  if (i >= 0) {
    const old = u.statuses[i]!;
    addMods(u, old.mods, -1);
    // Battle-long beats timed; a longer time beats a shorter; values add for Shields.
    const ticksLeft = old.ticks === 0 || inst.ticks === 0 ? 0 : Math.max(old.ticks, inst.ticks);
    u.statuses[i] = { ...old, ...inst, ticks: ticksLeft, value: id === "shield" ? (old.value ?? 0) + (inst.value ?? 0) : inst.value ?? old.value };
  } else u.statuses.push(inst);
  addMods(u, inst.mods, 1);
  b.events.push({ t: "status", target: u.id, status: id, on: true });
  if (id === "stun") u.ct = 0;
  // A Silenced or Deaf Minstrel stops playing (§12.2).
  if ((id === "silence" || id === "deaf") && u.songs) endSongs(b, u);
  if (u.charge && (m.cancelsCharge === true || (m.cancelsCharge === "spells" && u.charge.ability.kind === "magic"))) {
    b.events.push({ t: "cancel", unit: u.id, ability: u.charge.ability.id });
    delete u.charge;
  }
  return true;
}

/** An ability's chance to inflict, then the target's resist (§10.6 step 7). No `ticks`: the status's own default; 0: the whole battle. */
export function tryStatus(b: Battle, rng: Rng, u: Combatant, id: string, chance: number, ticks?: number, value?: number, mods?: Record<string, number>): boolean {
  if (rng.int(100) >= chance) return false;
  if (rng.int(100) < resistOf(u, id)) return false;
  return addStatus(b, u, id, ticks, extraOf(value, mods));
}

/** A status's value and mods, as `addStatus` takes them. */
export function extraOf(value?: number, mods?: Record<string, number>): Partial<StatusInst> | undefined {
  if (value === undefined && !mods) return undefined;
  return { ...(value === undefined ? {} : { value }), ...(mods ? { mods } : {}) };
}

/** Adds (sign 1) or takes back (−1) a status's mods. */
function addMods(u: Combatant, mods: Record<string, number> | undefined, sign: 1 | -1): void {
  for (const [k, v] of Object.entries(mods ?? {})) {
    u.mods[k] = (u.mods[k] ?? 0) + sign * v;
    if (u.mods[k] === 0) delete u.mods[k];
  }
}

/** Ends a Minstrel's songs (all layers, or one): every hearer loses them. */
export function endSongs(b: Battle, u: Combatant, layer?: keyof NonNullable<Combatant["songs"]>): void {
  const ids = layer ? [u.songs?.[layer]] : Object.values(u.songs ?? {});
  for (const id of ids) {
    if (!id) continue;
    for (const t of b.units) if (t.statuses.some((s) => s.id === id && s.src === u.id)) removeStatus(b, t, id);
  }
  if (layer && u.songs) delete u.songs[layer];
  else delete u.songs;
}

export function removeStatus(b: Battle, u: Combatant, id: string): void {
  if (!hasStatus(u, id)) return;
  for (const s of u.statuses) if (s.id === id) addMods(u, s.mods, -1);
  u.statuses = u.statuses.filter((s) => s.id !== id);
  b.events.push({ t: "status", target: u.id, status: id, on: false });
}

export const statusValue = (u: Combatant, id: string): number | undefined => u.statuses.find((s) => s.id === id)?.value;

/** Speed after Haste and Slow (§10.4) and lasting mods; at least 1. */
export function speedOf(u: Combatant): number {
  let s = u.speed + (u.mods.speed ?? 0);
  if (hasStatus(u, "haste")) s += 2;
  if (hasStatus(u, "slow")) s -= 2;
  return Math.max(1, s);
}

export const frozenClock = (u: Combatant): boolean => u.statuses.some((s) => meta(s.id).freezes);

/** Counts statuses down one clock step; ends the ones that ran out. */
export function tickStatuses(b: Battle, u: Combatant): void {
  const step = TUNING.combat.ticksPerStep;
  // Requiem: an enemy's buffs run out faster.
  const decay = 1 + (u.mods.buffDecay ?? 0);
  for (const s of [...u.statuses]) {
    if (s.ticks === 0) continue;
    s.ticks -= meta(s.id).kind === "buff" ? step * decay : step;
    if (s.ticks <= 0) removeStatus(b, u, s.id);
  }
}
