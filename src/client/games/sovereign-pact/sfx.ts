// The battle's sound (SPEC §16.1): each turn of a replay plays a few cues, cut by tools/cut-sfx.py from
// the BOOM libraries into public/sfx/sovereign-pact/<cue>-<take>.ogg. What a turn sounds like follows
// from its events: the blow's weapon or the spell's element, the creature that bites, who falls.
import { Content, type Replay, type ReplayUnit } from "@vibepulse/shared/games/sovereign-pact";

type Event = Replay["frames"][number]["ev"][number];

/** A cue to play, `at` ms after the turn is shown. */
export interface Sound {
  cue: string;
  at: number;
}

/** A weapon's swing (none for a creature's own body) and the sound of it landing. */
const WEAPONS: Record<string, [swing: string, hit: string]> = {
  sword: ["swing_blade", "hit_blade"],
  axe: ["swing_heavy", "hit_axe"],
  mace: ["swing_blunt", "hit_blunt"],
  staff: ["swing_blunt", "hit_blunt"],
  instrument: ["swing_blunt", "hit_blunt"],
  spear: ["swing_light", "hit_stab"],
  knife: ["swing_light", "hit_stab"],
  thrown: ["swing_light", "hit_stab"],
  knuckles: ["swing_fist", "hit_punch"],
  unarmed: ["swing_fist", "hit_punch"],
  bow: ["shot_bow", "hit_arrow"],
  crossbow: ["shot_crossbow", "hit_bolt"],
};

/**
 * What a landed weapon blow does to the body after the steel's own sound (Josh 2026-11-10: "a second
 * sound afterwards if you hit, which is crunchy or impactful"): blades and points split flesh, arrows
 * and bolts sink in, axes and maces break bone, fists thump. Plate and stone ring instead, a spirit has
 * nothing to break, and the dead's bones crack under any weapon.
 */
const CRUNCH: Record<string, string> = {
  sword: "crunch_flesh",
  knife: "crunch_flesh",
  spear: "crunch_flesh",
  thrown: "crunch_flesh",
  bow: "crunch_pierce",
  crossbow: "crunch_pierce",
  axe: "crunch_bone",
  mace: "crunch_bone",
  staff: "crunch_bone",
  instrument: "crunch_body",
  knuckles: "crunch_body",
  unarmed: "crunch_body",
};

/** The crunch of `by`'s weapon landing on `on`; none for a creature's own blows or a body with nothing to break. */
export function crunchOf(by: ReplayUnit | undefined, on: ReplayUnit | undefined): string | null {
  if (!by?.weapon) return null;
  const tags = on ? tagsOf(on) : [];
  if (tags.includes("spirit")) return null;
  if (tags.some((t) => t === "armored" || t === "construct")) return "crunch_plate";
  if (tags.includes("undead")) return "crunch_bone";
  return CRUNCH[by.weapon] ?? "crunch_flesh";
}

/** What a creature's blow sounds like, by its first tag that says (§16.1: monster sounds by tag). */
const BY_TAG: [tags: string[], hit: string][] = [
  [["beast", "dragon", "dragonkin", "insect", "aquatic", "slime", "flesh", "fungus", "plant"], "hit_bite"],
  [["construct", "armored", "elemental", "giant"], "hit_heavy"],
  [["undead", "spirit", "demon", "cursed", "unknown", "fey", "faceless", "divine"], "hit_claw"],
];

const TAGS: ReadonlyMap<string, readonly string[]> = new Map([
  ...[...Content.ENEMIES, ...Content.BOSSES].map((e) => [e.id, e.tags] as const),
  ...[...Content.SUMMON_BY_ID.values()].map((s) => [s.id, s.tags] as const),
]);

/** Each ability's kind and element, from the Jobs' tables and the creatures' own. */
type Kind = { kind?: string; element?: string | null };
const ABILITIES: ReadonlyMap<string, Kind> = new Map<string, Kind>([
  ...[...Content.ENEMIES, ...Content.BOSSES].flatMap((e) => e.abilities.map((a): [string, Kind] => [a.id, a])),
  ...Content.ABILITY_SETS.flatMap((set) => set.actives.map((a): [string, Kind] => [a.id, a])),
]);

/** An ability's kind and element ("attack" is a plain blow), for the log's damage icons. */
export const abilityKind = (id: string): Kind => (id === "attack" ? { kind: "physical" } : ABILITIES.get(id) ?? {});

/** Injury results that end or maim (§11.2's Devastating band) get the Death Whistle's scream. */
const DREADFUL = new Set(Content.INJURY_TABLES.flatMap((t) => t.results.filter((r) => r.band === "devastating" || r.death).map((r) => r.id)));

function tagsOf(u: ReplayUnit): readonly string[] {
  const id = u.enemy ?? u.summon ?? "";
  return TAGS.get(id) ?? [...TAGS].find(([k]) => id.startsWith(`${k}_`))?.[1] ?? [];
}

