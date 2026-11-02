// Scion sprites (SPEC §15.1): each Scion assembled from the LPC generator's pieces (tools/cut-scions.py),
// the body and head by sex and age, a hair style and colors read from who they are, and an outfit by
// Job: armor, a hat, a weapon, and a cape and shield in their House's colors. The pieces are recolored
// once each and stacked into one sheet per Scion, cached; a sprite shows one row of it.
import { HAIR_COLORS as HAIR_ALL_COLORS, HAIR_LONG, HAIR_SHORT, styleOf, type SovView } from "@vibepulse/shared/games/sovereign-pact";
import { useEffect, useState, type CSSProperties } from "react";
import { HERALDRY_COLORS } from "./Emblem";
import LAYERS from "./scion-layers.json";
import "./ScionSprite.css";

type Person = SovView["people"][number];
type Slot = "body" | "head" | "hair" | "beard" | "legs" | "feet" | "shirt" | "armor" | "cape" | "hat" | "weapon" | "shield";
/**
 * A sheet row: idle facing down (the portrait), idle facing left (toward the enemy), four attacks, and the
 * fall. The chant is the spellcast's raised-hands frames, swayed back and forth while a spell charges.
 */
export type Anim = "portrait" | "idle" | "slash" | "thrust" | "spellcast" | "shoot" | "hurt" | "chant";
const ROW: Record<Anim, number> = { portrait: 0, idle: 1, slash: 2, thrust: 3, spellcast: 4, shoot: 5, hurt: 6, chant: 4 };
/** The first frame an animation plays from (the chant starts with the hands already up). */
const START: Partial<Record<Anim, number>> = { chant: 2 };
/** Milliseconds a frame shows. */
const FRAME_MS: Partial<Record<Anim, number>> = { idle: 400, chant: 220 };
const CELL = LAYERS.cell;
const COLS = Math.max(...LAYERS.frames);
export const FRAMES: Record<Anim, number> = { portrait: 1, idle: LAYERS.frames[1]!, slash: LAYERS.frames[2]!, thrust: LAYERS.frames[3]!, spellcast: LAYERS.frames[4]!, shoot: LAYERS.frames[5]!, hurt: LAYERS.frames[6]!, chant: 4 };

/** What each Job wears and carries; the advanced Jobs dress like the base Job nearest them. */
const OUTFIT: Record<string, Partial<Record<Slot, string>>> = {
  recruit: { shirt: "tshirt" },
  soldier: { armor: "chainmail", weapon: "sword", shield: "heater", cape: "solid" },
  knight: { armor: "plate", weapon: "sword", shield: "heater", cape: "solid" },
  magus: { shirt: "longsleeve", hat: "wizard", weapon: "staff", cape: "solid" },
  soothsayer: { shirt: "longsleeve", hat: "hood", weapon: "staff" },
  vagabond: { armor: "leather", hat: "bandana", weapon: "bow" },
  pugilist: { shirt: "sleeveless" },
  minstrel: { shirt: "tshirt", hat: "cavalier", weapon: "dagger", cape: "solid" },
  gambler: { shirt: "longsleeve", hat: "tricorne", weapon: "crossbow" },
  ravager: { armor: "chainmail", weapon: "sword", cape: "solid" },
  sword_saint: { shirt: "longsleeve", weapon: "sword", cape: "solid" },
  abjurer: { shirt: "longsleeve", hat: "hood", weapon: "staff", cape: "solid" },
  conjurer: { shirt: "longsleeve", hat: "wizard", weapon: "staff" },
  tinkerer: { armor: "leather", weapon: "crossbow" },
  alterer: { shirt: "tshirt", hat: "hood", weapon: "staff" },
};
/** The attack a Job's weapon swings with. */
const ATTACK: Record<string, Anim> = { sword: "slash", longsword: "slash", mace: "slash", dagger: "slash", staff: "spellcast", bow: "shoot", crossbow: "shoot" };

const SKINS = ["light", "amber", "olive", "taupe", "bronze", "brown", "black"];
/** The colors a young Scion is born with; the old go gray or white. */
const HAIR_COLORS = HAIR_ALL_COLORS.filter((c) => c !== "gray" && c !== "white");

/** A small stable hash: the same Scion always gets the same look. */
function hash(n: number, salt: number): number {
  let x = (n * 2654435761 + salt * 40503) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822519) >>> 0;
  x ^= x >>> 13;
  return x >>> 0;
}
const pick = <T,>(xs: readonly T[], n: number, salt: number): T => xs[hash(n, salt) % xs.length]!;

