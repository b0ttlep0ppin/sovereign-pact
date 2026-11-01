// The damage pipeline (§10.6): hit roll, location, crit, base damage, multipliers, apply, on-hit,
// injury check. Healing runs the same path without a hit roll. Every number is in tuning.ts.
import type { Rng } from "../../../rng.ts";
import { ELEMENTS, LOCATIONS, type Element, type Location } from "../state.ts";
import { TUNING } from "../tuning.ts";
import { hasStatus } from "./grid.ts";
import { down, injure, kill, steel, steelSanity } from "./injury.ts";
import { addStatus, meta, removeStatus, statusValue, tryStatus } from "./status.ts";
import type { AbilityDef, Battle, Combatant } from "./types.ts";

const C = TUNING.combat;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const pct = (n: number) => 1 + n / 100;

export const kindOf = (ab: AbilityDef): NonNullable<AbilityDef["kind"]> => ab.kind ?? "physical";

/** Physical abilities use the weapon's reach unless they name one; spells reach anywhere (§10.3). */
export const reachOf = (u: Combatant, ab: AbilityDef) => ab.reach ?? (kindOf(ab) === "physical" ? u.weapon.reach : "ranged");

const isMelee = (u: Combatant, ab: AbilityDef) => reachOf(u, ab) !== "ranged";

/** The chance in % that `u` lands `ab` on `t` (§7.3, §10.6 step 1). */
export function hitChance(u: Combatant, t: Combatant, ab: AbilityDef): number {
  if (t.down || hasStatus(t, "sleep") || hasStatus(t, "stun") || hasStatus(t, "stop")) return C.hitClamp[1];
  let chance: number;
  if (kindOf(ab) === "magic") chance = C.spellAccuracy.base + C.spellAccuracy.sagacity * u.sagacity;
  else {
    let evasion = t.evasion + (t.mods.evasion ?? 0) + (t.mods["turn.evasion"] ?? 0);
    if (hasStatus(t, "knockdown")) evasion += C.knockdownEvasion;
    if (hasStatus(t, "frozen")) evasion += C.frozenEvasion;
    const drill = reachOf(u, ab) !== "ranged" ? (u.mods.meleeAccuracy ?? 0) : 0;
    chance = u.weapon.acc + u.accuracy + (u.mods.accuracy ?? 0) + (u.mods["turn.accuracy"] ?? 0) + drill + (ab.accuracy ?? 0) - Math.max(0, evasion);
    if (hasStatus(u, "blind")) chance += C.blind;
  }
  if (t.charge) chance += C.chargingHitBonus;
  return clamp(chance, C.hitClamp[0], C.hitClamp[1]);
}

/** Aimed, biased (60%) or rolled Body 40 / Arms 25 / Legs 20 / Head 15 (§7.4). */
export function rollLocation(rng: Rng, ab: AbilityDef): Location {
  if (ab.aim) return ab.aim;
  if (ab.locationBias && rng.int(100) < C.locationBias) return ab.locationBias;
  let roll = rng.int(100);
  for (const loc of LOCATIONS) {
    roll -= C.locations[loc];
    if (roll < 0) return loc;
  }
  return "body";
}

/** Column modifier for the attacker's position (§10.3), in %. */
export function columnMod(u: Combatant, ab: AbilityDef): number {
  if (u.side !== "party" || kindOf(ab) === "heal" || kindOf(ab) === "support") return 0;
  if (isMelee(u, ab) && reachOf(u, ab) === "melee") return u.col === 0 ? C.frontMelee : u.col === 1 ? (u.mods.reaching ? 0 : C.middleMelee) : 0;
  if (u.weapon.kind === "bow" && kindOf(ab) === "physical" && u.col === 0) return C.bowFromFront;
  return 0;
}

/** Affinity multiplier: +50 resists half, −50 takes half again, +100 is immune (§7.3). */
export const affinityMult = (t: Combatant, el: Element | null | undefined) => (el ? 1 - clamp(t.affinity[el] ?? 0, -100, 100) / 100 : 1);

