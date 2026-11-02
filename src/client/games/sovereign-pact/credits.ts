// The Credits screen's text (SPEC §15.2, §17): every asset author, as docs/CREDITS.md records them.
// A section is listed once anything from it ships; until then it stays here, so nobody is forgotten.
import { musicCredits } from "./music";
import LAYERS from "./scion-layers.json";

export interface CreditSection {
  title: string;
  lines: string[];
}

/** The same name spelled two ways in the generator's credits. */
const ALIAS: Record<string, string> = { ElizaWy: "Eliza Wyatt (ElizaWy)" };

export const CREDITS: CreditSection[] = [
  { title: "Music", lines: musicCredits() },
  {
    title: "Monsters",
    lines: ["1000-Monster Mega Pack and 1000-Monster Mega Pack 2 by Pixel Material Studio, used under their license (in-game use only)."],
  },
  { title: "Scions", lines: scionCredits() },
  { title: "Sound effects", lines: ["Sound effects cut from BOOM Library packs (boomlibrary.com: Close Combat, Creature Foley, Death Whistle, Magic – Arcane Forces, Magic, Medieval Weapons), used under its license."] },
  { title: "Fonts", lines: ["Jacquard 12 by Sarah Cadigan-Fried; Alegreya Sans by Juan Pablo del Peral (Huerta Tipográfica). Both under the SIL Open Font License 1.1."] },
  {
    title: "Tiles and backgrounds",
    lines: ["Tiles and backgrounds built from Oryx Design Lab tilesets (oryxdesignlab.com: 16-bit Fantasy, Ultimate Fantasy, 32 Gothic), used under their royalty-free commercial license."],
  },
];

/** The Scion sprites' authors, read from the cut layers' own credits (tools/cut-scions.py). */
export function scionCredits(): string[] {
  const names = new Set<string>();
  for (const c of LAYERS.credits) {
    for (const a of c.authors) {
      // One entry reads "ElizaWy; walk and down by JaidynReiman"; an e-mail address is no name.
      for (const part of a.split(/;\s*(?:[a-z ]+ by )?/)) {
        const name = part.trim();
        if (name && !name.includes("@")) names.add(ALIAS[name] ?? name);
      }
    }
  }
  const licenses = [...new Set(LAYERS.credits.flatMap((c) => c.licenses))].sort();
  return [
    `Scion sprites assembled from layers of the Universal LPC Spritesheet Character Generator (Liberated Pixel Cup), github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator, recolored in game, under ${licenses.join(", ")}.`,
    `Art by ${[...names].sort((a, b) => a.localeCompare(b)).join(", ")}.`,
  ];
}
