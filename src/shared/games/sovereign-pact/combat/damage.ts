// The damage pipeline (§10.6): hit roll, location, crit, base damage, multipliers, apply, on-hit,
// injury check. Healing runs the same path without a hit roll. Every number is in tuning.ts.
import type { Rng } from "../../../rng.ts";
import { LOCATIONS, type Element, type Location } from "../state.ts";
import { TUNING } from "../tuning.ts";
import { hasStatus } from "./grid.ts";
import { down, injure, kill, steel, steelSanity } from "./injury.ts";
import { removeStatus, statusValue, tryStatus } from "./status.ts";
import type { AbilityDef, Battle, Combatant } from "./types.ts";

const C = TUNING.combat;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const pct = (n: number) => 1 + n / 100;

export const kindOf = (ab: AbilityDef): "physical" | "magic" | "heal" => ab.kind ?? "physical";

/** Physical abilities use the weapon's reach unless they name one; spells reach anywhere (§10.3). */
export const reachOf = (u: Combatant, ab: AbilityDef) => ab.reach ?? (kindOf(ab) === "physical" ? u.weapon.reach : "ranged");

const isMelee = (u: Combatant, ab: AbilityDef) => reachOf(u, ab) !== "ranged";

/** The chance in % that `u` lands `ab` on `t` (§7.3, §10.6 step 1). */
export function hitChance(u: Combatant, t: Combatant, ab: AbilityDef): number {
  if (t.down || hasStatus(t, "sleep") || hasStatus(t, "stun") || hasStatus(t, "stop")) return C.hitClamp[1];
  let chance: number;
  if (kindOf(ab) === "magic") chance = C.spellAccuracy.base + C.spellAccuracy.sagacity * u.sagacity;
  else {
    let evasion = t.evasion + (t.mods.evasion ?? 0);
    if (hasStatus(t, "knockdown")) evasion += C.knockdownEvasion;
    if (hasStatus(t, "frozen")) evasion += C.frozenEvasion;
    chance = u.weapon.acc + u.accuracy + (u.mods.accuracy ?? 0) + (ab.accuracy ?? 0) - Math.max(0, evasion);
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
  if (u.side !== "party" || kindOf(ab) === "heal") return 0;
  if (isMelee(u, ab) && reachOf(u, ab) === "melee") return u.col === 0 ? C.frontMelee : u.col === 1 ? C.middleMelee : 0;
  if (u.weapon.kind === "bow" && kindOf(ab) === "physical" && u.col === 0) return C.bowFromFront;
  return 0;
}

/** Affinity multiplier: +50 resists half, −50 takes half again, +100 is immune (§7.3). */
export const affinityMult = (t: Combatant, el: Element | null | undefined) => (el ? 1 - clamp(t.affinity[el] ?? 0, -100, 100) / 100 : 1);

/** Damage before randomness-free multipliers: power × (1 + stat/25), or an enemy's level scale (§7.3, §14.2). */
export function baseDamage(u: Combatant, ab: AbilityDef): number {
  const power = (ab.base ?? u.weapon.power) * ab.power;
  if (u.enemyScale !== undefined) return power * u.enemyScale;
  const kind = kindOf(ab);
  if (kind === "magic") return power * (1 + u.acuity / C.acuityDivisor) * (1 + (u.mods.spellPct ?? 0) / 100);
  if (kind === "heal") return power * (1 + u.sagacity / C.sagacityDivisor);
  return power * (1 + u.might / C.mightDivisor);
}

export interface HitResult {
  hit: boolean;
  damage: number;
  loc?: Location;
  crit?: boolean;
}

/** Context from the action: whether the ability was telegraphed (an injury step against). */
export interface StrikeOpts {
  telegraphed?: boolean;
}

/** One hit of `ab` from `u` on `t`, through the whole pipeline. */
export function strike(b: Battle, rng: Rng, u: Combatant, t: Combatant, ab: AbilityDef, opts: StrikeOpts = {}): HitResult {
  if (t.dead) return { hit: false, damage: 0 };
  if (kindOf(ab) === "heal") return { hit: true, damage: -heal(b, u, t, ab) };
  if (rng.int(100) >= hitChance(u, t, ab)) {
    b.events.push({ t: "miss", unit: u.id, target: t.id });
    return { hit: false, damage: 0 };
  }
  const physical = kindOf(ab) === "physical";
  const loc = t.dur || ab.aim || ab.locationBias ? rollLocation(rng, ab) : undefined;

  // Crit: base + weapon + ability, Head +10 (§10.6 step 3). A primed crit (Sanity "next_crit") always lands.
  const primed = u.flags.indexOf("next_crit");
  let crit = rng.int(100) < C.crit.base + u.weapon.crit + (ab.crit ?? 0) + (loc === "head" ? C.crit.headBonus : 0);
  if (primed >= 0) {
    crit = true;
    u.flags.splice(primed, 1);
  }

  let dmg = baseDamage(u, ab);
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
  if (physical && hasStatus(u, "berserk")) dmg *= pct(C.berserk);
  if (hasStatus(u, "enrage")) dmg *= pct(C.enrage);
  if (u.lastStand) dmg *= pct(C.lastStand.damage);
  if (physical) dmg *= pct(u.mods.physicalDamagePct ?? 0);
  dmg *= pct(t.mods.damageTakenPct ?? 0);
  const weak = !!t.weak && loc === t.weak.location && !!(ab.aim || ab.locationBias);
  if (weak) dmg *= t.weak!.mult;
  if (crit) {
    dmg *= C.crit.mult;
    if (hasStatus(t, "frozen")) {
      dmg *= pct(C.frozenShatter);
      removeStatus(b, t, "frozen");
    }
  }
  if (physical) dmg -= t.defense * (1 - (u.weapon.armorPierce ?? 0) / 100);
  const immune = !!element && affinityMult(t, element) <= 0;
  const damage = ab.power === 0 || immune ? 0 : Math.max(1, Math.round(dmg));

  b.events.push({ t: "hit", unit: u.id, target: t.id, damage, loc, crit: crit || undefined, weak: weak || undefined, element: element ?? undefined });
  applyHit(b, rng, u, t, ab, damage, loc, opts);
  // An axe's crit bleeds, a mace's stuns (§13.2): the target's resist still applies.
  if (crit && physical && u.weapon.critStatus && !t.dead) tryStatus(b, rng, t, u.weapon.critStatus, 100, 0);
  return { hit: true, damage, loc, crit };
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
  if (loc && t.dur) t.dur[loc] = Math.max(0, t.dur[loc] - left);
  if (left > 0 && hasStatus(t, "sleep")) removeStatus(b, t, "sleep");

  // Readiness damage (§10.4): bosses take half.
  if (ab.readiness) t.ct = Math.max(0, t.ct - Math.round(ab.readiness * (t.boss ? C.bossReadiness : 1)));

  // On-hit: TP both ways, Sanity, statuses (§10.6 step 7).
  gainTp(u, kindOf(ab) === "physical" ? (u.weapon.tpGain ?? 0) : 0);
  if (!t.dead) gainTp(t);
  const sanity = (ab.sanity ?? 0) + (ab.power > 0 ? u.sanityTouch : 0);
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
export function gainTp(u: Combatant, extra = 0): void {
  if (u.dead || u.down) return;
  u.tp = Math.min(C.tp.max, u.tp + C.tp.gainBase + Math.floor((u.acuity + u.guile) / C.tp.gainPer) + extra);
}

/** Healing: no hit roll, Sagacity-scaled; Disease halves it; the Down are raised only by revival (§10.6, §10.8). */
export function heal(b: Battle, u: Combatant, t: Combatant, ab: AbilityDef): number {
  if (t.dead || t.down) return 0;
  let amount = baseDamage(u, ab) * pct(t.mods.healingReceivedPct ?? 0);
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
