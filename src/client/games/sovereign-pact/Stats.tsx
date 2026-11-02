// The six stats on a character card (§7.2), each with its icon and, on hover, what it does and what
// raised or lowered it; and the Tarot cards' symbols (§6.5). Pixel masks as in icons.ts.
import { BONE, GILT, PixelArt } from "./PixelArt";

export const STATS = ["Might", "Resilience", "Guile", "Acuity", "Sagacity", "Speed"];

/** What each stat does, as the rules use it (formulas in tuning.ts). */
export const STAT_TEXT: Record<string, string> = {
  Might: "Physical damage. Adds a little max HP and Arms Durability.",
  Resilience: "Max HP and Body Durability; resists physical ailments (poison, bleeding); a little Sanity.",
  Guile: "Evasion and accuracy, cheaper movement, Legs Durability; with Acuity, TP gained in battle.",
  Acuity: "Spell power, max MP and Head Durability; resists mental ailments; with Guile, TP gained in battle.",
  Sagacity: "Healing power, spell accuracy and spell resistance; max MP and Sanity.",
  Speed: "How soon turns come round: every clock step adds this much CT, and a turn comes at 100.",
};

/** 9×9 marks for the stats: '#' the body, 'o' a dark detail, '+' a light one. */
export const STAT_ICONS: Record<string, readonly string[]> = {
  Might: [
    ".......##",
    "......#+#",
    ".....#+#.",
    "....#+#..",
    ".#.#+#...",
    "..#+#....",
    "..o#.....",
    ".o.o#....",
    "o........",
  ],
  Resilience: [
    "#########",
    "#+++#+++#",
    "#+++#+++#",
    "#########",
    "#+++#+++#",
    ".#++#++#.",
    "..#+#+#..",
    "...###...",
    "....#....",
  ],
  Guile: [
    ".........",
    ".........",
    "#########",
    "#oo###oo#",
    "#oo#.#oo#",
    ".###.###.",
    ".........",
    ".........",
    ".........",
  ],
  Acuity: [
    ".........",
    "...###...",
    ".##+++##.",
    "#++ooo++#",
    "#++o+o++#",
    "#++ooo++#",
    ".##+++##.",
    "...###...",
    ".........",
  ],
  Sagacity: [
    ".........",
    "##.....##",
    "#+##.##+#",
    "#+++#+++#",
    "#+o+#+o+#",
    "#+++#+++#",
    "#+o+#+o+#",
    "####o####",
    ".........",
  ],
  Speed: [
    ".........",
    "#...#....",
    ".#...#...",
    "..#...#..",
    "...#...#.",
    "..#...#..",
    ".#...#...",
    "#...#....",
    ".........",
  ],
};

