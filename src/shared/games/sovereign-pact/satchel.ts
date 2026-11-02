// The party satchel between nodes (§13.7): what is used at a Camp (Pilgrim's Bread, Widow's Tea, the
// Smuggler's Flask) and before a node (the Lantern, the Signal Flare). The satchel is the party's: any
// House with a Scion marching may open it, as any Scion may in battle. Battle items are used in battle
// (combat/items.ts).
import { CONSUMABLE_BY_ID } from "./content.ts";
import { divided } from "./split.ts";
import { marching, partyOf, person } from "./journey.ts";
import { LOCATIONS, type SovMove, type SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { log } from "./year.ts";

const B = TUNING.consumables.bots;
const W = TUNING.consumables.uses;

/** What a bot packs one of beyond battle things: what it opens on the road, and what works when carried. */
export const BOT_OPENS: readonly string[] = ["pilgrims_bread", "widows_tea", "smugglers_flask", "lantern", "signal_flare", "saints_tooth", "dice_of_the_marches"];

export type OpenMove = Extract<SovMove, { type: "use_item" }>;

const atCamp = (s: SovState): boolean => {
  const e = s.expedition!;
  return e.at > 0 && e.chain[e.at - 1] === "camp";
};
/** The Lost a Rescue card came for, still Lost. */
const rescuees = (s: SovState): number[] => (s.expedition!.card.type === "rescue" ? (s.expedition!.card.rescue ?? []).filter((id) => s.people.some((p) => p.id === id && p.status === "lost")) : []);
/** The marching Scion as a combatant, for their maxima. */
const unit = (s: SovState, id: number) => partyOf(s, [id], s.expedition!.carry)[0]!;

/** Why `house` cannot use `id` from the satchel now (on Scion `on`, where it takes one), or null. */
export function cannotOpen(s: SovState, house: number, move: { id: string; person?: number }): string | null {
  const e = s.expedition;
  if (s.phase !== "expedition" || e?.leader === undefined || e.result) return "No expedition is underway.";
  if (e.event) return "The party must decide what to do first.";
  const ids = marching(s);
  if (!ids.some((id) => person(s, id).host === house)) return "Only a House with a Scion marching opens the satchel.";
  if (!e.satchel?.some((x) => x.id === move.id)) return "The satchel holds none.";
  const def = CONSUMABLE_BY_ID.get(move.id)!;
  if (def.use === "camp" && !atCamp(s)) return "That is used at a Camp.";
  if (def.use === "battle") return "That is used in battle.";
  if (def.use === "held" || def.use === "town") return "That is not opened on the road.";
  if (move.id === "lantern" && (e.at >= e.chain.length || e.lit === e.at)) return e.at >= e.chain.length ? "There is no node ahead." : "The way ahead is already lit.";
  if (move.id === "signal_flare" && !rescuees(s).length) return "There is no one Lost here to signal.";
  if (move.id === "signal_flare" && move.person !== undefined && !rescuees(s).includes(move.person)) return "That Scion is not Lost here.";
  const one = move.id === "widows_tea" || move.id === "smugglers_flask";
  if (one && (move.person === undefined || !ids.includes(move.person))) return "Name a marching Scion.";
  if (def.use !== "camp" && def.use !== "node") return "That is not opened on the road.";
  return null;
}

/** Uses one `id` from the satchel. */
export function open(s: SovState, move: { id: string; person?: number }): void {
  const e = s.expedition!;
  e.satchel!.splice(e.satchel!.findIndex((x) => x.id === move.id), 1);
  const def = CONSUMABLE_BY_ID.get(move.id)!;
  const pctOf = (max: number, n: number) => Math.round((max * n) / 100);
  if (move.id === "pilgrims_bread") {
    // HP is whole at every battle's start; the bread restores what the road wears down that a Camp does not: MP.
    for (const id of marching(s)) person(s, id).mp = unit(s, id).maxMp;
    log(s, "The party breaks Pilgrim's Bread; every Scion's strength returns.");
  } else if (move.id === "widows_tea" || move.id === "smugglers_flask") {
    const p = person(s, move.person!);
    const u = unit(s, p.id);
    const c = (e.carry[p.id] ??= { dur: {}, broken: [] });
    if (move.id === "widows_tea") {
      p.sanity = Math.min(u.maxSanity, p.sanity + pctOf(u.maxSanity, W.teaSanityPct));
      c.start = [...(c.start ?? []).filter((x) => x !== "sleep"), `sleep:${W.teaSleepTicks}`];
    } else {
      // Rested: every location whole for the next battle.
      c.dur = Object.fromEntries(LOCATIONS.map((l) => [l, u.maxDur?.[l] ?? 0]));
      c.broken = [];
      p.sanity = Math.max(0, p.sanity - pctOf(u.maxSanity, W.flaskSanityPct));
    }
    log(s, `${p.name} takes ${def.name}.`);
  } else if (move.id === "lantern") {
    e.lit = e.at;
    log(s, "A Lantern is lit against the dark ahead.");
  } else if (move.id === "signal_flare") {
    const id = move.person ?? rescuees(s)[0]!;
    const p = person(s, id);
    p.status = "scion";
    delete p.lost;
    (e.party[p.host] ??= []).push(id);
    if (divided(e)) e.split!.teams[e.split!.turn].push(id);
    log(s, `A Signal Flare climbs the sky, and ${p.name} of House ${s.houses[p.house]!.name} finds the party.`);
  }
}

/** A bot House's use of the satchel before it presses on, or null. */
export function botOpen(s: SovState, house: number): OpenMove | null {
  const e = s.expedition!;
  const try1 = (m: OpenMove): OpenMove | null => (cannotOpen(s, house, m) ? null : m);
  const ids = marching(s);
  if (atCamp(s)) {
    // Each Scion's lowest share of MP, Sanity, or a location's Durability; the lowest Scion first.
    const share = (id: number, of: "mp" | "sanity" | "dur"): number => {
      const u = unit(s, id);
      const p = person(s, id);
      if (of === "mp") return u.maxMp ? p.mp / u.maxMp : 1;
      if (of === "sanity") return u.maxSanity ? p.sanity / u.maxSanity : 1;
      return Math.min(1, ...LOCATIONS.map((l) => (u.maxDur?.[l] ? (u.dur?.[l] ?? 0) / u.maxDur[l] : 1)));
    };
    const low = (of: "mp" | "sanity" | "dur") => [...ids].sort((a, b) => share(a, of) - share(b, of) || a - b).find((id) => share(id, of) < B.campBelow);
    const plans: (OpenMove | null)[] = [
      low("mp") !== undefined ? { type: "use_item", id: "pilgrims_bread" } : null,
      low("sanity") !== undefined ? { type: "use_item", id: "widows_tea", person: low("sanity")! } : null,
      low("dur") !== undefined ? { type: "use_item", id: "smugglers_flask", person: low("dur")! } : null,
    ];
    for (const m of plans) if (m && try1(m)) return m;
  }
  if (["encounter", "raid", "lair"].includes(e.chain[e.at] ?? "")) {
    const m = try1({ type: "use_item", id: "lantern" });
    if (m) return m;
  }
  return try1({ type: "use_item", id: "signal_flare" });
}
