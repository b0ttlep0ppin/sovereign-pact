// The damage pipeline (§10.6): hit roll, location, crit, base damage, multipliers, apply, on-hit,
// injury check. Healing runs the same path without a hit roll. Every number is in tuning.ts.
import type { Rng } from "../../../rng.ts";
import { ELEMENTS, LOCATIONS, type Element, type Location } from "../state.ts";
import { TUNING } from "../tuning.ts";
import { bodyOf, bodyShare } from "./enemyparts.ts";
import { bestParts, PARTS } from "./parts.ts";
import { hasStatus } from "./grid.ts";
import { down, injure, kill, steel, steelSanity } from "./injury.ts";
import { addStatus, extraOf, meta, removeStatus, statusValue, tryStatus } from "./status.ts";
import type { AbilityDef, Battle, Combatant } from "./types.ts";

const C = TUNING.combat;
const J = C.jobs;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const pct = (n: number) => 1 + n / 100;

export const kindOf = (ab: AbilityDef): NonNullable<AbilityDef["kind"]> => ab.kind ?? "physical";

/** Physical abilities use the weapon's reach unless they name one; spells reach anywhere (§10.3). */
export const reachOf = (u: Combatant, ab: AbilityDef) => ab.reach ?? (kindOf(ab) === "physical" ? u.weapon.reach : "ranged");

const isMelee = (u: Combatant, ab: AbilityDef) => reachOf(u, ab) !== "ranged";

/** The chance in % that `u` lands `ab` on `t` (§7.3, §10.6 step 1). */
export function hitChance(u: Combatant, t: Combatant, ab: AbilityDef, b?: Battle): number {
  if (t.down || hasStatus(t, "sleep") || hasStatus(t, "stun") || hasStatus(t, "stop")) return C.hitClamp[1];
  let chance: number;
  if (kindOf(ab) === "magic") chance = C.spellAccuracy.base + C.spellAccuracy.sagacity * u.sagacity;
  else {
    let evasion = t.evasion + (t.mods.evasion ?? 0) + (t.mods["turn.evasion"] ?? 0);
    if (hasStatus(t, "knockdown")) evasion += C.knockdownEvasion;
    if (hasStatus(t, "frozen")) evasion += C.frozenEvasion;
    const drill = reachOf(u, ab) !== "ranged" ? (u.mods.meleeAccuracy ?? 0) : (u.mods.rangedAccuracy ?? 0);
    chance = u.weapon.acc + u.accuracy + (u.mods.accuracy ?? 0) + (u.mods["turn.accuracy"] ?? 0) + drill + (ab.accuracy ?? 0) + (b ? presence(b, u) : 0) - Math.max(0, evasion);
    if (hasStatus(u, "blind")) chance += C.blind;
  }
  if (t.charge) chance += C.chargingHitBonus;
  return clamp(chance, C.hitClamp[0], C.hitClamp[1]);
}

/** Commanding Presence (§12.4): a Knight in the attacker's column lends Sagacity/5 % physical accuracy (the best one only). */
function presence(b: Battle, u: Combatant): number {
  const lend = b.units.filter((k) => k.id !== u.id && k.side === u.side && k.col === u.col && k.mods.commandingPresence && !k.dead && !k.down);
  return Math.max(0, ...lend.map((k) => Math.floor(k.sagacity / C.knight.presenceDiv)));
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
  let power = (ab.base ?? (spell ? spellBase(u.level) : u.weapon.power)) * ab.power;
  // Two-Handed Mastery (§12.12).
  if (kind === "physical" && ab.base === undefined && u.weapon.hands === 2) power *= pct(u.mods.twoHandPct ?? 0);
  if (u.enemyScale !== undefined) return power * u.enemyScale;
  // A one-hand weapon with nothing in the other hand, no shield and no second blade, strikes harder (Josh 2026-11-10).
  if (kind === "physical" && ab.base === undefined && u.weapon.hands === 1 && u.weapon.kind !== "unarmed" && u.weapon.kind !== "natural" && !u.offhand && !u.offWeapon) power *= pct(C.freeHandPct);
  // Finale (§12.11) sings with Sagacity.
  if (kind === "magic") return power * (1 + (ab.finale ? u.sagacity / C.sagacityDivisor : u.acuity / C.acuityDivisor)) * (1 + ((u.mods.spellPct ?? 0) + (ab.element ? (u.mods[`spellPct.${ab.element}`] ?? 0) : 0)) / 100);
  if (kind === "heal") return power * (1 + u.sagacity / C.sagacityDivisor);
  // Spellbound weapons swing with Acuity when it is higher (§13.4).
  // Skullsplitter (§12.5): Might counts half again with an axe.
  const axe = u.weapon.kind === "axe" ? pct(u.mods.skullsplitter ?? 0) : 1;
  const might = (u.mods.spellbound && ab.base === undefined ? Math.max(u.might, u.acuity) : u.might) * pct(u.mods.mightPct ?? 0) * axe;
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
  // Last Chip (§12.7): the lower the user's HP, the harder it lands.
  if (ab.desperate) power *= 1 + (1 - Math.max(0, u.hp) / u.maxHp) * ab.desperate;
  return power;
}

