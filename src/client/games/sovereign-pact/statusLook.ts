import { statusMeta, TUNING } from "@vibepulse/shared/games/sovereign-pact";

/**
 * How a status shows on the field (Josh 2026-11-03: "more visible status ailment icons, and in some cases
 * outline tinting for sprites"): a glyph on a colored badge, and for the ailments you must notice at a
 * glance, an outline of that color around the sprite.
 */
export type StatusLook = { glyph: string; color: string; outline?: true };

const LOOKS: Record<string, StatusLook> = {
  poison: { glyph: "☠", color: "#7cc84a", outline: true },
  disease: { glyph: "✣", color: "#b5b24a", outline: true },
  bleed: { glyph: "◆", color: "#d0342c", outline: true },
  burn: { glyph: "♨", color: "#ff8a2a", outline: true },
  frozen: { glyph: "❄", color: "#9fe0ff", outline: true },
  stop: { glyph: "■", color: "#a3b0ff", outline: true },
  stun: { glyph: "✷", color: "#ffe066", outline: true },
  knockdown: { glyph: "↓", color: "#e0c070" },
  sleep: { glyph: "z", color: "#9aa8ff", outline: true },
  slow: { glyph: "◔", color: "#6aa0ff", outline: true },
  rooted: { glyph: "⚘", color: "#c8a060", outline: true },
  blind: { glyph: "◉", color: "#9a9a9a" },
  silence: { glyph: "∅", color: "#c9b6e0" },
  deaf: { glyph: "◖", color: "#a8a0b0" },
  disarmed: { glyph: "⚔", color: "#b0a090" },
  fear: { glyph: "!", color: "#b07ae0", outline: true },
  madness: { glyph: "✺", color: "#d050c0", outline: true },
  confusion: { glyph: "?", color: "#d080f0", outline: true },
  charm: { glyph: "♥", color: "#ff7ab0", outline: true },
  berserk: { glyph: "✹", color: "#ff4030", outline: true },
  hex: { glyph: "✶", color: "#a050d0", outline: true },
  marked: { glyph: "◎", color: "#ff5040", outline: true },
  exposed: { glyph: "◌", color: "#ff7050" },
  might_down: { glyph: "▼", color: "#b08060" },
  provoke: { glyph: "☇", color: "#ff6a40" },
  haste: { glyph: "»", color: "#ffd85a" },
  quickened: { glyph: "»", color: "#ffd85a" },
  protect: { glyph: "⛨", color: "#e0c070" },
  shell: { glyph: "◈", color: "#7fb0ff" },
  regen: { glyph: "✚", color: "#7fe08a" },
  mp_regen: { glyph: "✚", color: "#7fb0ff" },
  tp_regen: { glyph: "✚", color: "#e0a050" },
  reflect: { glyph: "⟲", color: "#c0e0ff" },
  might_up: { glyph: "▲", color: "#ff9a5a" },
  guard_up: { glyph: "⛉", color: "#e0c070" },
  hidden: { glyph: "◐", color: "#8a8aa0" },
  veiled: { glyph: "◐", color: "#a0a0c0" },
  thorns: { glyph: "✢", color: "#7fa050" },
};

/** The look of a status id (with or without its "@ticks"); unknown ones get a plain + or •. */
export function statusLook(s: string): StatusLook {
  const id = s.split("@")[0]!;
  return LOOKS[id] ?? (statusMeta(id).kind === "buff" ? { glyph: "+", color: "#d7b45a" } : { glyph: "•", color: "#c0a0a0" });
}

/** The color to outline a sprite in: its most pressing ailment's, if any wants one. */
export function tintOf(statuses: readonly string[]): string | undefined {
  for (const s of statuses) {
    const l = statusLook(s);
    if (l.outline) return l.color;
  }
  return undefined;
}

const C = TUNING.combat;