/** Damage before randomness-free multipliers: power × (1 + stat/25), or an enemy's level scale (§7.3, §14.2). */
export function baseDamage(u: Combatant, ab: AbilityDef): number {
  const kind = kindOf(ab);
  // A Scion's spell with no power of its own scales with the caster's level, like a weapon with its item level.
  const spell = u.enemyScale === undefined && (kind === "magic" || kind === "heal");
  const power = (ab.base ?? (spell ? spellBase(u.level) : u.weapon.power)) * ab.power;
  if (u.enemyScale !== undefined) return power * u.enemyScale;
  if (kind === "magic") return power * (1 + u.acuity / C.acuityDivisor) * (1 + (u.mods.spellPct ?? 0) / 100);
  if (kind === "heal") return power * (1 + u.sagacity / C.sagacityDivisor);
  // Spellbound weapons swing with Acuity when it is higher (§13.4).
  const might = u.mods.spellbound && ab.base === undefined ? Math.max(u.might, u.acuity) : u.might;
  return power * (1 + might / C.mightDivisor);
}

/** A spell's power at 1.0×: the power block at the expedition level a Scion of this level fights (L ≈ level / 3, §14.2). */
export function spellBase(level: number): number {
  const L = Math.max(1, level / C.spellLevelDivisor);
  return 6 + 3 * L + 0.1 * L * L;
}

/** Ability power after its conditions: an ally Down, a Marked target. */
function powerOf(b: Battle, u: Combatant, t: Combatant, ab: AbilityDef): number {
  let power = ab.power;
  if (ab.powerIfAllyDown && b.units.some((o) => o.side === u.side && o.down && !o.dead)) power = ab.powerIfAllyDown;
  if (ab.powerIfMarked && hasStatus(t, "marked")) power = ab.powerIfMarked;
  return power;
}

/** A plain weapon hit (the attack, a counter, weapon skills): weapon properties apply (§13.4). */
const isWeaponHit = (ab: AbilityDef) => kindOf(ab) === "physical" && ab.base === undefined;

/** The location a Headsman's, Hamstringer, Mauler or Breaker weapon favors. */
const biasOf = (u: Combatant): Location | undefined => LOCATIONS.find((l) => u.mods[`bias.${l}`]);

/** The element of an edge property, if the weapon has one. */
const edgeOf = (u: Combatant): Element | undefined => ELEMENTS.find((e) => u.mods[`edge.${e}`]);

/** Weapon properties that multiply damage against this target (§13.4), in %. */
function propertyBonus(b: Battle, u: Combatant, t: Combatant): number {
  let bonus = 0;
  for (const tag of t.tags) bonus += u.mods[`bane.${tag}`] ?? 0;
  if (t.size[0] * t.size[1] > 1) bonus += u.mods.giantPct ?? 0;
  if (t.hp < t.maxHp * C.props.executeBelow) bonus += u.mods.executePct ?? 0;
  if (u.mods.oathPct && b.units.some((o) => o.id !== u.id && o.side === u.side && o.house === u.house && !o.dead && !o.down))
    bonus += u.mods.oathPct;
  if (u.mods.hungry && !u.flags.includes("hungry_lost")) bonus += Math.min(C.props.hungryMax, u.kills * u.mods.hungry);
  return bonus;
}

const COUNTER: AbilityDef = { id: "counter", name: "Counter", shape: "single", side: "foe", power: 1 };

export interface HitResult {
  hit: boolean;
  damage: number;
  loc?: Location;
  crit?: boolean;
}

/** Context from the action: whether the ability was telegraphed (an injury step against). */
export interface StrikeOpts {
  telegraphed?: boolean;
  /** A counter-attack, which cannot itself be countered. */
  counter?: boolean;
}

