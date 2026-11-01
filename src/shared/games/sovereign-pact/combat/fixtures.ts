// Stand-in parties and encounters for the simulator and tests until Jobs and gear (Milestone 2) and
// group templates (Milestone 3) exist. Nothing here is content: the weapons and spells are placeholders
// shaped like §12–13 items, so the balance runs have something level-appropriate to swing.
import { createRng } from "../../../rng.ts";
import { maxMp, maxSanity } from "../formulas.ts";
import { promote, rollRecruit } from "../generate.ts";
import { levelUp } from "../progression.ts";
import type { BASE_JOBS, Person } from "../state.ts";
import { enemyCombatant, newBattle, scionCombatant, type Armor } from "./build.ts";
import type { AbilityDef, Battle, Combatant, Weapon } from "./types.ts";

/** Gear tier for a party level: the expedition level it is built for (R = 3L, §14.2), as a power scale (1 at L1). */
export const gearScale = (level: number) => {
  const L = Math.max(1, level / 3);
  return (6 + 3 * L + 0.1 * L * L) / 9;
};

/** Weapon types at L1 strength (§13.2 ratios), scaled by `gearScale`. */
export function weapons(level: number) {
  const k = gearScale(level);
  const w = (kind: string, power: number, acc: number, crit: number, reach: Weapon["reach"], hands: 1 | 2): Weapon => ({
    kind,
    power: Math.round(power * k),
    acc,
    crit,
    reach,
    hands,
  });
  return { sword: w("sword", 10, 90, 5, "melee", 1), spear: w("spear", 12, 90, 5, "reach", 2), bow: w("bow", 11, 85, 8, "ranged", 2), staff: w("staff", 6, 90, 2, "melee", 2) };
}

export function spells(level: number) {
  const k = gearScale(level);
  const base = (n: number) => Math.round(n * k);
  return {
    fire: { id: "fire", name: "Fire", shape: "single", side: "foe", power: 1, base: base(14), kind: "magic", element: "fire", mp: 4, charge: 60 },
    fira: { id: "fira", name: "Fira", shape: "cross", side: "foe", power: 1, base: base(12), kind: "magic", element: "fire", mp: 10, charge: 120 },
    holy: { id: "holy", name: "Holy", shape: "single", side: "foe", power: 1, base: base(16), kind: "magic", element: "holy", mp: 8, charge: 80 },
    cure: { id: "cure", name: "Cure", shape: "single", side: "ally", power: 1, base: base(14), kind: "heal", mp: 4 },
  } satisfies Record<string, AbilityDef>;
}

/** Armor sets by class over the four slots (§13.3), defense tracking the enemy block's (§14.2). */
export function armorSet(cls: "light" | "medium" | "heavy", level: number): Armor {
  const L = Math.max(1, level / 3);
  const per = { light: 10, medium: 25, heavy: 50 }[cls];
  return {
    defense: Math.round({ light: 0.5, medium: 1, heavy: 1.5 }[cls] * (1 + L + 0.08 * L * L)),
    durabilityPct: { head: per, body: per, arms: per, legs: per },
    evasion: { light: 0, medium: -6, heavy: -12 }[cls],
    guard: cls === "heavy" ? 20 : 0,
  };
}

/** A Person levelled to `level` through the real growth accumulator (§7.2), MP and Sanity full. */
export function atLevel(p: Person, level: number): Person {
  let q = p;
  while (q.level < level) q = levelUp(q);
  return { ...q, mp: maxMp(q), sanity: maxSanity(q) };
}

/** Four Scions: a Soldier with a sword in Front, a Knight with a spear in Middle, a Vagabond's bow and a Soothsayer at the Back. */
export function standardParty(seed: number, level: number, firstId = 1): Combatant[] {
  const rng = createRng(seed);
  const p = (i: number, job: (typeof BASE_JOBS)[number]) => atLevel(promote(rollRecruit(rng, firstId + i, 0), job), level);
  const w = weapons(level);
  const sp = spells(level);
  return [
    scionCombatant(p(0, "soldier"), { id: firstId, col: 0, row: 3, weapon: w.sword, armor: armorSet("heavy", level) }),
    scionCombatant(p(1, "knight"), { id: firstId + 1, col: 1, row: 4, weapon: w.spear, armor: armorSet("heavy", level) }),
    scionCombatant(p(2, "vagabond"), { id: firstId + 2, col: 2, row: 2, weapon: w.bow, armor: armorSet("light", level) }),
    scionCombatant(p(3, "soothsayer"), {
      id: firstId + 3,
      col: 2,
      row: 5,
      weapon: w.staff,
      armor: armorSet("medium", level),
      abilities: [sp.cure, sp.holy],
      gambits: [{ if: "ally.hp<0.5", do: "cure", target: "ally_lowest_hp" }, { do: "holy", target: "lowest_hp" }],
    }),
  ];
}

/** §14.4's Warband for a 4-party from the Barrows: 2 fodder, 1 bruiser, 1 lurker. */
export function barrowsWarband(level: number, firstId = 101): Combatant[] {
  return [
    enemyCombatant("barrow_skeleton", { id: firstId, level, col: 0, row: 2 }),
    enemyCombatant("barrow_skeleton", { id: firstId + 1, level, col: 0, row: 5 }),
    enemyCombatant("barrow_hollow_soldier", { id: firstId + 2, level, col: 0, row: 3 }),
    enemyCombatant("barrow_ghost", { id: firstId + 3, level, col: 1, row: 4 }),
  ];
}

/** A Barrows mix with the back-line threats (§10.3): fodder in front, an Archer at E3, a Banshee at E2. */
export function barrowsBattery(level: number, firstId = 101): Combatant[] {
  return [
    enemyCombatant("barrow_skeleton", { id: firstId, level, col: 0, row: 3 }),
    enemyCombatant("barrow_skeleton", { id: firstId + 1, level, col: 0, row: 4 }),
    enemyCombatant("barrow_cursed_archer", { id: firstId + 2, level, col: 2, row: 2 }),
    enemyCombatant("barrow_banshee", { id: firstId + 3, level, col: 1, row: 5 }),
  ];
}

export const ENCOUNTERS = { warband: barrowsWarband, battery: barrowsBattery } as const;
export type EncounterId = keyof typeof ENCOUNTERS;

export function warbandBattle(seed: number, level: number, encounter: EncounterId = "warband"): Battle {
  return newBattle(seed, [...standardParty(seed, level * 3), ...ENCOUNTERS[encounter](level)]);
}