export interface ScionLook {
  sex: "m" | "f";
  skin: string;
  hair: string;
  hairColor: string;
  beard?: string;
  elderly: boolean;
  job: string;
  colors: [string, string];
  /** What they wear, when it is known: it replaces their Job's outfit piece by piece ("" is bare). */
  kit?: Partial<Record<"weapon" | "shield" | "hat" | "armor", string>>;
  /** Bareheaded: no hat, hood or helm (restyled so). */
  bare?: boolean;
}

/** The sprite piece each item base is drawn with (DECISIONS 8aj); the LPC set has no attribution-only axe or spear. */
const KIT: Record<string, ["weapon" | "shield" | "hat" | "armor", string]> = {
  sword: ["weapon", "sword"],
  greatsword: ["weapon", "longsword"],
  greataxe: ["weapon", "longsword"],
  axe: ["weapon", "mace"],
  mace: ["weapon", "mace"],
  maul: ["weapon", "mace"],
  spear: ["weapon", "staff"],
  staff: ["weapon", "staff"],
  knife: ["weapon", "dagger"],
  throwing_knives: ["weapon", "dagger"],
  knuckles: ["weapon", ""],
  instrument: ["weapon", ""],
  bow: ["weapon", "bow"],
  crossbow: ["weapon", "crossbow"],
  buckler: ["shield", "round"],
  heater_shield: ["shield", "heater"],
  tower_shield: ["shield", "scutum"],
  hood: ["hat", "hood"],
  coif: ["hat", "mail"],
  helm: ["hat", "nasal"],
  jerkin: ["armor", "leather"],
  hauberk: ["armor", "chainmail"],
  plate: ["armor", "plate"],
};

/** The sprite pieces a Scion's worn gear calls for: weapon and armor always (bare when none), a shield or helm when worn. */
export function kitOf(gear: Person["gear"], items: readonly { id: number; base: string }[]): ScionLook["kit"] {
  const kit: NonNullable<ScionLook["kit"]> = { weapon: "", armor: "" };
  for (const slot of ["main", "off", "head", "body"] as const) {
    const item = gear?.[slot] === undefined ? undefined : items.find((i) => i.id === gear[slot]);
    const piece = item ? KIT[item.base] : undefined;
    // The main hand's weapon wins over a second one in the off hand.
    if (piece && !(piece[0] === "weapon" && kit.weapon)) kit[piece[0]] = piece[1];
  }
  return kit;
}

/**
 * How a Scion looks: read from who they are (their id, sex and age), their Job and their House's colors,
 * and, given the items the view holds, the gear they wear.
 */
/** How they were born to look, before any restyling: the same person always rolls the same. */
export function bornLook(p: Pick<Person, "id" | "sex" | "age">): { hair: string; hairColor: string; beard?: string } {
  const long = p.sex === "f" ? hash(p.id, 3) % 5 !== 0 : hash(p.id, 3) % 6 === 0;
  return {
    hair: pick(long ? HAIR_LONG : HAIR_SHORT, p.id, 2),
    hairColor: p.age >= 55 ? (hash(p.id, 4) % 2 ? "gray" : "white") : pick(HAIR_COLORS, p.id, 4),
    ...(p.sex === "m" && hash(p.id, 5) % 5 < 2 ? { beard: pick(["trimmed", "medium"], p.id, 6) } : {}),
  };
}

export function lookOf(p: Pick<Person, "id" | "sex" | "age" | "job" | "status"> & { gear?: Person["gear"]; look?: readonly string[] }, colors: readonly string[] | undefined, items?: readonly { id: number; base: string }[]): ScionLook {
  const elderly = p.age >= 55;
  const born = bornLook(p);
  const chosen = styleOf({ look: [...(p.look ?? [])] });
  const beard = chosen.beard === undefined ? born.beard : chosen.beard === "none" || p.sex !== "m" ? undefined : chosen.beard;
  return {
    sex: p.sex,
    skin: pick(SKINS, p.id, 1),
    hair: chosen.hair ?? born.hair,
    hairColor: chosen.hair_color ?? born.hairColor,
    ...(beard ? { beard } : {}),
    ...(chosen.headwear === "off" ? { bare: true } : {}),
    elderly,
    job: p.status === "recruit" ? "recruit" : (p.job ?? "recruit"),
    colors: [HERALDRY_COLORS.get(colors?.[0] ?? "") ?? "#6b5a3a", HERALDRY_COLORS.get(colors?.[1] ?? "") ?? "#8a8a8a"],
    ...(items && p.gear && p.status !== "recruit" ? { kit: kitOf(p.gear, items) } : {}),
  };
}