/** The swing and the landing of `u`'s plain blows. */
export function blowOf(u: ReplayUnit | undefined): [swing: string | null, hit: string] {
  if (!u) return [null, "hit_blade"];
  if (u.weapon) return WEAPONS[u.weapon] ?? ["swing_blade", "hit_blade"];
  const tags = tagsOf(u);
  const hit = BY_TAG.find(([t]) => t.some((x) => tags.includes(x)))?.[1] ?? "hit_blade";
  // A big biter mauls.
  return [null, hit === "hit_bite" && u.size[0] * u.size[1] >= 4 ? "hit_maul" : hit];
}

/** The cues a turn's events play, in order, at most ten. */
export function soundsOf(ev: readonly Event[], units: ReadonlyMap<number, ReplayUnit>): Sound[] {
  const out: Sound[] = [];
  const add = (cue: string, at: number) => {
    if (out.length < 10 && !out.some((s) => s.cue === cue && Math.abs(s.at - at) < 60)) out.push({ cue, at });
  };
  const use = ev.find((e) => e.t === "use");
  const by = use ? units.get(use.unit) : undefined;
  const ab = use ? ABILITIES.get(use.ability) : undefined;
  const kind = use?.ability === "attack" ? "physical" : ab?.kind ?? "physical";
  const hits = ev.filter((e) => e.t === "hit");
  const element = hits.find((h) => h.element)?.element ?? ab?.element ?? null;
  const spell = kind === "magic" || (element && kind !== "physical");
  const [swing, blow] = blowOf(by);
  if (use) {
    if (spell) add(`cast_${element ?? "arcane"}`, 0);
    else if (kind === "heal") add("heal", 0);
    else if (kind === "support" && !hits.length) add(use.target.side === by?.side ? "buff" : "debuff", 0);
    else if (swing) add(swing, 0);
  }
  hits.slice(0, 3).forEach((h, i) => {
    // A spell lands once it has risen beside its caster and crossed the field (BattleFx's IMPACT_MS).
    const at = (spell ? 860 : 170) + i * 90;
    const struck = units.get(h.target);
    if (spell) add(`impact_${h.element ?? element ?? "arcane"}`, at);
    else if (by?.weapon && h.unit === by.id) {
      // A Scion's blow: the steel, then the body giving way, then a magic weapon's element bursting.
      add(blow, at);
      const crunch = crunchOf(by, struck);
      if (crunch) add(crunch, at + 60);
      const charm = h.element ?? h.edge;
      if (charm) add(`impact_${charm}`, at + 110);
    } else add(h.element ? `impact_${h.element}` : blow, at);
    if (h.crit) add("crit", at + 30);
  });
  for (const e of ev) {
    if (e.t === "miss") add("miss", 170);
    else if (e.t === "heal" && kind !== "heal" && !e.quiet) add("heal", 200);
    else if (e.t === "defend") add("defend", 0);
    else if (e.t === "summon") add("summon", 100);
    else if (e.t === "vanish" || e.t === "flee") add("vanish", 200);
    else if (e.t === "charge" && e.telegraph) add("charge", 0);
    else if (e.t === "phase") add("phase", 0);
    else if (e.t === "sanity" && e.amount < 0) add("sanity", 320);
    else if (e.t === "down" || e.t === "dead") add("fall", 560);
    else if (e.t === "injury") add(injuryCue(e.result), 680);
    else if (e.t === "lots" || e.t === "fizzle") add("dice", 0);
  }
  return out.sort((a, b) => a.at - b.at);
}

/** The sound of an injury landing: a scream for a devastating one, a crack for the rest. */
export const injuryCue = (result: string): string => (DREADFUL.has(result) ? "dread" : "injury");

export const sfxUrl = (cue: string, take: number): string => `${import.meta.env.BASE_URL ?? "./"}sfx/sovereign-pact/${cue}-${take}.ogg`;

/** Test runners and browsers without media playback get no sound. */
export const canPlay = (): boolean => typeof Audio !== "undefined" && !globalThis.navigator?.userAgent?.includes("jsdom");

/** Plays a random take of `cue`, its pitch nudged ±5% so repeats differ (§16.1). */
export function playCue(cue: string, volume: number): void {
  const takes = Content.SFX_BY_ID.get(cue)?.takes ?? 1;
  const play = (take: number) => {
    const audio = new Audio(sfxUrl(cue, take));
    audio.volume = Math.min(1, volume);
    audio.preservesPitch = false;
    audio.playbackRate = 0.95 + Math.random() * 0.1;
    // A build that ships only each cue's first take (the playable artifact) falls back to it, so a
    // miss or a monster's blow is never silent (Josh: "need miss sound effects", "when enemies hit us").
    if (take > 1) audio.addEventListener("error", () => play(1), { once: true });
    audio.play().catch(() => undefined);
  };
  play(1 + Math.floor(Math.random() * takes));
}

/** Plays the turn's sounds, each at its time. Returns a cancel. */
export function playSounds(sounds: readonly Sound[], volume: number, speed = 1): () => void {
  if (!canPlay() || volume <= 0) return () => undefined;
  const timers = sounds.map(({ cue, at }) => setTimeout(() => playCue(cue, volume), at / speed));
  return () => timers.forEach(clearTimeout);
}
