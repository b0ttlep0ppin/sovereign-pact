// The battle sprites (SPEC §14.11): each enemy, boss, summon and hazard is drawn with its pack picture,
// cut by tools/cut-monsters.py into public/sprites/sovereign-pact/enemies/. Scions keep their tokens
// until the LPC sprites come.
import { Content, type ReplayUnit } from "@vibepulse/shared/games/sovereign-pact";

/** The sprite a combatant is drawn with: its own id, else the longest sprite id it begins with (a boss's later form). */
export function spriteOf(u: Pick<ReplayUnit, "enemy" | "summon" | "hazard">): { url: string; flip: boolean } | null {
  const id = u.enemy ?? u.summon ?? u.hazard;
  if (!id) return null;
  const def = Content.SPRITE_BY_ID.get(id) ?? [...Content.SPRITES].filter((s) => id.startsWith(`${s.id}_`)).sort((a, b) => b.id.length - a.id.length)[0];
  return def ? { url: `${import.meta.env.BASE_URL ?? "./"}sprites/sovereign-pact/enemies/${def.id}.webp`, flip: def.flip } : null;
}
