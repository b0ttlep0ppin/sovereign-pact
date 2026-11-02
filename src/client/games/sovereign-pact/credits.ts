// The Credits screen's text (SPEC §15.2, §17): every asset author, as docs/CREDITS.md records them.
// A section is listed once anything from it ships; until then it stays here, so nobody is forgotten.
import { musicCredits } from "./music";

export interface CreditSection {
  title: string;
  lines: string[];
}

export const CREDITS: CreditSection[] = [
  { title: "Music", lines: musicCredits() },
  {
    title: "Monsters",
    lines: ["1000-Monster Mega Pack and 1000-Monster Mega Pack 2 by Pixel Material Studio, used under their license (in-game use only)."],
  },
  {
    title: "Scions",
    lines: [
      "Sprites from the Universal LPC Spritesheet Character Generator (Liberated Pixel Cup), github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator, under OGA-BY 3.0, CC-BY-SA 3.0 and GPL 3.0.",
      "Body: bluecarrot16, JaidynReiman, Benjamin K. Smith (BenCreating), Evert, Eliza Wyatt (ElizaWy), TheraHedwig, MuffinElZangano, Durrani, Johannes Sjölund (wulax), Stephen Challener (Redshrike).",
      "Head: bluecarrot16, Benjamin K. Smith (BenCreating), Stephen Challener (Redshrike).",
      "Face: JaidynReiman, ElizaWy, Stephen Challener (Redshrike).",
    ],
  },
  { title: "Sound effects", lines: ["Sound effects cut from BOOM Library packs (boomlibrary.com: Close Combat, Creature Foley, Death Whistle, Magic – Arcane Forces, Magic, Medieval Weapons), used under its license."] },
  {
    title: "Tiles and backgrounds",
    lines: ["Tiles and backgrounds built from Oryx Design Lab tilesets (oryxdesignlab.com: 16-bit Fantasy, Ultimate Fantasy, 32 Gothic), used under their royalty-free commercial license."],
  },
];