/** What each status does, in a line, for its tooltip (Josh 2026-11-03: "mousing over status effects should give a tooltip"). */
const ABOUT: Record<string, string> = {
  poison: `Loses ${C.poison}% of max HP every ${C.pulse} ticks. Lingers into the next battle unless cured.`,
  bleed: `Loses ${C.bleed}% of max HP and ${C.bleedDurability} Durability from the wound every ${C.pulse} ticks, until healed.`,
  burn: `Takes ${C.burn}% of max HP as fire every ${C.pulse} ticks.`,
  stun: "Cannot act, and its turn clock stops, until the stun passes. Breaks a charging spell.",
  knockdown: `Loses its next turn and is ${-C.knockdownEvasion}% easier to hit until then. Breaks a charging spell.`,
  slow: "Speed −2: its turns come later.",
  haste: "Speed +2: its turns come sooner.",
  quickened: "Every action costs half the time: it acts twice as often.",
  stop: "Frozen in time: no turns at all until it passes.",
  blind: `Accuracy ${C.blind}%.`,
  frozen: `Cannot move, ${-C.frozenEvasion}% easier to hit, and a critical hit shatters it for +${C.frozenShatter}% damage.`,
  disease: "Healing on it is halved for the rest of the expedition, until cured.",
  disarmed: "Its weapon is gone: no weapon attacks.",
  rooted: "Held fast: cannot move.",
  berserk: `Attacks the nearest foe every turn with +${C.berserk}% physical damage, and can use nothing else.`,
  confusion: "Picks its targets at random.",
  sleep: "Cannot act until it is hit or wakes. Breaks a charging spell.",
  charm: "Fights for the other side until it passes.",
  fear: "Must flee or wait on its turn, and loses Sanity each turn.",
  silence: "Cannot cast spells; a spell being charged is lost.",
  deaf: "Songs do not reach it, and it cannot hear warnings of what is coming.",
  madness: "The mind is gone: it does something at random each turn.",
  skip_turn: "Loses its next turn.",
  protect: `Physical damage taken −${C.protect}%.`,
  shell: `Magical damage taken −${C.shell}%.`,
  regen: `Regains ${C.regen}% of max HP every ${C.pulse} ticks.`,
  mp_regen: `Regains MP every ${C.pulse} ticks.`,
  tp_regen: `Gains TP every ${C.pulse} ticks.`,
  reflect: "The next spell aimed at it bounces back to the caster's side.",
  guard_up: `Shield block chance +${C.guardUp}%.`,
  provoke: "Draws the enemy's single-target attacks.",
  hidden: "Cannot be singled out until it acts.",
  shield: "A ward that soaks up damage before HP.",
  enrage: `All damage dealt +${C.enrage}%.`,
  marked: `Takes +${C.marked}% damage; turrets follow up on it.`,
  exposed: "Out of its line: any melee can reach it until its next turn.",
  tipsy: "Wine-addled: less accurate.",
  edged: "The weapon carries an oil or salt that adds an element to its blows.",
  oathbound: "Oathwine: deals more damage.",
  turned: "The holy dust drives it off: it flees as if Afraid.",
  veiled: "The Mourning Veil: Sanity is shielded.",
  bottled_chorus: "Hears a March without a Minstrel.",
  blackroot: "Blackroot: wounds knit, Durability back each turn.",
  parry: "Answers the next melee blow with a counter.",
  submerged: "Under the water: nothing can reach it until it surfaces.",
  guarded: "Shielded by its own parts: untouchable until they fall.",
  counter_up: "More likely to counter melee blows.",
  thorns: "Melee attackers are hurt in turn.",
  envenom: "Its blows poison.",
  hex: "Hexed: takes more damage from every blow.",
  loaded_dice: "Its next attack is far likelier to crit.",
  loaded_card: "A Marked Card: the next dice roll against it is an 11.",
  might_up: "Deals more physical damage.",
  might_down: "Deals less physical damage.",
  frenzy: "Attacks come faster but land less often, and it cannot Defend.",
  unstoppable: "Immune to Knockdown, Stun and Fear.",
  mirror_stance: "Every melee hit on it is countered, until its next turn.",
  enchant: "Its weapon deals an element.",
  anchored: "Immune to Readiness damage, Knockdown and Charm.",
  null_zone: "No spells can be cast; a spell being charged is lost.",
  exhausted: "Spent from leaving a Form: slower for a while.",
  graft: "A grafted part lends it strength.",
  interposing: "Takes an ally's hits until its next turn.",
  riposte: "Counters melee blows; a critical counter stuns.",
  stand_fast: "Immune to Knockdown, Fear and Readiness damage.",
  braced: "Defending, and cannot be knocked down, until its next turn.",
  last_stand: "Fights on at the edge of death: more damage, no healing.",
  cheat_death: "Injury rolls are rolled twice and the better kept.",
  communed: "Read by a Soothsayer: its weak point and elements are known.",
};

/** A status's tooltip: its name and what it does; a song or Form says what it is. */
export function statusAbout(s: string): string {
  const [id, ticks] = s.split("@");
  const kind = statusMeta(id!).kind;
  const text = ABOUT[id!] ?? (id!.startsWith("form_") ? "A Form: the body is changed until it Reverts." : kind === "buff" ? "A blessing on it." : "An affliction on it.");
  return `${text}${ticks ? ` ${ticks} ticks left.` : ""}`;
}
