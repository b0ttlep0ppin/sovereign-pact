// The content catalog: everything under content/ as typed data. Rules read content only through here,
// by id, so Josh can edit the JSON (validated by schemas/ in CI) without touching rules (CLAUDE.md).
import heraldryJson from "./content/heraldry.json" with { type: "json" };
import namesJson from "./content/names.json" with { type: "json" };
import seatsJson from "./content/seats.json" with { type: "json" };
import tarotJson from "./content/tarot.json" with { type: "json" };

export interface TarotCard {
  id: string;
  number: number;
  name: string;
  crunch: string;
}

export interface SeatStyle {
  id: string;
  name: string;
  flavor: string;
}

export interface Swatch {
  id: string;
  name: string;
  hex: string;
}

export interface Heraldry {
  palette: readonly Swatch[];
  shields: readonly string[];
  divisions: readonly string[];
  metals: readonly string[];
  charges: readonly string[];
}

export interface Names {
  given: { f: readonly string[]; m: readonly string[] };
  houses: readonly string[];
  mottos: readonly string[];
}

export const TAROT: readonly TarotCard[] = tarotJson.cards;
export const SEATS: readonly SeatStyle[] = seatsJson.seats;
export const HERALDRY: Heraldry = heraldryJson;
export const NAMES: Names = namesJson;

const byId = <T extends { id: string }>(items: readonly T[]): ReadonlyMap<string, T> => new Map(items.map((item) => [item.id, item]));

export const TAROT_BY_ID = byId(TAROT);
export const SEAT_BY_ID = byId(SEATS);
export const SWATCH_BY_ID = byId(HERALDRY.palette);