/** Their Job's outfit with what they wear laid over it. */
const outfitOf = (look: ScionLook): Partial<Record<Slot, string>> => {
  const out = { ...(OUTFIT[look.job] ?? OUTFIT.recruit!) };
  for (const [slot, piece] of Object.entries(look.kit ?? {}) as [Slot, string][]) {
    if (piece) out[slot] = piece;
    // Bare-handed or unarmored: no weapon or armor; a helmless head keeps its Job's hat.
    else if (slot === "weapon" || slot === "armor") delete out[slot];
  }
  if (look.bare) delete out.hat;
  return out;
};

export const attackOf = (look: ScionLook): Anim => ATTACK[outfitOf(look).weapon ?? ""] ?? "thrust";

/** The ability the way the content describes it, as far as the animation cares. */
export interface Action {
  kind?: string;
  reach?: string;
}

/**
 * What a Scion does on screen when they use `action`: a spell, a heal or a song is cast; a ranged attack
 * is shot (a staff or a bare hand throws it); a melee one is swung with their weapon, a staff thrust.
 * An unknown action (an item, a plain move) is the weapon's own attack.
 */
export function animFor(look: ScionLook, action: Action | undefined): Anim {
  const weapon = outfitOf(look).weapon;
  if (!action) return attackOf(look);
  if (action.kind === "magic" || action.kind === "heal" || action.kind === "support") return "spellcast";
  if (action.reach === "ranged") return weapon === "bow" || weapon === "crossbow" ? "shoot" : "thrust";
  if (weapon === "staff" || weapon === "bow" || weapon === "crossbow" || !weapon) return "thrust";
  return "slash";
}

/** Whether `anim` carries the Scion toward the foe. */
export const lunges = (anim: Anim): boolean => anim === "slash" || anim === "thrust";

/** Six tones of a House color, dark to light, to stand in for a cloth palette. */
function ramp(hex: string): string[] {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const mix = (t: number) => {
    const to = t < 0 ? 0 : 255;
    const k = Math.abs(t);
    return "#" + [r, g, b].map((c) => Math.round(c + (to - c) * k).toString(16).padStart(2, "0")).join("");
  };
  return [mix(-0.8), mix(-0.6), mix(-0.4), mix(-0.15), mix(0), mix(0.25)];
}

type Layer = (typeof LAYERS.layers)[number];
interface Piece {
  layer: Layer;
  /** The six tones to recolor the piece with, or none. */
  tones?: string[];
}

/** Every piece of a Scion's sprite, back to front. */
export function piecesOf(look: ScionLook): Piece[] {
  const outfit = outfitOf(look);
  const palettes = LAYERS.palettes as Record<string, { base: string; colors: Record<string, string[]> }>;
  const want: [Slot, string | undefined, string[] | undefined][] = [
    ["body", "body", palettes.body!.colors[look.skin]],
    ["head", `${look.sex === "f" ? "female" : "male"}${look.elderly ? "_elderly" : ""}`, palettes.body!.colors[look.skin]],
    ["hair", look.hair, palettes.hair!.colors[look.hairColor]],
    ["beard", look.beard, palettes.hair!.colors[look.hairColor]],
    ["legs", "pants", palettes.cloth!.colors.charcoal],
    ["feet", "boots", palettes.cloth!.colors.leather],
    ["shirt", outfit.shirt, ramp(look.colors[1])],
    ["armor", outfit.armor, undefined],
    ["cape", outfit.cape, ramp(look.colors[0])],
    ["hat", outfit.hat, ramp(look.colors[1])],
    ["weapon", outfit.weapon, undefined],
    ["shield", outfit.shield, ramp(look.colors[0])],
  ];
  const out: Piece[] = [];
  for (const [slot, option, tones] of want) {
    if (!option) continue;
    for (const layer of LAYERS.layers.filter((l) => l.slot === slot && l.option === option && l.sex === look.sex)) {
      out.push({ layer, ...(layer.material && layer.material !== "metal" && tones ? { tones } : {}) });
    }
  }
  return out.sort((a, b) => a.layer.z - b.layer.z);
}