/** 9×9 symbols for the 22 Major Arcana, by id. */
export const TAROT_ICONS: Record<string, readonly string[]> = {
  // A white rose.
  fool: ["...###...", "..#+#+#..", ".#+#+#+#.", ".#+++++#.", "..#+++#..", "...###...", "....#.##.", "..#.#.#..", "....#...."],
  // The lemniscate.
  magician: [".........", ".........", ".##...##.", "#..#.#..#", "#...#...#", "#..#.#..#", ".##...##.", ".........", "........."],
  // The two pillars.
  high_priestess: ["#########", ".##...##.", ".#o...#+.", ".#o...#+.", ".#o...#+.", ".#o...#+.", ".#o...#+.", ".##...##.", "#########"],
  // Venus.
  empress: ["...###...", "..#...#..", ".#.....#.", ".#.....#.", "..#...#..", "...###...", "....#....", "..#####..", "....#...."],
  // A crown.
  emperor: [".........", "#...#...#", "##.###.##", "#########", "#+o+o+o+#", "#########", ".........", ".........", "........."],
  // A key.
  hierophant: ["..###....", ".#+.+#...", ".#...#...", ".#+.+#...", "..###....", "...#.....", "...###...", "...#.....", "...##...."],
  // A heart.
  lovers: [".........", ".##...##.", "#++#.#++#", "#+++#+++#", "#+++++++#", ".#+++++#.", "..#+++#..", "...#+#...", "....#...."],
  // The canopy's star over the car.
  chariot: ["....#....", "...###...", "#########", "...###...", "..#.#.#..", ".........", "#########", "#+#+#+#+#", ".o.....o."],
  // A lion's paw.
  strength: [".#.#.#...", "#+##+##.#", ".#..#..##", "........#", ".######..", "#++++++#.", "#++++++#.", "#++++++#.", ".######.."],
  // A lantern.
  hermit: ["...###...", "....#....", "..#####..", ".#+++++#.", ".#++o++#.", ".#+ooo+#.", ".#+++++#.", "..#####..", "........."],
  // The wheel.
  wheel_of_fortune: ["..#####..", ".#..#..#.", "#.#.#.#.#", "#..###..#", "#########", "#..###..#", "#.#.#.#.#", ".#..#..#.", "..#####.."],
  // The scales.
  justice: ["....#....", "#########", "#...#...#", "#...#...#", "##..#..##", "###.#.###", "....#....", "...###...", "..#####.."],
  // The tau cross, hung upside down.
  hanged_man: ["#########", "....#....", "....#....", "....#....", "...###...", "..#+++#..", "...#+#...", "..#...#..", "........."],
  // A skull.
  death: ["..#####..", ".#+++++#.", "#+++++++#", "#+oo+oo+#", "#+oo+oo+#", ".#+++++#.", "..#+o+#..", "..#+#+#..", "...###..."],
  // The cup that pours into another.
  temperance: ["#######..", "#+++++#..", ".#+++#...", "..#+#.#..", "...#...#.", "..###.#++", "......#+#", ".....###.", "....#####"],
  // Horns.
  devil: ["#.......#", "#.......#", ".#.....#.", ".##...##.", "..#####..", ".#+++++#.", ".#+o+o+#.", "..#+++#..", "...###..."],
  // The tower, struck.
  tower: ["......#..", "..###.#..", "..#+#..#.", "..###.#..", "..#+#....", "..#o#....", "..#+#....", ".##o##...", "#######.."],
  // An eight-pointed star.
  star: ["....#....", "#...#...#", ".#.###.#.", "..#+++#..", "####+####", "..#+++#..", ".#.###.#.", "#...#...#", "....#...."],
  // The crescent.
  moon: ["...####..", "..#++#...", ".#++#....", "#++#.....", "#++#.....", "#++#.....", ".#++#....", "..#++#...", "...####.."],
  // The sun.
  sun: ["#...#...#", ".#.....#.", "...###...", "..#+++#..", "##+++++##", "..#+++#..", "...###...", ".#.....#.", "#...#...#"],
  // The trumpet.
  judgement: [".........", "#........", "##.......", "#+#######", "#+++++++#", "#+#######", "##.....#.", "#......#.", "........."],
  // The wreath.
  world: ["...###...", "..#...#..", ".#..+..#.", "#..+.+..#", "#.+...+.#", "#..+.+..#", ".#..+..#.", "..#...#..", "...###..."],
};

