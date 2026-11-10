// The rift over the capital, torn in the shape of a crown (Josh 2026-11-10: "it would be cool if its
// silhouette could suggest the shape of a crown… filling in a bit more every year as you get closer to
// year twenty"). The whole crown is always faintly there as cracks of light; the Years fill it from
// the band up with roiling violet, and the last Year closes the points. Noise filters give the tear
// its texture and ragged edges.
import { useId } from "react";
import "./RiftCrown.css";

/** Five points over a band: the middle tallest, the edges torn rather than cut. */
const CROWN =
  "M18 76 L18 58 L8 22 L44 46 L64 16 L82 42 L100 4 L118 42 L136 16 L156 46 L192 22 L182 58 L182 76 Q100 70 18 76 Z";
/** The orbs on the five points, and the band's jewels. */
const ORBS: [number, number, number][] = [[8, 21, 4], [64, 14, 4], [100, 3, 5], [136, 14, 4], [192, 21, 4]];
const JEWELS = [46, 73, 100, 127, 154];

/** Pixel bubbles fizzing up off the torn edge, like carbonation: [x, size, seconds to rise, delay, height]. */
const BUBBLES: [number, number, number, number, number][] = Array.from({ length: 22 }, (_, i) => {
  const r = (k: number) => ((i * 7919 + k * 104729) % 997) / 997;
  return [22 + r(1) * 156, r(2) < 0.7 ? 1.2 : 1.8, 1.6 + r(3) * 1.8, -r(4) * 3.4, 8 + r(5) * 16];
});

/** How much of the crown the Years have filled: a sliver at the start, all of it in the last Year. */
export const crownFill = (year: number, years: number): number => Math.min(1, Math.max(0.08, year / Math.max(1, years)));

/** `faint`: the splash's crown, only hinted at; thin broken cracks and a thinner veil of violet. */
export default function RiftCrown({ fill, className, faint }: { fill: number; className?: string; faint?: boolean }) {
  const id = `crown${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const top = 78 - 74 * Math.min(1, Math.max(0, fill));
  return (
    <svg className={`sp-crown${faint ? " sp-crown--faint" : ""}${className ? ` ${className}` : ""}`} viewBox="0 0 200 80" aria-hidden="true" data-fill={fill.toFixed(2)}>
      <defs>
        {/* Ragged edges: the outline pushed about by noise. */}
        <filter id={`${id}r`} x="-10%" y="-20%" width="120%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.09 0.18" numOctaves="3" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* The roil inside: dark veins through the violet. */}
        <filter id={`${id}t`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="turbulence" baseFrequency="0.045 0.11" numOctaves="4" seed="3" result="v" />
          <feColorMatrix in="v" type="matrix" values="0 0 0 0 0.06  0 0 0 0 0  0 0 0 0 0.12  1.8 0 0 0 -0.6" result="veins" />
          <feComposite in="veins" in2="SourceGraphic" operator="in" result="dark" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="dark" />
          </feMerge>
        </filter>
        <filter id={`${id}g`} x="-30%" y="-60%" width="160%" height="220%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <linearGradient id={`${id}f`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#dcb4ff" />
          <stop offset="0.35" stopColor="#9a4ee6" />
          <stop offset="0.8" stopColor="#5a1f8e" />
          <stop offset="1" stopColor="#2a0a44" />
        </linearGradient>
        {/* The shimmer: a pale sheen that sweeps across what has torn open. */}
        <linearGradient id={`${id}s`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fdf6ff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${id}k`}>
          <path d={CROWN} />
        </clipPath>
        <clipPath id={`${id}c`}>
          <rect x="0" y={top} width="200" height={80 - top} />
        </clipPath>
      </defs>
      <g filter={`url(#${id}r)`}>
        {/* The glow behind what has opened. */}
        <path className="sp-crown__glow" d={CROWN} filter={`url(#${id}g)`} clipPath={`url(#${id}c)`} />
        {/* The crown entire, as cracks of light not yet torn through. */}
        <path className="sp-crown__ghost" d={CROWN} />
        {ORBS.map(([x, y, r]) => (
          <circle key={x} className="sp-crown__ghost" cx={x} cy={y} r={r} />
        ))}
        {/* Light running along the cracks. */}
        <path className="sp-crown__run" d={CROWN} />
        <g clipPath={`url(#${id}c)`} className="sp-crown__body">
          <path d={CROWN} fill={`url(#${id}f)`} filter={`url(#${id}t)`} />
          {ORBS.map(([x, y, r]) => (
            <circle key={x} cx={x} cy={y} r={r} fill={`url(#${id}f)`} />
          ))}
          <path className="sp-crown__band" d="M18 58 Q100 52 182 58" />
          {JEWELS.map((x) => (
            <circle key={x} className="sp-crown__jewel" cx={x} cy={67} r={x === 100 ? 3 : 2} />
          ))}
          <g clipPath={`url(#${id}k)`}>
            <rect className="sp-crown__sheen" x="-60" y="-10" width="34" height="100" fill={`url(#${id}s)`} transform="skewX(-20)" />
          </g>
        </g>
        {/* The torn edge where the filling has reached. */}
        {fill < 1 ? <line className="sp-crown__edge" x1="0" x2="200" y1={top} y2={top} clipPath={`url(#${id}k)`} /> : null}
        {fill < 1 ? (
          <g className="sp-crown__fizz" clipPath={`url(#${id}k)`}>
            {BUBBLES.map(([x, size, rise, delay, height], i) => (
              <rect
                key={i}
                x={x}
                y={top - size}
                width={size}
                height={size}
                style={{ animationDuration: `${rise}s`, animationDelay: `${delay}s`, ["--rise" as string]: `${-height}px` }}
              />
            ))}
          </g>
        ) : null}
      </g>
    </svg>
  );
}
