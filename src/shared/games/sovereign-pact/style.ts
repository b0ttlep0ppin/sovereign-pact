// Restyling (§5.8): a House may change its people's hair, hair color and beard whenever it likes. Body
// features (skin, sex, age and anything a trait, Change or event grants) stay as rolled. A choice is kept
// as a `key=value` tag in the person's look, where the sprite reads it and a Change sets it aside with
// the rest of their old look.
import type { Person, SovState } from "./state.ts";

/** The LPC hair styles the game ships (tools/cut-scions.py), short ones first. */
export const HAIR_SHORT = ["plain", "parted_side_bangs", "page", "swoop_side", "cowlick", "idol", "curtains"] as const;
export const HAIR_LONG = ["long_straight", "wavy", "curtains_long", "long_messy", "single"] as const;
export const HAIR_STYLES: readonly string[] = [...HAIR_SHORT, ...HAIR_LONG];
/** The generator's hair palette names, plus the two the elderly go to. */
export const HAIR_COLORS: readonly string[] = ["blonde", "sandy", "light_brown", "chestnut", "dark_brown", "black", "raven", "ginger", "redhead", "strawberry", "ash", "gray", "white"];
/** "none" is clean-shaven. The beard layers are drawn for the male frame only. */
export const BEARDS: readonly string[] = ["none", "trimmed", "medium"];

export type StyleKey = "hair" | "hair_color" | "beard";
const CHOICES: Record<StyleKey, readonly string[]> = { hair: HAIR_STYLES, hair_color: HAIR_COLORS, beard: BEARDS };

export interface RestyleMove {
  person: number;
  /** A choice from the lists above; "" goes back to the look they were born with. */
  hair?: string;
  hair_color?: string;
  beard?: string;
}

/** Their restyled choices, read from the look's tags. */
export function styleOf(p: Pick<Person, "look">): Partial<Record<StyleKey, string>> {
  const out: Partial<Record<StyleKey, string>> = {};
  for (const tag of p.look) {
    const [key, value] = tag.split("=");
    if (value !== undefined && key! in CHOICES) out[key as StyleKey] = value;
  }
  return out;
}

/** Why `house` cannot restyle them so, or null. */
export function cannotRestyle(s: SovState, house: number, m: RestyleMove): string | null {
  const p = s.people.find((x) => x.id === m.person);
  if (!p || p.host !== house || p.status === "lost") return "You can only restyle your own people at home.";
  if (p.change) return "A Changed body keeps the look of its Change.";
  const keys = (Object.keys(CHOICES) as StyleKey[]).filter((k) => m[k] !== undefined);
  if (!keys.length) return "Choose a new look.";
  for (const k of keys) {
    const v = m[k]!;
    if (typeof v !== "string" || (v !== "" && !CHOICES[k].includes(v))) return `There is no such ${k.replace("_", " ")}.`;
  }
  if (m.beard && m.beard !== "none" && p.sex !== "m") return "The beards are drawn for men only.";
  return null;
}

export function restyle(s: SovState, m: RestyleMove): void {
  const p = s.people.find((x) => x.id === m.person)!;
  for (const k of Object.keys(CHOICES) as StyleKey[]) {
    const v = m[k];
    if (v === undefined) continue;
    p.look = p.look.filter((tag) => !tag.startsWith(`${k}=`));
    if (v) p.look.push(`${k}=${v}`);
  }
}