/** One hit of `ab` from `u` on `t`, through the whole pipeline. */
export function strike(b: Battle, rng: Rng, u: Combatant, t: Combatant, ab: AbilityDef, opts: StrikeOpts = {}): HitResult {
  if (t.dead) return { hit: false, damage: 0 };
  if (kindOf(ab) === "heal" || kindOf(ab) === "support") {
    const healed = kindOf(ab) === "heal" ? heal(b, u, t, ab) : 0;
    supportEffects(b, rng, u, t, ab);
    return { hit: true, damage: -healed };
  }
  const weaponHit = isWeaponHit(ab);
  let missed = rng.int(100) >= hitChance(u, t, ab);
  // Cast Lots 11: the next hit cannot miss.
  const sure = u.flags.indexOf("sure_hit");
  if (sure >= 0 && t.side !== u.side) {
    u.flags.splice(sure, 1);
    missed = false;
  }
  // Mulligan: an ally's granted reroll of one miss.
  const mulligan = u.flags.indexOf("mulligan");
  if (missed && mulligan >= 0) {
    u.flags.splice(mulligan, 1);
    missed = rng.int(100) >= hitChance(u, t, ab);
  }
  // Lucky: one miss a battle is rolled again.
  if (missed && weaponHit && u.mods.lucky && !u.flags.includes("lucky_used")) {
    u.flags.push("lucky_used");
    missed = rng.int(100) >= hitChance(u, t, ab);
  }
  if (missed) {
    b.events.push({ t: "miss", unit: u.id, target: t.id });
    return { hit: false, damage: 0 };
  }
  const physical = kindOf(ab) === "physical";
  const bias = weaponHit && !ab.aim && !ab.locationBias ? biasOf(u) : undefined;
  if (bias) ab = { ...ab, locationBias: bias };
  const loc = t.dur || ab.aim || ab.locationBias ? rollLocation(rng, ab) : undefined;

  // Crit: base + weapon + ability, Head +10 (§10.6 step 3). A primed crit (Sanity "next_crit") always lands.
  const primed = u.flags.indexOf("next_crit");
  // Loaded Dice: the next attack's crit chance up, once. Lucky Streak: +2% per 7+ Cast Lots in a row.
  const loaded = statusValue(u, "loaded_dice") ?? 0;
  if (loaded) removeStatus(b, u, "loaded_dice");
  const streak = u.mods.luckyStreak ? (u.mods.lotsStreak ?? 0) * u.mods.luckyStreak : 0;
  let crit = rng.int(100) < C.crit.base + u.weapon.crit + (ab.crit ?? 0) + (u.mods.crit ?? 0) + loaded + streak + (loc === "head" ? C.crit.headBonus : 0);
  if (primed >= 0) {
    crit = true;
    u.flags.splice(primed, 1);
  }

  const power = powerOf(b, u, t, ab);
  if (power !== ab.power) ab = { ...ab, power };
  let dmg = baseDamage(u, ab);
  for (const tag of t.tags) dmg *= ab.vs?.[tag] ?? 1;
  const executing = !!ab.execute && t.hp < (t.maxHp * ab.execute.below) / 100;
  if (executing) dmg *= pct(ab.execute!.pct ?? 0);
  // Guard: a shield block halves the hit before the multipliers (§10.6 step 6).
  const guard = u.side !== t.side && physical ? t.guard + (hasStatus(t, "guard_up") ? C.guardUp : 0) : 0;
  if (guard > 0 && rng.int(100) < guard) dmg *= C.block / 100;

  dmg *= pct(columnMod(u, ab));
  const element = ab.element === undefined ? (physical ? u.weapon.element : undefined) : ab.element;
  dmg *= affinityMult(t, element);
  if (physical && hasStatus(t, "protect")) dmg *= pct(-C.protect);
  if (!physical && hasStatus(t, "shell")) dmg *= pct(-C.shell);
  if (!physical) dmg *= pct(-C.spellReduction * t.sagacity);
  if (physical && t.defending) dmg *= pct(-C.defend);
  if (physical && t.charge) dmg *= pct(C.chargingDamageTaken);
  if (hasStatus(t, "marked")) dmg *= pct(C.marked);
  dmg *= pct(statusValue(t, "hex") ?? 0);
  if (physical && hasStatus(u, "berserk")) dmg *= pct(C.berserk);
  if (hasStatus(u, "enrage")) dmg *= pct(C.enrage);
  if (u.lastStand) dmg *= pct(C.lastStand.damage);
  if (physical) dmg *= pct(u.mods.physicalDamagePct ?? 0);
  if (physical) dmg *= pct(t.mods.physicalTakenPct ?? 0);
  dmg *= pct(t.mods.damageTakenPct ?? 0);
  if (weaponHit) {
    dmg *= pct(propertyBonus(b, u, t));
    if (u.mods.charged && !u.flags.includes("charged_used")) {
      u.flags.push("charged_used");
      dmg *= C.props.chargedMult;
    }
  }
  // Bulwark: an adjacent ally's armor takes some of a physical blow.
  if (physical) {
    const wall = b.units.filter((o) => o.side === t.side && o.id !== t.id && !o.dead && !o.down && Math.abs(o.col - t.col) + Math.abs(o.row - t.row) === 1);
    const bulwark = Math.max(0, ...wall.map((o) => o.mods.bulwark ?? 0));
    if (bulwark) dmg *= pct(-bulwark);
  }
  const weak = !!t.weak && loc === t.weak.location && !!(ab.aim || ab.locationBias);
  if (weak) dmg *= t.weak!.mult * (bias === t.weak!.location ? C.props.biasWeakMult : 1);
  if (crit) {
    dmg *= C.crit.mult + (u.mods.critMult ?? 0) / 100;
    if (hasStatus(t, "frozen")) {
      dmg *= pct(C.frozenShatter);
      removeStatus(b, t, "frozen");
    }
  }
  if (physical) dmg -= t.defense * (1 - (u.weapon.armorPierce ?? 0) / 100);
  const immune = !!element && affinityMult(t, element) <= 0;
  let damage = ab.power === 0 || immune ? 0 : Math.max(1, Math.round(dmg));
  if (executing && ab.execute!.kills && !t.boss) damage = Math.max(damage, t.hp + (statusValue(t, "shield") ?? 0));
  // An edge adds part of the hit again as its element, through the target's affinity (§13.4).
  const edge = weaponHit && damage > 0 ? edgeOf(u) : undefined;
  if (edge) damage += Math.max(0, Math.round(((damage * u.mods[`edge.${edge}`]!) / 100) * affinityMult(t, edge)));

  b.events.push({ t: "hit", unit: u.id, target: t.id, damage, loc, crit: crit || undefined, weak: weak || undefined, element: element ?? undefined });
  applyHit(b, rng, u, t, ab, damage, loc, opts);
  // An axe's crit bleeds, a mace's stuns (§13.2): the target's resist still applies.
  if (crit && physical && u.weapon.critStatus && !t.dead) tryStatus(b, rng, t, u.weapon.critStatus, 100, 0);
  if (weaponHit && damage > 0) afterWeaponHit(b, rng, u, t, damage);
  for (const id of ab.dispel ?? []) if (!t.dead) removeStatus(b, t, id);
  if (t.dead && ab.refundTp) u.tp = Math.min(C.tp.max, u.tp + ab.refundTp);
  if (physical && damage > 0 && isMelee(u, ab)) afterMeleeHit(b, rng, u, t, damage, opts);
  return { hit: true, damage, loc, crit };
}

