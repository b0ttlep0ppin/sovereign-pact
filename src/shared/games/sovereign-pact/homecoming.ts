// The homecoming (Josh's playtest, 2026-11-02): when the party is home, an account of what the
// expedition did to each Scion who went (levels, XP, JP, injuries, the fallen and the Lost) and what
// each House took from the haul. It is public: the log already tells all of it.
import type { Person, SovState } from "./state.ts";
import { TUNING } from "./tuning.ts";

const totalXp = (p: Person) => p.level * TUNING.progression.xpPerLevel + p.xp;
const totalJp = (p: Person) => Object.values(p.jp).reduce((n, x) => n + (x ?? 0), 0);

/** At departure: each Scion of the party as they set out. */
export function setOut(s: SovState, ids: number[]): void {
  const e = s.expedition!;
  e.start = Object.fromEntries(
    s.people.filter((p) => ids.includes(p.id)).map((p) => [p.id, { name: p.name, house: p.host, xp: totalXp(p), jp: totalJp(p), level: p.level, injuries: p.injuries.map((i) => i.id) }]),
  );
}

/** A share of the haul a House took, for the account. */
export function claimed(s: SovState, house: number, text: string): void {
  const e = s.expedition;
  if (e) (e.claims ??= []).push({ house, text });
}

/** The ids in `now` not in `then`, counting repeats. */
function added(then: string[], now: string[]): string[] {
  const left = [...then];
  return now.filter((id) => {
    const i = left.indexOf(id);
    if (i < 0) return true;
    left.splice(i, 1);
    return false;
  });
}

/** The party is home: the account replaces the last one. An expedition that never left has none. */
export function comeHome(s: SovState): void {
  const e = s.expedition;
  if (!e?.start || !e.result) return;
  const people = Object.entries(e.start).map(([key, was]) => {
    const id = Number(key);
    const p = s.people.find((x) => x.id === id);
    if (!p) return { id, name: was.name, house: was.house, levelFrom: was.level, levelTo: was.level, xp: 0, jp: 0, injuries: [], fate: "fell" as const };
    return {
      id,
      name: p.name,
      house: p.host,
      levelFrom: was.level,
      levelTo: p.level,
      xp: totalXp(p) - was.xp,
      jp: totalJp(p) - was.jp,
      injuries: added(was.injuries, p.injuries.map((i) => i.id)),
      ...(p.status === "lost" ? { fate: "lost" as const } : {}),
    };
  });
  s.homecoming = { year: s.year, card: e.card, result: e.result, people, claims: e.claims ?? [] };
}
