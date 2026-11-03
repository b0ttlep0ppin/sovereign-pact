// The battle's backdrop (Josh's playtest, 2026-11-02: "backgrounds needed, the scene looks flat"): Oryx's
// moonlit sky over each region's ground (cut by tools/cut-backdrops.py), the sky tinted to the region.
import type { CSSProperties } from "react";

const BASE = `${import.meta.env.BASE_URL ?? "./"}sprites/sovereign-pact/backdrops`;

/** How each region tints the moon: a filter on the sky, and the haze over the ground. */
const TINTS: Record<string, { sky: string; haze: string }> = {
  beast_lands: { sky: "hue-rotate(60deg) saturate(0.7) brightness(0.8)", haze: "rgba(20, 30, 14, 0.55)" },
  hollow_wood: { sky: "hue-rotate(80deg) saturate(0.6) brightness(0.6)", haze: "rgba(10, 22, 12, 0.6)" },
  drowned_marches: { sky: "hue-rotate(40deg) saturate(0.5) brightness(0.7)", haze: "rgba(12, 26, 22, 0.6)" },
  barrows: { sky: "saturate(0.4) brightness(0.75)", haze: "rgba(14, 14, 20, 0.55)" },
  deep_cold: { sky: "saturate(0.6) brightness(1.05)", haze: "rgba(30, 40, 56, 0.45)" },
  pit: { sky: "hue-rotate(150deg) saturate(1.4) brightness(0.55)", haze: "rgba(40, 6, 4, 0.55)" },
  forge_ruins: { sky: "hue-rotate(170deg) saturate(0.9) brightness(0.6)", haze: "rgba(34, 16, 8, 0.55)" },
  faceless_city: { sky: "grayscale(0.8) brightness(0.7)", haze: "rgba(20, 18, 16, 0.55)" },
  apostate_court: { sky: "hue-rotate(110deg) saturate(0.8) brightness(0.6)", haze: "rgba(30, 10, 22, 0.55)" },
  shrine_of_six: { sky: "hue-rotate(185deg) saturate(0.5) brightness(0.8)", haze: "rgba(36, 30, 18, 0.5)" },
  dragon_reaches: { sky: "hue-rotate(175deg) saturate(1.1) brightness(0.7)", haze: "rgba(36, 18, 8, 0.5)" },
  outer_dark: { sky: "hue-rotate(40deg) saturate(1.2) brightness(0.45)", haze: "rgba(8, 4, 18, 0.65)" },
};

/** The CSS variables the battle's backdrop layers read, for a region (or a plain night for none). */
export function backdrop(pool: string | undefined): CSSProperties {
  const tint = (pool && TINTS[pool]) || TINTS.barrows!;
  return {
    "--sp-sky": `url("${BASE}/sky.webp")`,
    "--sp-sky-filter": tint.sky,
    "--sp-haze": tint.haze,
    ...(pool && TINTS[pool] ? { "--sp-ground": `url("${BASE}/ground-${pool}.webp")` } : {}),
  } as CSSProperties;
}

export const REGIONS_WITH_GROUND = Object.keys(TINTS);
