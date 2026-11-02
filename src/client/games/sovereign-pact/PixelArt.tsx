// Pixel masks drawn as SVG (charges.ts, icons.ts): '#' the body, 'o' a dark detail, '+' a light one.
// Each row's runs become one rectangle, and crisp edges keep the pixels square at any size.
import { useId } from "react";

export const INK = "#0b0a0d";
export const BONE = "#ece0c4";
export const GILT = "#e3b04b";

/** The SVG path of one kind of pixel in a mask, row runs merged. */
export function pixelPath(rows: readonly string[], ch: string): string {
  let d = "";
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] !== ch) continue;
      let w = 1;
      while (row[x + w] === ch) w++;
      d += `M${x} ${y}h${w}v1h${-w}z`;
      x += w - 1;
    }
  });
  return d;
}

/** The three marks of a mask in `color`, with details that stay visible on it. */
export function PixelMarks({ rows, color }: { rows: readonly string[]; color: string }) {
  return (
    <>
      <path d={pixelPath(rows, "#")} fill={color} />
      <path d={pixelPath(rows, "o")} fill={color === INK ? BONE : INK} />
      <path d={pixelPath(rows, "+")} fill={color === BONE ? GILT : BONE} />
    </>
  );
}

/** A black edge one pixel wide around whatever it is applied to. */
export function EdgeFilter({ id, radius = 0.6 }: { id: string; radius?: number }) {
  return (
    <filter id={id} x="-20%" y="-20%" width="140%" height="140%">
      <feMorphology in="SourceAlpha" operator="dilate" radius={radius} result="grown" />
      <feFlood floodColor={INK} />
      <feComposite in2="grown" operator="in" />
      <feMerge>
        <feMergeNode />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  );
}

/** A mask on its own, `size` CSS pixels wide, outlined in black. */
export function PixelArt({ rows, size, color = BONE, className }: { rows: readonly string[] | undefined; size: number; color?: string; className?: string }) {
  const edge = useId();
  if (!rows) return null;
  const n = rows[0]!.length;
  return (
    <svg className={className} width={size} height={(size * rows.length) / n} viewBox={`-1 -1 ${n + 2} ${rows.length + 2}`} aria-hidden="true" shapeRendering="crispEdges">
      <defs>
        <EdgeFilter id={edge} radius={0.5} />
      </defs>
      <g filter={`url(#${edge})`}>
        <PixelMarks rows={rows} color={color} />
      </g>
    </svg>
  );
}