/** A plain weapon hit (the attack, a counter, weapon skills): weapon properties apply (§13.4). */
const isWeaponHit = (ab: AbilityDef) => kindOf(ab) === "physical" && ab.base === undefined;

/** The location a Headsman's, Hamstringer, Mauler or Breaker weapon favors. */
const biasOf = (u: Combatant): Location | undefined => LOCATIONS.find((l) => u.mods[`bias.${l}`]);

/** The element a Brand puts on the weapon (§12.14). */
const enchantOf = (u: Combatant): Element | undefined => ELEMENTS.find((e) => u.mods[`enchant.${e}`]);

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
const TURRET_SHOT: AbilityDef = { id: "turret_shot", name: "Turret", shape: "single", side: "foe", power: 0.5, reach: "ranged" };

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
  /** A spell turned back by Reflect, which cannot be turned again. */
  reflected?: boolean;
  /** A Turret's follow-up, which sets off no other. */
  followUp?: boolean;
}

/** One hit of `ab` from `u` on `t`, through the whole pipeline. */
export function strike(b: Battle, rng: Rng, u: Combatant, t: Combatant, ab: AbilityDef, opts: StrikeOpts = {}): HitResult {
  if (t.dead) return { hit: false, damage: 0 };
  // Interpose (§12.4): a Knight standing over this ally takes the foe's blow instead.
  const guardian = u.side !== t.side && kindOf(ab) !== "heal" && kindOf(ab) !== "support" ? b.units.find((g) => g.id !== t.id && g.side === t.side && !g.dead && !g.down && statusValue(g, "interposing") === t.id) : undefined;
  if (guardian) t = guardian;
  if (kindOf(ab) === "heal" || kindOf(ab) === "support") {
    const healed = kindOf(ab) === "heal" ? heal(b, u, t, ab) : 0;
    supportEffects(b, rng, u, t, ab);
    return { hit: true, damage: -healed };
  }
  // Reflect: a hostile spell turns back on its caster (§12.14).
  if (kindOf(ab) === "magic" && u.side !== t.side && !opts.reflected && hasStatus(t, "reflect")) {
    b.events.push({ t: "reflect", unit: t.id, target: u.id });
    return strike(b, rng, u, u, ab, { ...opts, reflected: true });
  }
  const weaponHit = isWeaponHit(ab);
  let missed = rng.int(100) >= hitChance(u, t, ab, b);
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
    missed = rng.int(100) >= hitChance(u, t, ab, b);
  }
  // Lucky: one miss a battle is rolled again.
  if (missed && weaponHit && u.mods.lucky && !u.flags.includes("lucky_used")) {
    u.flags.push("lucky_used");
    missed = rng.int(100) >= hitChance(u, t, ab, b);
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
  // Draw Cut: crit up on the first turn. Executioner: always a crit on the Marked.
  if (!crit && ab.critFirstTurn && u.turns <= 1) crit = rng.int(100) < ab.critFirstTurn;
  if (ab.critIfMarked && hasStatus(t, "marked")) crit = true;
  if (ab.critOnTwelve && u.flags.includes("lots_twelve")) crit = true;
  if (primed >= 0) {
    crit = true;
    u.flags.splice(primed, 1);
  }

  const power = powerOf(b, u, t, ab);
  if (power !== ab.power) ab = { ...ab, power };
  let dmg = baseDamage(u, ab);
  for (const tag of t.tags) dmg *= ab.vs?.[tag] ?? 1;
  if (ab.bigPct && t.size[0] * t.size[1] > 1) dmg *= pct(ab.bigPct);
  const executing = !!ab.execute && t.hp < (t.maxHp * ab.execute.below) / 100;
  if (executing) dmg *= pct(ab.execute!.pct ?? 0);
  // Guard: a shield block halves the hit before the multipliers (§10.6 step 6).
  // Shieldbearer (§12.4): Resilience/4 % more with a shield.
  const bearer = t.mods.shieldbearer && t.offhand === "shield" ? Math.floor(t.resilience / C.knight.shieldbearerDiv) : 0;
  const guard = u.side !== t.side && physical ? t.guard + bearer + (hasStatus(t, "guard_up") ? C.guardUp : 0) : 0;
  if (guard > 0 && rng.int(100) < guard) dmg *= C.block / 100;

  dmg *= pct(columnMod(u, ab));
  const element = ab.element === undefined ? (physical ? (enchantOf(u) ?? u.weapon.element) : undefined) : ab.element;
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
  dmg *= pct(u.mods.damagePct ?? 0);
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
    // One Cut: a two-handed sword's crit lands twice as hard (§12.13).
    if (u.mods.oneCut && u.weapon.kind === "sword" && u.weapon.hands === 2) dmg *= J.oneCutMult;
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

  b.events.push({ t: "hit", unit: u.id, target: t.id, damage, loc, crit: crit || undefined, weak: weak || undefined, element: element ?? undefined, ...(edge ? { edge } : {}) });
  applyHit(b, rng, u, t, ab, damage, loc, opts);
  // An axe's crit bleeds, a mace's stuns (§13.2): the target's resist still applies.
  if (crit && physical && u.weapon.critStatus && !t.dead) tryStatus(b, rng, t, u.weapon.critStatus, 100);
  // Riposte (§12.4): a counter that crits stuns.
  if (crit && opts.counter && hasStatus(u, "riposte") && !t.dead) tryStatus(b, rng, t, "stun", 100);
  if (weaponHit && damage > 0) afterWeaponHit(b, rng, u, t, damage);
  for (const id of ab.dispel ?? []) if (!t.dead) removeStatus(b, t, id);
  // Bloodbound: a summon's blows heal its Conjurer (§12.15).
  const owner = u.owner !== undefined && damage > 0 ? b.units.find((o) => o.id === u.owner && o.mods.bloodbound && !o.dead && !o.down) : undefined;
  if (owner) mend(b, owner, u.id, Math.round((damage * owner.mods.bloodbound!) / 100));
  if (ab.drain && damage > 0 && !u.down && !u.dead) mend(b, u, u.id, Math.round((damage * ab.drain) / 100));
  if (ab.tpSteal && damage > 0) {
    const took = Math.min(t.tp, ab.tpSteal);
    t.tp -= took;
    u.tp = Math.min(C.tp.max, u.tp + took);
  }
  if (ab.breaksCharge && t.charge && !t.dead) {
    b.events.push({ t: "cancel", unit: t.id, ability: t.charge.ability.id });
    delete t.charge;
  }
  if (t.dead && ab.refundTp) u.tp = Math.min(C.tp.max, u.tp + ab.refundTp);
  if (ab.tpOnHit) u.tp = Math.min(C.tp.max, u.tp + ab.tpOnHit);
  if (physical && damage > 0 && isMelee(u, ab)) afterMeleeHit(b, rng, u, t, damage, opts);
  // Turrets follow an ally's physical hit on a Marked target (§12.16).
  if (physical && !opts.counter && !opts.followUp && !t.dead && hasStatus(t, "marked"))
    for (const o of b.units) if (o.summon === "turret" && o.side === u.side && !o.dead && !t.dead) strike(b, rng, o, t, TURRET_SHOT, { followUp: true, counter: true });
  return { hit: true, damage, loc, crit };
}