const BASE = `${import.meta.env.BASE_URL ?? "./"}sprites/sovereign-pact/scions/`;
const images = new Map<string, Promise<HTMLImageElement>>();
function image(file: string): Promise<HTMLImageElement> {
  let p = images.get(file);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = reject;
      im.src = `${BASE}${file}.webp`;
    });
    images.set(file, p);
  }
  return p;
}

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};

/** A piece drawn on its own canvas, its base palette's colors swapped for `tones`. */
const recolored = new Map<string, Promise<HTMLCanvasElement | HTMLImageElement>>();
function pieceImage(piece: Piece): Promise<HTMLCanvasElement | HTMLImageElement> {
  const { layer, tones } = piece;
  if (!tones) return image(layer.file);
  const key = `${layer.file}|${tones.join()}`;
  let p = recolored.get(key);
  if (!p) {
    p = image(layer.file).then((im) => {
      const c = document.createElement("canvas");
      c.width = im.width;
      c.height = im.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(im, 0, 0);
      const pal = (LAYERS.palettes as Record<string, { base: string; colors: Record<string, string[]> }>)[layer.material!];
      const from = pal?.colors[pal.base];
      if (!from) return c;
      const map = new Map(from.map((h, i) => [rgb(h).join(), rgb(tones[i] ?? tones.at(-1)!)]));
      const data = ctx.getImageData(0, 0, c.width, c.height);
      const d = data.data;
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        const to = map.get(`${d[i]},${d[i + 1]},${d[i + 2]}`);
        if (to) [d[i], d[i + 1], d[i + 2]] = to;
      }
      ctx.putImageData(data, 0, 0);
      return c;
    });
    recolored.set(key, p);
  }
  return p;
}

/** Canvas is missing under jsdom (the tests); there the sprites are simply not drawn. */
const canDraw = typeof document !== "undefined" && typeof navigator !== "undefined" && !/jsdom/i.test(navigator.userAgent);

/** RGBA pixels, as ImageData holds them. */
export interface Pixels {
  data: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
}

