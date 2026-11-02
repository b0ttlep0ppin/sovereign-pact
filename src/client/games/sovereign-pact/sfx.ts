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

/** The cues a turn's events play, in order, at most six. */
export function soundsOf(ev: readonly Event[], units: ReadonlyMap<number, ReplayUnit>): Sound[] {
  const out: Sound[] = [];
  const add = (cue: string, at: number) => {
    if (out.length < 6 && !out.some((s) => s.cue === cue && Math.abs(s.at - at) < 60)) out.push({ cue, at });
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
    const at = (spell ? 380 : 170) + i * 90;
    add(h.element ? `impact_${h.element}` : spell ? `impact_${element ?? "arcane"}` : blow, at);
    if (h.crit) add("crit", at + 30);
  });
  for (const e of ev) {
    if (e.t === "miss") add("miss", 170);
    else if (e.t === "heal" && kind !== "heal") add("heal", 200);
    else if (e.t === "defend") add("defend", 0);
    else if (e.t === "summon") add("summon", 100);
    else if (e.t === "vanish" || e.t === "flee") add("vanish", 200);
    else if (e.t === "charge" && e.telegraph) add("charge", 0);
    else if (e.t === "phase") add("phase", 0);
    else if (e.t === "sanity" && e.amount < 0) add("sanity", 320);
    else if (e.t === "down" || e.t === "dead") add("fall", 560);
    else if (e.t === "injury") add(DREADFUL.has(e.result) ? "dread" : "injury", 680);
  }
  return out.sort((a, b) => a.at - b.at);
}

export const sfxUrl = (cue: string, take: number): string => `${import.meta.env.BASE_URL ?? "./"}sfx/sovereign-pact/${cue}-${take}.ogg`;

/** Test runners and browsers without media playback get no sound. */
const canPlay = (): boolean => typeof Audio !== "undefined" && !globalThis.navigator?.userAgent?.includes("jsdom");

/** Plays the turn's sounds: a random take of each cue, its pitch nudged ±5% so repeats differ (§16.1). Returns a cancel. */
export function playSounds(sounds: readonly Sound[], volume: number, speed = 1): () => void {
  if (!canPlay() || volume <= 0) return () => undefined;
  const timers = sounds.map(({ cue, at }) =>
    setTimeout(() => {
      const takes = Content.SFX_BY_ID.get(cue)?.takes ?? 1;
      const audio = new Audio(sfxUrl(cue, 1 + Math.floor(Math.random() * takes)));
      audio.volume = volume;
      audio.preservesPitch = false;
      audio.playbackRate = 0.95 + Math.random() * 0.1;
      audio.play().catch(() => undefined);
    }, at / speed),
  );
  return () => timers.forEach(clearTimeout);
}
