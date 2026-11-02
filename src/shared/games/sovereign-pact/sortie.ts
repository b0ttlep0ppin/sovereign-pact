// Sorties (§6.11): a House's Scions not on the expedition, up to four, go on one short foray a Year,
// chosen from content/sorties.json. It is fought by gambits in 1–2 battles a level under the Year's
// band, injuries no worse than Moderate, and pays about a quarter of an expedition: XP per battle won,
// JP if they come through, and the pool's finds to the House. It resolves as the expedition comes home.
import { tally } from "./hunt.ts";
import { ARC } from "./arc.ts";
import { INJURY_BY_ID, POOL_BY_ID, SORTIE_BY_ID, type SortieDef } from "./content.ts";
import { encounterBattle } from "./combat/encounter.ts";
import { recorded } from "./combat/replay.ts";
import type { Battle } from "./combat/types.ts";
import { holders, slots } from "./assign.ts";
import { roster } from "./expedition.ts";
import { band } from "./gate.ts";
import { die, partyOf, person } from "./journey.ts";
import { gainJp, gainXp } from "./progression.ts";
import type { SovState, Stores } from "./state.ts";
import { TUNING } from "./tuning.ts";
import { log, withRng } from "./year.ts";

const T = TUNING.sortie;

/** Who goes on `house`'s Sortie this Year: its holders still able and not on the expedition, up to the slots. */
export function sortieParty(s: SovState, house: number): number[] {
  const away = new Set(s.expedition ? roster(s) : []);
  return holders(s, house, "sortie")
    .filter((p) => (p.status === "scion" || p.status === "retired") && !away.has(p.id))
    .slice(0, slots(s, house, "sortie"))
    .map((p) => p.id);
}

/** Every House's Sortie, in House order. */
export function runSorties(s: SovState): void {
  s.houses.forEach((_, h) => {
    const ids = sortieParty(s, h);
    if (ids.length) sortie(s, h, SORTIE_BY_ID.get(s.assign[ids[0]!]!.at!)!, ids);
  });
}

function sortie(s: SovState, house: number, def: SortieDef, ids: number[]): void {
  const H = s.houses[house]!;
  const level = Math.max(1, band(s.year)[0] - T.levelBelow);
  log(s, `House ${H.name} sends ${ids.length} on a Sortie: ${def.name}.`);
  let won = 0;
  for (let n = 0; n < def.battles; n++) {
    const left = ids.filter((id) => s.people.some((p) => p.id === id));
    if (!left.length) break;
    const seed = withRng(s, (rng) => rng.int(2 ** 31));
    const b = encounterBattle(seed, partyOf(s, left), { pool: def.pool, level, year: s.year, spread: s.flags.includes(ARC.nestLost) }).battle;
    b.injuryCap = T.injuryCap;
    (s.battles ??= []).push(recorded(b, `House ${H.name}'s Sortie: ${def.name}`).replay);
    const victory = b.outcome === "victory";
    settle(s, b, def, victory);
    if (!victory) {
      log(s, `The Sortie is driven back; House ${H.name}'s Scions limp home.`);
      break;
    }
    won += 1;
    finds(s, house, def, level);
  }
  for (const id of ids) {
    const p = s.people.find((x) => x.id === id);
    if (p) p.hist.sorties = (p.hist.sorties ?? 0) + 1;
  }
  if (won < def.battles) return;
  for (const id of ids) {
    const i = s.people.findIndex((x) => x.id === id);
    if (i >= 0) s.people[i] = gainJp(s.people[i]!, def.jp);
  }
  if (def.gold) H.gold += def.gold;
  for (const [k, v] of Object.entries(def.score ?? {})) H.score[k as keyof typeof H.score] += v!;
  log(s, `The Sortie comes home: ${def.name}, done.`);
}

/** What a Sortie battle leaves: injuries last, the dead die, Sanity and MP carry; a win pays XP. */
function settle(s: SovState, b: Battle, def: SortieDef, won: boolean): void {
  tally(s, b, [...new Set(b.units.flatMap((u) => (u.side === "party" && u.person !== undefined && u.owner === undefined ? [person(s, u.person).host] : [])))]);
  for (const u of b.units) {
    if (u.side !== "party" || u.person === undefined || u.owner !== undefined) continue;
    let p = person(s, u.person);
    for (const ev of b.events) {
      if (ev.t !== "injury" || ev.target !== u.id) continue;
      const res = INJURY_BY_ID.get(ev.result);
      if (res?.lasting) p.injuries.push({ id: res.id, years: res.lasting.years });
    }
    if (u.dead) {
      die(s, p, `${def.id}_sortie`);
      continue;
    }
    p.sanity = u.sanity;
    p.mp = u.mp;
    if (won) p = gainXp(p, def.xp);
    s.people[s.people.findIndex((x) => x.id === p.id)] = p;
  }
}

/** A won battle's rolls on the pool's drop table go straight to the House. */
function finds(s: SovState, house: number, def: SortieDef, level: number): void {
  if (!def.rolls) return;
  const drops = POOL_BY_ID.get(def.pool)!.drops;
  const got: Stores = {};
  withRng(s, (rng) => {
    for (let i = 0; i < def.rolls; i++) {
      for (const [id, pct] of drops.materials) if (rng.int(100) < pct) got[id] = (got[id] ?? 0) + 1 + Math.floor(level / TUNING.loot.qtyDiv.common);
      if (rng.int(100) < drops.essencePct) got.essence = (got.essence ?? 0) + 1;
    }
  });
  const st = s.houses[house]!.stores;
  for (const [k, n] of Object.entries(got)) st[k] = (st[k] ?? 0) + n!;
}