/** A layer's pixels, read back from a canvas. */
function pixels(im: HTMLCanvasElement | HTMLImageElement): ImageData {
  const c = document.createElement("canvas");
  c.width = im.width;
  c.height = im.height;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(im, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

/**
 * Hair (or a beard) worn under headwear, frame by frame: what lies inside the headwear's outline stays
 * (the hat covers it, and it shows through a hood's opening), as does what falls below it; whatever would
 * poke out above or beside it is cut away.
 */
export function underHat(hair: Pixels, hat: Pixels, cell = CELL): Pixels {
  const out = { data: new Uint8ClampedArray(hair.data), width: hair.width, height: hair.height };
  const w = hair.width;
  const opaque = (d: Pixels, x: number, y: number) => d.data[(y * w + x) * 4 + 3]! > 0;
  for (let cy = 0; cy + cell <= hair.height; cy += cell) {
    for (let cx = 0; cx + cell <= w; cx += cell) {
      // Each row's leftmost and rightmost headwear pixel, and the lowest row it reaches.
      const left: number[] = [];
      const right: number[] = [];
      let top = -1;
      let bottom = -1;
      for (let y = 0; y < cell; y++) {
        for (let x = 0; x < cell; x++) {
          if (!opaque(hat, cx + x, cy + y)) continue;
          left[y] = Math.min(left[y] ?? x, x);
          right[y] = Math.max(right[y] ?? x, x);
          if (top < 0) top = y;
          bottom = y;
        }
      }
      if (top < 0) continue;
      for (let y = 0; y <= bottom; y++) {
        for (let x = 0; x < cell; x++) {
          const inside = y >= top && left[y] !== undefined && x >= left[y]! && x <= right[y]!;
          if (!inside) out.data[((cy + y) * w + cx + x) * 4 + 3] = 0;
        }
      }
    }
  }
  return out;
}

const sheets = new Map<string, Promise<string>>();
/** The Scion's whole sheet, stacked from its pieces, as an image URL. */
export function sheetOf(look: ScionLook): Promise<string> {
  const key = JSON.stringify(look);
  let p = sheets.get(key);
  if (!p) {
    const pieces = piecesOf(look);
    p = Promise.all(pieces.map(pieceImage)).then((ims) => {
      const c = document.createElement("canvas");
      c.width = CELL * COLS;
      c.height = CELL * LAYERS.rows.length;
      const ctx = c.getContext("2d")!;
      // Every headwear layer together makes the outline the hair is cut to.
      const hats = ims.filter((_, i) => pieces[i]!.layer.slot === "hat");
      let hat: Pixels | null = null;
      if (hats.length) {
        const h = document.createElement("canvas");
        h.width = c.width;
        h.height = c.height;
        const hctx = h.getContext("2d")!;
        for (const im of hats) hctx.drawImage(im, 0, 0);
        hat = hctx.getImageData(0, 0, h.width, h.height);
      }
      for (const [i, im] of ims.entries()) {
        const slot = pieces[i]!.layer.slot;
        if (hat && (slot === "hair" || slot === "beard")) {
          const layer = document.createElement("canvas");
          layer.width = im.width;
          layer.height = im.height;
          const cut = underHat(pixels(im), hat);
          layer.getContext("2d")!.putImageData(new ImageData(cut.data, cut.width, cut.height), 0, 0);
          ctx.drawImage(layer, 0, 0);
        } else ctx.drawImage(im, 0, 0);
      }
      return c.toDataURL("image/png");
    });
    sheets.set(key, p);
  }
  return p;
}

export function useSheet(look: ScionLook | null): string | null {
  const key = look ? JSON.stringify(look) : "";
  const [url, setUrl] = useState<{ key: string; url: string } | null>(null);
  useEffect(() => {
    if (!look || !canDraw) return;
    let live = true;
    sheetOf(look).then(
      (u) => live && setUrl({ key, url: u }),
      () => {},
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return url && url.key === key ? url.url : null;
}

/**
 * One row of a Scion's sheet, `size` CSS pixels per 64 px frame. `crop` shows only part of the frame
 * (x, y, w, h in the frame's own pixels): the head on a chit. A row with several frames plays them in a
 * loop (`loop`) or once, holding the last (`hold`).
 */
export default function ScionSprite(props: { look: ScionLook; anim?: Anim; size?: number | "fit"; crop?: [number, number, number, number]; className?: string; play?: "loop" | "hold"; frame?: number }) {
  if (props.size === "fit") return <Fitted {...props} />;
  return <Frame {...props} size={props.size ?? 64} />;
}

/** A sprite as tall as its box allows (a battle cell). */
function Fitted(props: Parameters<typeof ScionSprite>[0]) {
  const [box, setBox] = useState<HTMLSpanElement | null>(null);
  const [h, setH] = useState(0);
  useEffect(() => {
    if (!box || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([e]) => setH(Math.floor(e!.contentRect.height)));
    ro.observe(box);
    return () => ro.disconnect();
  }, [box]);
  return (
    <span ref={setBox} className={`sp-scion-fit${props.className ? ` ${props.className}` : ""}`}>
      {h > 0 ? <Frame {...props} className={undefined} size={h * (64 / (props.crop?.[3] ?? 64))} /> : null}
    </span>
  );
}

function Frame({ look, anim = "portrait", size, crop, className, play = "loop", frame }: Omit<Parameters<typeof ScionSprite>[0], "size"> & { size: number }) {
  const url = useSheet(look);
  const [x, y, w, h] = crop ?? [0, 0, 64, 64];
  const k = size / 64;
  const frames = frame === undefined ? FRAMES[anim] : 1;
  const first = START[anim] ?? 0;
  const col = frame ?? first;
  const style: CSSProperties = {
    width: w * k,
    height: h * k,
    backgroundImage: url ? `url(${url})` : undefined,
    backgroundSize: `${CELL * COLS * k}px ${CELL * LAYERS.rows.length * k}px`,
    backgroundPosition: `${-(col * CELL + 32 + x) * k}px ${-(ROW[anim] * CELL + 32 + y) * k}px`,
    ...(frames > 1
      ? {
          ["--sp-from" as string]: `${-(first * CELL + 32 + x) * k}px`,
          // A loop steps past the last frame and wraps; a held swing stops on its last frame. The chant
          // sways: it plays to its last frame and back.
          ["--sp-to" as string]: `${-((first + (play === "loop" && anim !== "chant" ? frames : frames - 1)) * CELL + 32 + x) * k}px`,
          ["--sp-y" as string]: `${-(ROW[anim] * CELL + 32 + y) * k}px`,
          animation: `sp-scion ${frames * (FRAME_MS[anim] ?? 110)}ms ${
            anim === "chant" ? `steps(${frames}, jump-none) infinite alternate` : play === "loop" ? `steps(${frames}) infinite` : `steps(${frames}, jump-none) 1 forwards`
          }`,
        }
      : {}),
  };
  return <span className={`sp-scion${className ? ` ${className}` : ""}`} style={style} aria-hidden="true" />;
}