/** The off hand's power % for `u`: 50, 80 with Dual Wield Mastery, plus lasting mods (Ambidextrous, Clumsy). */
export const offHandPct = (u: Combatant): number =>
  Math.max(0, (u.mods.dualWieldMastery ? C.dualWield.mastery : C.dualWield.offPower) + (u.mods.offHandPct ?? 0));

/** The off-hand blow after a basic Attack (§13.2): the second weapon's own power, accuracy and crit. */
export function offHandStrike(b: Battle, rng: Rng, u: Combatant, t: Combatant, ab: AbilityDef): HitResult {
  const main = u.weapon;
  u.weapon = u.offWeapon!;
  try {
    return strike(b, rng, u, t, { ...ab, id: "offhand", name: "Off hand", power: (ab.power * offHandPct(u)) / 100 });
  } finally {
    u.weapon = main;
  }
}

/**
 * HP that seeps back with no spell cast (a drain, Sanguine blood, Bloodbound, Regen): never past the
 * cap, never lowering it, and told as a quiet heal so its number shows (Josh 2026-11-10: Sanguine
 * "wasn't healing, but maybe the green healing numbers weren't popping up").
 */
export function mend(b: Battle, u: Combatant, by: number, amount: number): void {
  const before = u.hp;
  u.hp = Math.max(u.hp, Math.min(hpCap(u), u.hp + amount));
  if (u.hp > before) b.events.push({ t: "heal", unit: by, target: u.id, amount: u.hp - before, quiet: true });
}