/** Draining, Mana-thirst, Siphoning and on-hit ailments (§13.4). */
function afterWeaponHit(b: Battle, rng: Rng, u: Combatant, t: Combatant, damage: number): void {
  if (u.mods.drainPct && !u.down) u.hp = Math.min(u.maxHp, u.hp + Math.round((damage * u.mods.drainPct) / 100));
  if (u.mods.mpPerHit) u.mp = Math.min(u.maxMp, u.mp + u.mods.mpPerHit);
  if (t.dead) return;
  if (u.mods.siphon) {
    const buff = t.statuses.find((x) => meta(x.id).kind === "buff");
    if (buff) removeStatus(b, t, buff.id);
  }
  for (const [k, chance] of Object.entries(u.mods)) if (k.startsWith("onHit.") && !t.dead) tryStatus(b, rng, t, k.slice(6), chance, 0);
  if (hasStatus(u, "envenom") && !t.dead) tryStatus(b, rng, t, "poison", 100, 0);
}

/** Thorned armor and Riposting weapons answer a melee hit (§13.4). */
function afterMeleeHit(b: Battle, rng: Rng, u: Combatant, t: Combatant, damage: number, opts: StrikeOpts): void {
  const thorns = (t.mods.thornsPct ?? 0) + (statusValue(t, "thorns") ?? 0);
  if (thorns && !u.dead) {
    const back = Math.round((damage * thorns) / 100);
    if (back > 0) {
      u.hp = Math.max(u.side === "enemy" ? 0 : 1, u.hp - back);
      b.events.push({ t: "hit", unit: t.id, target: u.id, damage: back });
      if (u.hp <= 0) {
        kill(b, u);
        t.kills++;
      }
    }
  }
  const counter = t.counter + (statusValue(t, "counter_up") ?? 0);
  if (!opts.counter && counter && !t.dead && !t.down && !u.dead && rng.int(100) < counter) strike(b, rng, t, u, COUNTER, { counter: true });
}

