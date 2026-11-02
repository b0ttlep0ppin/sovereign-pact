// The game's recorded music (SPEC §16.2): eighteen Pixabay tracks, encoded by tools/encode-music.sh into
// public/music/sovereign-pact/, and which one each screen plays. The rules never know about music: the
// track follows from the view and from the battle being watched.
import type { Replay, SovView } from "@vibepulse/shared/games/sovereign-pact";

export interface TrackInfo {
  title: string;
  author: string;
  /** The author's Pixabay handle, for the credit line. */
  handle: string;
}

export const TRACKS = {
  kingsfall: { title: "Kingsfall", author: "Alexander Nakarada", handle: "nakaradaalexander" },
  "the-faded-rose": { title: "The Faded Rose", author: "Ob-Lix", handle: "ob-lix" },
  "celtic-medieval": { title: "Irish Celtic Medieval Music", author: "HitsLab", handle: "hitslab" },
  "night-market": { title: "Night Market in Old Town", author: "kang_saif", handle: "kang_saif" },
  "shadows-beneath-the-keep": { title: "Shadows Beneath the Keep", author: "MenielDM", handle: "menieldm" },
  "winter-sky": { title: "Winter Sky", author: "nojisuma", handle: "nojisuma" },
  "on-the-way-home": { title: "On the Way Home", author: "nojisuma", handle: "nojisuma" },
  "dark-fantasy-lofi": { title: "BGM006 Dark Fantasy Lo-fi", author: "welc0me.i0", handle: "welc0mei0" },
  "dark-fantasy-ambient": { title: "Dark Fantasy Ambient", author: "lux_aeterna_2026", handle: "lux_aeterna_2026" },
  "light-blocking": { title: "Light Blocking", author: "nojisuma", handle: "nojisuma" },
  "anime-battle": { title: "Anime Battle Music", author: "PhatPhrogStudio", handle: "phatphrogstudio" },
  "crimson-horizon": { title: "Crimson Horizon", author: "mroneilovealot", handle: "mroneilovealot" },
  "dark-epic": { title: "Dark Epic", author: "nastelbom", handle: "nastelbom" },
  "cursed-oni": { title: "Samurai Spirit: Cursed Oni", author: "PhatPhrogStudio", handle: "phatphrogstudio" },
  "boss-battle": { title: "Japanese Gaming Boss Battle Music", author: "OpenMindAudio", handle: "openmindaudio" },
  "the-spell": { title: "The Spell", author: "Ob-Lix", handle: "ob-lix" },
  "dark-fantasy-music": { title: "Dark Fantasy Music", author: "Lux Aeterna", handle: "lux-aeterna" },
  "lost-city-of-atlantis": { title: "The Lost City of Atlantis", author: "OneCinematicStudio", handle: "onecinematicstudio" },
} as const satisfies Record<string, TrackInfo>;

export type TrackId = keyof typeof TRACKS;

/** The six Settlement themes, one a House (§16.2). Reading: until a House picks at creation, its seat picks. */
export const SETTLEMENT_THEMES: TrackId[] = ["celtic-medieval", "night-market", "shadows-beneath-the-keep", "winter-sky", "on-the-way-home", "dark-fantasy-lofi"];

/** Normal battles by pool: beasts and courts, the Pit and the Outer Dark, undead and horror (§16.2). */
const BATTLE_BY_POOL: Record<string, TrackId> = {
  beast_lands: "anime-battle",
  hollow_wood: "anime-battle",
  apostate_court: "anime-battle",
  shrine_of_six: "anime-battle",
  dragon_reaches: "anime-battle",
  pit: "crimson-horizon",
  outer_dark: "crimson-horizon",
  forge_ruins: "crimson-horizon",
  deep_cold: "crimson-horizon",
  barrows: "dark-epic",
  drowned_marches: "dark-epic",
  faceless_city: "dark-epic",
};

/** The mandatory arc's bosses have their own themes; the End Ruler the last one. */
const ARC_BOSSES: Record<string, TrackId> = { siege_beast: "the-spell", cursed_king: "the-spell", unknown_mother: "the-spell", end_ruler: "dark-fantasy-music" };

/** The track for a battle being watched or fought. */
export function battleTrack(r: Pick<Replay, "title" | "pool" | "units">): TrackId {
  const boss = r.units.find((u) => u.boss && u.side === "enemy");
  const arc = boss?.enemy && Object.keys(ARC_BOSSES).find((id) => boss.enemy === id || boss.enemy!.startsWith(`${id}_`));
  if (arc) return ARC_BOSSES[arc]!;
  // An Arcana is fought as an elite, like a Hunt's quarry (§14.9).
  if (boss?.enemy?.startsWith("arcana_") || r.title === "The quarry's lair") return "cursed-oni";
  if (boss) return "boss-battle";
  return BATTLE_BY_POOL[r.pool ?? ""] ?? "anime-battle";
}

/** The track for what the view shows, when no battle is on screen. */
export function sceneTrack(view: SovView): TrackId {
  if (view.phase === "founding") return "the-faded-rose";
  if (view.phase === "over") return view.outcome?.won ? "kingsfall" : "dark-fantasy-ambient";
  const e = view.expedition;
  if (view.phase === "expedition" && e) {
    if (e.fight) return battleTrack(e.fight.replay);
    if (e.event) return "light-blocking";
    if (e.result || e.draft?.length) return "lost-city-of-atlantis";
    return "dark-fantasy-ambient";
  }
  return SETTLEMENT_THEMES[(view.me ?? 0) % SETTLEMENT_THEMES.length]!;
}

export const trackUrl = (id: TrackId): string => `${import.meta.env.BASE_URL ?? "./"}music/sovereign-pact/${id}.ogg`;

/** Every track's credit line (§17), in the form CREDITS.md gives. */
export const musicCredits = (): string[] =>
  Object.values(TRACKS).map((t) => `“${t.title}” by ${t.author} (pixabay.com/users/${t.handle}), used under the Pixabay Content License`);