/** Draining, Mana-thirst, Siphoning and on-hit ailments (§13.4); Sanguine blood drains on melee blows (§5.7). */
function afterWeaponHit(b: Battle, rng: Rng, u: Combatant, t: Combatant, damage: number): void {
  const drain = (u.mods.drainPct ?? 0) + (u.weapon.reach !== "ranged" ? (u.mods.meleeDrainPct ?? 0) : 0);
  if (drain && !u.down) mend(b, u, u.id, Math.round((damage * drain) / 100));
  if (u.mods.mpPerHit) u.mp = Math.min(u.maxMp, u.mp + u.mods.mpPerHit);
  if (t.dead) return;
  if (u.mods.siphon) {
    const buff = t.statuses.find((x) => meta(x.id).kind === "buff" && !meta(x.id).fixed);
    if (buff) removeStatus(b, t, buff.id);
  }
  for (const [k, chance] of Object.entries(u.mods)) if (k.startsWith("onHit.") && !t.dead) tryStatus(b, rng, t, k.slice(6), chance);
  if (hasStatus(u, "envenom") && !t.dead) tryStatus(b, rng, t, "poison", 100);
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
  // The Marsh Thing poisons whoever strikes it (§12.17).
  if (t.mods.poisonAttackers && !u.dead) tryStatus(b, rng, u, "poison", t.mods.poisonAttackers);
  if (opts.counter || t.dead || t.down || u.dead) return;
  // A Parry answers the next melee blow, then ends (§14.7).
  if (hasStatus(t, "parry")) {
    removeStatus(b, t, "parry");
    strike(b, rng, t, u, COUNTER, { counter: true });
    return;
  }
  // Mirror Stance: every melee hit is answered while the TP lasts (§12.13).
  if (hasStatus(t, "mirror_stance") && t.tp >= J.mirrorTp) {
    t.tp -= J.mirrorTp;
    strike(b, rng, t, u, COUNTER, { counter: true });
    return;
  }
  const counter = t.counter + (statusValue(t, "counter_up") ?? 0) + (statusValue(t, "riposte") ?? 0);
  if (counter && rng.int(100) < counter) strike(b, rng, t, u, COUNTER, { counter: true });
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
  // A blow on a Part reaches the body too, at a share (§14.1).
  const body = bodyOf(b, t);
  if (body && left > 0) {
    const share = bodyShare(left);
    body.hp = Math.max(0, body.hp - share);
    b.events.push({ t: "hit", unit: u.id, target: body.id, damage: share });
    if (body.hp <= 0) {
      kill(b, body);
      u.kills++;
    }
  }
  // Second Wind: once a battle, a blow that would Down a Scion leaves them at 1 HP.
  if (t.hp <= 0 && !wasDown && t.side === "party" && t.mods.secondWind && !t.flags.includes("second_wind")) {
    t.flags.push("second_wind");
    t.hp = 1;
  }
  // Lifeline (§12.9): a Soothsayer within 2 cells may hold a falling ally at 1 HP, once a battle.
  if (t.hp <= 0 && !wasDown && t.side === "party") {
    const keeper = b.units.find((o) => o.id !== t.id && o.side === t.side && o.mods.lifeline && !o.dead && !o.down && !o.flags.includes("lifeline_used") && Math.abs(o.col - t.col) + Math.abs(o.row - t.row) <= 2);
    if (keeper && rng.int(100) < C.soothsayer.lifelinePct) {
      keeper.flags.push("lifeline_used");
      t.hp = 1;
    }
  }
  if (loc && t.dur) t.dur[loc] = Math.max(0, t.dur[loc] - left);
  if (left > 0 && hasStatus(t, "sleep")) removeStatus(b, t, "sleep");

  // Readiness damage (§10.4): bosses take half.
  const readiness = (ab.readiness ?? 0) + (isWeaponHit(ab) ? (u.mods.readiness ?? 0) : 0);
  if (readiness && !t.mods.readinessImmune) t.ct = Math.max(0, t.ct - Math.round(readiness * (t.boss ? C.bossReadiness : 1)));

  // On-hit: TP both ways, Sanity, statuses (§10.6 step 7).
  const physical = kindOf(ab) === "physical";
  const sword = physical && u.weapon.kind === "sword" ? (u.mods.swordTpPct ?? 0) : 0;
  gainTp(u, physical ? (u.weapon.tpGain ?? 0) : 0, (isWeaponHit(ab) ? (u.mods.tpGainPct ?? 0) : 0) + sword);
  if (!t.dead) gainTp(t, t.mods.tpWhenHit ?? 0, t.mods.tpWhenHitPct ?? 0);
  // The Village Evil God's hits cost a Sanity more for each of its living adds (§14.6).
  const thralls = ab.sanityPerAdd ? ab.sanityPerAdd * b.units.filter((x) => !x.dead && x.side === u.side && x.tags.includes("add")).length : 0;
  // Calming Presence (§12.9): a Soothsayer beside the target softens the blow to the mind.
  const calm = b.units.some((o) => o.id !== t.id && o.side === t.side && o.mods.calmingPresence && !o.dead && !o.down && Math.abs(o.col - t.col) + Math.abs(o.row - t.row) === 1);
  const sanity = Math.round(((ab.sanity ?? 0) + thralls + (ab.power > 0 ? u.sanityTouch : 0)) * pct(t.mods.sanityTakenPct ?? 0) * (calm ? pct(-C.soothsayer.calmPct) : 1));
  const sanityBefore = t.sanity;
  if (sanity > 0 && t.maxSanity > 0) {
    t.sanity = Math.max(0, t.sanity - sanity);
    b.events.push({ t: "sanity", target: t.id, amount: sanity });
  }
  for (const s of ab.statuses ?? []) if (t.hp > 0 && (!s.tag || t.tags.includes(s.tag)) && !sanityHolds(rng, t, ab)) tryStatus(b, rng, t, s.id, s.chance, s.ticks, s.value, s.mods);

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
  const healed = Math.max(0, Math.min(hpCap(t) - t.hp, Math.round(amount)));
  t.hp += healed;
  if (healed > 0 && t.statuses.some((s) => s.id === "bleed")) removeStatus(b, t, "bleed");
  b.events.push({ t: "heal", unit: u.id, target: t.id, amount: healed });
  return healed;
}