function applyHit(b: Battle, rng: Rng, u: Combatant, t: Combatant, ab: AbilityDef, damage: number, loc: Location | undefined, opts: StrikeOpts): void {
  const wasDown = t.down;
  const wasBroken = loc !== undefined && t.broken.includes(loc);

  // Shields soak first (§10.8), then HP and the location's Durability in full (§7.4).
  let left = damage;
  const shield = statusValue(t, "shield");
  if (shield) {
    const soak = Math.min(shield, left);
    left -= soak;
    if (soak >= shield) removeStatus(b, t, "shield");
    else t.statuses.find((s) => s.id === "shield")!.value = shield - soak;
  }
  t.hp = Math.max(0, t.hp - left);
  // Second Wind: once a battle, a blow that would Down a Scion leaves them at 1 HP.
  if (t.hp <= 0 && !wasDown && t.side === "party" && t.mods.secondWind && !t.flags.includes("second_wind")) {
    t.flags.push("second_wind");
    t.hp = 1;
  }
  if (loc && t.dur) t.dur[loc] = Math.max(0, t.dur[loc] - left);
  if (left > 0 && hasStatus(t, "sleep")) removeStatus(b, t, "sleep");

  // Readiness damage (§10.4): bosses take half.
  const readiness = (ab.readiness ?? 0) + (isWeaponHit(ab) ? (u.mods.readiness ?? 0) : 0);
  if (readiness) t.ct = Math.max(0, t.ct - Math.round(readiness * (t.boss ? C.bossReadiness : 1)));

  // On-hit: TP both ways, Sanity, statuses (§10.6 step 7).
  gainTp(u, kindOf(ab) === "physical" ? (u.weapon.tpGain ?? 0) : 0, isWeaponHit(ab) ? (u.mods.tpGainPct ?? 0) : 0);
  if (!t.dead) gainTp(t, 0, t.mods.tpWhenHitPct ?? 0);
  const sanity = Math.round(((ab.sanity ?? 0) + (ab.power > 0 ? u.sanityTouch : 0)) * pct(t.mods.sanityTakenPct ?? 0));
  const sanityBefore = t.sanity;
  if (sanity > 0 && t.maxSanity > 0) {
    t.sanity = Math.max(0, t.sanity - sanity);
    b.events.push({ t: "sanity", target: t.id, amount: sanity });
  }
  for (const s of ab.statuses ?? []) if (t.hp > 0) tryStatus(b, rng, t, s.id, s.chance, s.ticks, s.value);

  // The injury check (§10.6 step 8). Enemies have no locations: 0 HP is death (§10.9).
  if (t.side === "enemy") {
    if (t.hp <= 0) {
      kill(b, t);
      u.kills++;
    }
    return;
  }
  if (t.lastStand) {
    if (t.hp <= 0) down(b, t);
    return;
  }
  const steps = (opts.telegraphed && (ab.aim || ab.locationBias) ? C.injury.telegraph : 0) + (t.defending ? C.injury.defend : 0);
  if (wasDown && loc) {
    // Every hit on a Down Scion is a new roll (§10.9).
    injure(b, rng, t, loc, steps);
    steel(b, rng, t, loc);
  } else if (t.hp <= 0 && loc) {
    down(b, t);
    if (!t.dead) {
      injure(b, rng, t, loc, steps + C.injury.hpZero);
      if (!t.dead) steel(b, rng, t, loc);
    }
  } else if (loc && t.dur && t.dur[loc] <= 0) {
    if (!wasBroken) t.broken.push(loc);
    injure(b, rng, t, loc, steps + (wasBroken ? C.injury.broken : 0));
    steel(b, rng, t, loc);
  }
  if (!t.dead && !t.lastStand && sanity > 0 && t.maxSanity > 0 && t.sanity <= 0 && (sanityBefore > 0 || t.sanityBroken)) {
    injure(b, rng, t, "sanity", 0);
    steelSanity(b, rng, t);
  }
  if (t.hp <= 0 && !t.down && !t.dead) down(b, t);
}

