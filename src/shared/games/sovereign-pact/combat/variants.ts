// Variants (§14.10): an enemy worn in a standard family's colors. Elemental variants are the ones an
// enemy declares; Hollow fits any living fodder or bruiser; Unknown-touched anyone from Year 10. The
// game composes the name, tint, leanings, tags and level; no new art.
import { VARIANT_BY_ID, VARIANTS, type EnemyDef, type VariantDef } from "../content.ts";
import type { Element } from "../state.ts";

const clamp = (n: number) => Math.max(-100, Math.min(100, n));

/** The variants `e` can appear as in Year `year` (Unknown-touched only from its Year). */
export function variantsFor(e: EnemyDef, year = 1): VariantDef[] {
  if (e.role === "boss" || e.addOnly) return [];
  return VARIANTS.filter((v) => {
    if (v.minYear && year < v.minYear) return false;
    if (v.roles && !v.roles.includes(e.role)) return false;
    if (v.family === "elemental") return e.variants?.includes(v.id) ?? false;
    // Hollow is undeath: the already dead need not apply.
    if (v.family === "hollow") return !e.tags.includes("undead") && !e.tags.includes("construct");
    return true;
  });
}

/** `e` as variant `id`: prefixed name, leanings added and clamped, tags, immunities, Sanity touch, its attacks' element. */
export function withVariant(e: EnemyDef, id: string): EnemyDef {
  const v = VARIANT_BY_ID.get(id);
  if (!v) throw new Error(`unknown variant ${id}`);
  const affinity: Partial<Record<Element, number>> = { ...e.affinity };
  for (const [k, n] of Object.entries(v.affinity ?? {})) affinity[k as Element] = clamp((affinity[k as Element] ?? 0) + n);
  return {
    ...e,
    name: `${v.prefix} ${e.name}`,
    tags: [...new Set([...e.tags, ...(v.tags ?? [])])],
    affinity,
    immune: [...new Set([...(e.immune ?? []), ...(v.immune ?? [])])],
    stats: { ...e.stats, sanityTouch: (e.stats?.sanityTouch ?? 0) + (v.sanityTouch ?? 0) },
    abilities: e.abilities.map((a) => (v.element && a.power > 0 && !a.element && a.kind !== "heal" ? { ...a, element: v.element } : a)),
  };
}