/** The most HP healing can bring `u` to: all of it, or half after Hold Together (§12.12). */
export const hpCap = (u: Combatant): number =>
  u.mods.noHeal ? u.hp : u.flags.includes("heal_cap_half") ? Math.round((u.maxHp * J.healCapPct) / 100) : u.maxHp;

/** Revival: back from Down at 20% HP, no roll (§10.9). */
export function revive(b: Battle, t: Combatant, hpPct: number = C.reviveHp): void {
  if (!t.down || t.dead || t.catatonic) return;
  t.down = false;
  t.hp = Math.max(1, Math.round((t.maxHp * hpPct) / 100));
  b.events.push({ t: "heal", unit: t.id, target: t.id, amount: t.hp });
}

/** A Sanity check against an ability that allows one (the Mother's Lullaby): d100 under the target's Sanity %. */
function sanityHolds(rng: Rng, t: Combatant, ab: AbilityDef): boolean {
  if (!ab.sanityResists || !t.maxSanity) return false;
  return rng.int(100) < Math.round((t.sanity / t.maxSanity) * 100);
}

/** What a support ability (or a heal) does besides HP: statuses, restores, cures, Sanity, TP, revival (§12.4–12.11). */
function supportEffects(b: Battle, rng: Rng, u: Combatant, t: Combatant, ab: AbilityDef): void {
  if (t.dead || (ab.ownHouse && t.house !== u.house)) return;
  if (ab.revive && t.down) revive(b, t, ab.revive);
  if (t.down) return;
  const r = ab.restore;
  if (r?.hpPct) t.hp = Math.max(t.hp, Math.min(hpCap(t), t.hp + Math.round((t.maxHp * r.hpPct) / 100)));
  if (r?.durPct && t.dur && t.maxDur) {
    const locs = r.loc === "all" ? LOCATIONS : r.loc === "lowest" ? [LOCATIONS.reduce((a, l) => (t.dur![l] / t.maxDur![l] < t.dur![a] / t.maxDur![a] ? l : a))] : [rng.pick(LOCATIONS)];
    for (const l of locs) t.dur[l] = Math.min(t.maxDur[l], t.dur[l] + Math.round((t.maxDur[l] * r.durPct) / 100));
  }
  for (const c of ab.cure ?? []) for (const x of [...t.statuses]) if ((x.id === c || meta(x.id).kind === c) && !meta(x.id).fixed) removeStatus(b, t, x.id);
  if (ab.sanityPct && t.maxSanity) t.sanity = Math.max(0, Math.min(t.maxSanity, t.sanity + Math.round((t.maxSanity * ab.sanityPct) / 100)));
  if (ab.tpGrant) t.tp = Math.min(C.tp.max, t.tp + ab.tpGrant);
  if (ab.mpPct && t.maxMp) t.mp = Math.min(t.maxMp, t.mp + Math.round((t.maxMp * ab.mpPct) / 100));
  if (ab.flag && !t.flags.includes(ab.flag)) t.flags.push(ab.flag);
  if (ab.interpose && t.id !== u.id) addStatus(b, u, "interposing", 0, { value: t.id });
  // Second Breath (§12.10): Breath also clears the head.
  if (ab.id === "breath" && t.mods.secondBreath) for (const id of ["fear", "confusion"]) removeStatus(b, t, id);
  if (ab.commune) for (const x of b.units) if (x.side !== u.side && !x.dead && !x.hazard) addStatus(b, x, "communed");
  // Barrier and Bulwark (§12.14), stronger from an Aegis caster; the Shield Drone only tops up.
  if (ab.shieldPct) {
    const size = Math.round(((t.maxHp * ab.shieldPct) / 100) * pct(u.mods.shieldCastPct ?? 0));
    const add = ab.shieldRefill ? size - (statusValue(t, "shield") ?? 0) : size;
    if (add > 0) addStatus(b, t, "shield", 0, { value: add });
  }
  // Overclock, Repair, Flashbang (§12.16).
  if (ab.ctGrant) t.ct += ab.ctGrant;
  if (ab.constructHpPct && t.tags.includes("construct")) t.hp = Math.min(t.maxHp, t.hp + Math.round((t.maxHp * ab.constructHpPct) / 100));
  if (ab.readiness && t.side !== u.side && !t.mods.readinessImmune) t.ct = Math.max(0, t.ct - Math.round(ab.readiness * (t.boss ? C.bossReadiness : 1)));
  if (ab.dispelBuffs) for (const x of t.statuses.filter((s) => meta(s.id).kind === "buff" && !meta(s.id).fixed).reverse().slice(0, ab.dispelBuffs)) removeStatus(b, t, x.id);
  if (ab.reveal) {
    const hidden = (b.field ?? []).filter((f) => f.hidden);
    b.field = (b.field ?? []).filter((f) => !f.hidden);
    for (const f of hidden) b.events.push({ t: "hazard", hazard: f.id, what: "disarmed", col: f.col, row: f.row });
    for (const x of b.units) if (x.side !== u.side && x.role === "lurker" && !x.dead) x.ct = 0;
  }
  if (ab.grantParts && t.mods.scavenge) t.parts = [...(t.parts ?? []), ...bestParts(t, PARTS, ab.grantParts)];
  if (ab.bossReadiness && t.boss && t.side !== u.side && !t.mods.readinessImmune) t.ct = Math.max(0, t.ct - ab.bossReadiness);
  for (const x of ab.statuses ?? []) {
    if (x.tag && !t.tags.includes(x.tag)) continue;
    // Breath of Steel and Lasting Wards: timed buffs cast with MP last longer.
    const longer = ab.mp && x.ticks > 0 && meta(x.id).kind === "buff" ? (u.mods.buffTicks ?? 0) : 0;
    if (t.side === u.side) addStatus(b, t, x.id, x.ticks + longer, extraOf(x.value, x.mods));
    else if (!sanityHolds(rng, t, ab)) tryStatus(b, rng, t, x.id, x.chance, x.ticks, x.value, x.mods);
  }
}
