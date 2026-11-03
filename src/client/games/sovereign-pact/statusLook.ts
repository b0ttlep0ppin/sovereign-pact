import { statusMeta } from "@vibepulse/shared/games/sovereign-pact";

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