const ROMAN = ["0", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX", "XXI"];
export const roman = (n: number) => ROMAN[n] ?? String(n);

/** A Tarot card's badge: its symbol and its number, as on the card. */
export function TarotBadge({ id, number }: { id: string; number?: number }) {
  return (
    <span className="sp-tarot" title="Tarot">
      <PixelArt rows={TAROT_ICONS[id]} size={18} color={GILT} />
      {number !== undefined ? <small>{roman(number)}</small> : null}
    </span>
  );
}

/**
 * The stat boxes: the value a battle reads when it is known (`stats`), else the rolled base. Hovering
 * one says what the stat does, its base, and each bonus behind the difference.
 */
export function StatGrid({ base, stats, from, growth, extra }: { base: readonly number[]; stats?: readonly number[]; from?: readonly (readonly string[])[]; growth?: readonly number[]; extra?: React.ReactNode }) {
  return (
    <dl className="sp-person__stats">
      {STATS.map((s, i) => {
        const shown = stats?.[i] ?? base[i]!;
        const lines = from?.[i] ?? [];
        const tip = [`${s}: ${STAT_TEXT[s]}`, stats ? `Base ${base[i]}${lines.length ? `, then ${lines.join(", ")}` : ""} = ${shown}` : `Base ${base[i]}`].join("\n");
        const tone = shown > base[i]! ? " is-up" : shown < base[i]! ? " is-down" : "";
        return (
          <div key={s} title={tip} className={`sp-stat${tone}`}>
            <dt>
              <PixelArt rows={STAT_ICONS[s]} size={11} color={BONE} />
              <span>{s.slice(0, 3)}</span>
            </dt>
            <dd>{shown}</dd>
            {growth ? <small className="sp-person__growth" title={`${s} growth per level`}>+{(growth[i]! / 100).toFixed(1)}</small> : null}
          </div>
        );
      })}
      {extra}
    </dl>
  );
}

export const ELEMENT_NAMES = ["Holy", "Dark", "Fire", "Water", "Earth", "Wind"];
/** Each element's color, for its symbol. */
const ELEMENT_COLORS = ["#f2e3a0", "#9a7ad0", "#e8703a", "#5aa0e0", "#a88a4a", "#9fd8b8"];
/** 9×9 symbols for the six elements, in ELEMENTS order. */
export const ELEMENT_ICONS: readonly (readonly string[])[] = [
  // Holy: a radiant cross.
  ["....#....", ".#..#..#.", "...###...", "..#+++#..", "####+####", "..#+++#..", "...###...", ".#..#..#.", "....#...."],
  // Dark: an eclipse.
  ["...###...", ".##ooo##.", ".#ooooo#.", "#ooooooo#", "#ooooooo#", "#ooooooo#", ".#ooooo#.", ".##ooo##.", "...###..."],
  // Fire: a flame.
  ["....#....", "...##....", "...###.#.", "..####.#.", ".###+###.", ".##+++##.", "###+++###", ".##+o+##.", "..#####.."],
  // Water: a drop.
  ["....#....", "....#....", "...###...", "..##+##..", ".##+###..", ".#+####..", ".#+#####.", "..#####..", "...###..."],
  // Earth: a mountain.
  [".........", "....#....", "...#+#...", "...#+##..", "..#+###..", "..#####.#", ".#######+", "#########", "#########"],
  // Wind: gusts.
  [".........", "#####.#..", "......#..", "#######..", ".........", "########.", ".......#.", "..#####..", "........."],
];

/** The six elements as symbols, each with its affinity: + takes less of that element, − takes more. */
export function AffinityRow({ aff, from }: { aff: readonly number[]; from?: readonly (readonly string[])[] }) {
  return (
    <ul className="sp-affinity" aria-label="Elemental affinity">
      {ELEMENT_NAMES.map((el, i) => {
        const n = aff[i] ?? 0;
        const lines = from?.[i] ?? [];
        const tip = `${el} ${n > 0 ? `+${n}: takes ${Math.min(100, n)}% less ${el} damage` : n < 0 ? `${n}: takes ${-n}% more ${el} damage` : "0: takes it as it comes"}${lines.length ? `\n${lines.join(", ")}` : ""}`;
        return (
          <li key={el} title={tip} className={n > 0 ? "is-up" : n < 0 ? "is-down" : "is-none"} aria-label={tip}>
            <PixelArt rows={ELEMENT_ICONS[i]} size={13} color={ELEMENT_COLORS[i]} />
            {n ? <small>{n > 0 ? `+${n}` : n}</small> : null}
          </li>
        );
      })}
    </ul>
  );
}