/** TP per event: 10 + ⌊(Acuity + Guile)/20⌋ (§7.3). */
export function gainTp(u: Combatant, extra = 0, morePct = 0): void {
  if (u.dead || u.down) return;
  const gain = (C.tp.gainBase + Math.floor((u.acuity + u.guile) / C.tp.gainPer) + extra) * pct(morePct);
  u.tp = Math.min(C.tp.max, u.tp + Math.round(gain));
}

/** Healing: no hit roll, Sagacity-scaled; Disease halves it; the Down are raised only by revival (§10.6, §10.8). */
export function heal(b: Battle, u: Combatant, t: Combatant, ab: AbilityDef): number {
  if (t.dead || t.down) return 0;
  let amount = baseDamage(u, ab) * pct(t.mods.healingReceivedPct ?? 0) * pct(u.mods.healingDealtPct ?? 0);
  if (hasStatus(t, "disease")) amount *= 0.5;
  const healed = Math.min(t.maxHp - t.hp, Math.round(amount));
  t.hp += healed;
  if (healed > 0 && t.statuses.some((s) => s.id === "bleed")) removeStatus(b, t, "bleed");
  b.events.push({ t: "heal", unit: u.id, target: t.id, amount: healed });
  return healed;
}

/** Revival: back from Down at 20% HP, no roll (§10.9). */
export function revive(b: Battle, t: Combatant, hpPct: number = C.reviveHp): void {
  if (!t.down || t.dead || t.catatonic) return;
  t.down = false;
  t.hp = Math.max(1, Math.round((t.maxHp * hpPct) / 100));
  b.events.push({ t: "heal", unit: t.id, target: t.id, amount: t.hp });
}

/** What a support ability (or a heal) does besides HP: statuses, restores, cures, Sanity, TP, revival (§12.4–12.11). */
function supportEffects(b: Battle, rng: Rng, u: Combatant, t: Combatant, ab: AbilityDef): void {
  if (t.dead) return;
  if (ab.revive && t.down) revive(b, t, ab.revive);
  if (t.down) return;
  const r = ab.restore;
  if (r?.hpPct) t.hp = Math.min(t.maxHp, t.hp + Math.round((t.maxHp * r.hpPct) / 100));
  if (r?.durPct && t.dur && t.maxDur) {
    const locs = r.loc === "all" ? LOCATIONS : r.loc === "lowest" ? [LOCATIONS.reduce((a, l) => (t.dur![l] / t.maxDur![l] < t.dur![a] / t.maxDur![a] ? l : a))] : [rng.pick(LOCATIONS)];
    for (const l of locs) t.dur[l] = Math.min(t.maxDur[l], t.dur[l] + Math.round((t.maxDur[l] * r.durPct) / 100));
  }
  for (const c of ab.cure ?? []) for (const x of [...t.statuses]) if (x.id === c || meta(x.id).kind === c) removeStatus(b, t, x.id);
  if (ab.sanityPct && t.maxSanity) t.sanity = Math.min(t.maxSanity, t.sanity + Math.round((t.maxSanity * ab.sanityPct) / 100));
  if (ab.tpGrant) t.tp = Math.min(C.tp.max, t.tp + ab.tpGrant);
  if (ab.flag && !t.flags.includes(ab.flag)) t.flags.push(ab.flag);
  for (const x of ab.statuses ?? []) {
    if (t.side === u.side) addStatus(b, t, x.id, x.ticks, x.value === undefined ? undefined : { value: x.value });
    else tryStatus(b, rng, t, x.id, x.chance, x.ticks, x.value);
  }
}
