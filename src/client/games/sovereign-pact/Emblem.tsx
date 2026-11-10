// A House emblem drawn from its parts (§5.4): the shield outline, the field's division in the House's
// tinctures, and the charge as a pixel silhouette (charges.ts), outlined in black so it reads on any
// field. A second charge sits small in the chief.
import { useId } from "react";
import { Content } from "@vibepulse/shared/games/sovereign-pact";
import { CHARGES } from "./charges";
import { BONE, EdgeFilter, INK, PixelMarks } from "./PixelArt";

export const HERALDRY_COLORS: ReadonlyMap<string, string> = new Map(Content.HERALDRY.palette.map((s) => [s.id, s.hex]));

const SHIELDS: Record<string, string> = {
  heater: "M4 4 H60 V30 C60 50 44 60 32 66 C20 60 4 50 4 30 Z",
  round: "M32 4 A30 30 0 1 1 31.9 4 Z",
  kite: "M6 4 H58 V22 C58 42 42 58 32 70 C22 58 6 42 6 22 Z",
  banner: "M8 4 H56 V66 L32 54 L8 66 Z",
  lozenge: "M32 2 L62 35 L32 68 L2 35 Z",
  skull_plate: "M8 10 C8 2 56 2 56 10 V40 C56 52 46 60 40 60 V68 H24 V60 C18 60 8 52 8 40 Z",
};

/** The second tincture's part of the field, per division. */
const DIVISIONS: Record<string, string> = {
  per_pale: "M32 0 H64 V72 H32 Z",
  per_fess: "M0 36 H64 V72 H0 Z",
  per_bend: "M0 0 L64 72 H0 Z",
  per_bend_sinister: "M64 0 L0 72 H64 Z",
  quarterly: "M32 0 H64 V36 H32 Z M0 36 H32 V72 H0 Z",
  per_saltire: "M0 0 L32 36 L0 72 Z M64 0 L32 36 L64 72 Z",
  chevron: "M0 52 L32 24 L64 52 V66 L32 38 L0 66 Z",
  pall: "M24 0 L32 28 L40 0 Z M28 30 H36 V72 H28 Z",
  bordure: "M0 0 H64 V72 H0 Z M10 10 V30 C10 46 24 56 32 60 C40 56 54 46 54 30 V10 Z",
  chief: "M0 0 H64 V20 H0 Z",
  checky: "M0 0 H16 V18 H0 Z M32 0 H48 V18 H32 Z M16 18 H32 V36 H16 Z M48 18 H64 V36 H48 Z M0 36 H16 V54 H0 Z M32 36 H48 V54 H32 Z M16 54 H32 V72 H16 Z M48 54 H64 V72 H48 Z",
};

/** A House's color for text on the dark ground: its primary, or its secondary when the primary is too dark to read. */
export function inkOf(colors: readonly string[] | undefined): string | undefined {
  if (!colors) return undefined;
  const hexes = colors.map((c) => HERALDRY_COLORS.get(c)).filter((h): h is string => !!h);
  const light = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  };
  return hexes.find((h) => light(h) >= 90) ?? (hexes.length ? "var(--text)" : undefined);
}
const lum = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
};

/** A charge drawn at (x, y), `scale` units a pixel, in `color`, with its black edge. */
function Charge({ id, x, y, scale, color, edge }: { id: string; x: number; y: number; scale: number; color: string; edge: string }) {
  const rows = CHARGES[id];
  if (!rows) return null;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`} filter={`url(#${edge})`} shapeRendering="crispEdges">
      <PixelMarks rows={rows} color={color} />
    </g>
  );
}

export function Emblem({ emblem, colors, size = 48 }: { emblem: { shield: string; division: string; tinctures: string[]; charge: string; secondary?: string; chargeColor?: string }; colors: [string, string]; size?: number }) {
  const id = useId();
  const clip = `${id}-clip`;
  const edge = `${id}-edge`;
  const field = HERALDRY_COLORS.get(emblem.tinctures[0] ?? colors[0]) ?? "#444";
  const second = HERALDRY_COLORS.get(emblem.tinctures[1] ?? colors[1]) ?? "#999";
  const outline = SHIELDS[emblem.shield] ?? SHIELDS.heater!;
  const division = DIVISIONS[emblem.division];
  // On a plain field the charge takes the second tincture, unless the two are too alike to tell apart;
  // on a divided field it is bone (or sable on a pale field), so it reads across both halves. A House
  // may paint it in a color of its own choosing instead (Josh 2026-11-10).
  const chosen = emblem.chargeColor ? HERALDRY_COLORS.get(emblem.chargeColor) : undefined;
  const charge = chosen ?? (!division && Math.abs(lum(field) - lum(second)) > 0.25 ? second : lum(field) > 0.6 ? INK : BONE);
  const name = (c: string) => c.replace(/_/g, " ");
  return (
    <svg className="sp-emblem" width={size} height={(size * 72) / 64} viewBox="0 0 64 72" role="img" aria-label={`${name(emblem.charge)}${emblem.secondary ? ` and ${name(emblem.secondary)}` : ""} on a ${name(emblem.shield)} shield`}>
      <defs>
        <clipPath id={clip}>
          <path d={outline} />
        </clipPath>
        <EdgeFilter id={edge} />
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="64" height="72" fill={field} />
        {division ? <path d={division} fill={second} fillRule="evenodd" /> : null}
        {emblem.secondary ? (
          <>
            <Charge id={emblem.charge} x={16} y={22} scale={2} color={charge} edge={edge} />
            <Charge id={emblem.secondary} x={40} y={6} scale={1} color={charge} edge={edge} />
          </>
        ) : (
          <Charge id={emblem.charge} x={14} y={16} scale={2.25} color={charge} edge={edge} />
        )}
      </g>
      <path d={outline} fill="none" stroke={INK} strokeWidth="3" />
    </svg>
  );
}
