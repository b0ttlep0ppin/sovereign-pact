// Camp banter (Josh's playtest, 2026-11-02): at a Camp the party sits at a fire and talks. A scene from
// content/banter.json is drawn whose conditions fit who is there and how the road has gone, its speakers
// drawn from the Scions still marching, and its lines kept on the expedition for the camp screen.
import { caps } from "./combat/build.ts";
import { BANTER, POOL_BY_ID, type BanterScene } from "./content.ts";
import type { Person, SovState } from "./state.ts";
import { withRng } from "./year.ts";

type Cast = { a: Person; b?: Person; c?: Person };

/** Who a scene needs: the speakers its lines give voice to or name. */
function needs(scene: BanterScene): ("a" | "b" | "c")[] {
  const text = scene.lines.map((l) => `${l.who} ${l.text}`).join(" ");
  return (["a", "b", "c"] as const).filter((k) => scene.lines.some((l) => l.who === k) || text.includes(`{${k}}`) || text.includes(`{house_${k}}`));
}

/** The road so far, as the conditions read it. */
function road(s: SovState) {
  const e = s.expedition!;
  const start = Object.entries(e.start ?? {});
  return {
    fallen: start.filter(([id]) => !s.people.some((p) => p.id === Number(id))).map(([, w]) => w.name),
    lost: start.filter(([id]) => s.people.some((p) => p.id === Number(id) && p.status === "lost")).map(([, w]) => w.name),
  };
}

function holds(s: SovState, cond: string, cast: Cast, count: number, r: ReturnType<typeof road>): boolean {
  const e = s.expedition!;
  const { a, b } = cast;
  if (cond.startsWith("job:")) return a.job === cond.slice(4);
  if (cond.startsWith("job_b:")) return b?.job === cond.slice(6);
  if (cond.startsWith("pool:")) return e.card.pool === cond.slice(5);
  switch (cond) {
    case "alone":
      return count === 1;
    case "hurt": {
      const c = e.carry[a.id];
      return !!c?.hurt && !!c.hpMax && c.hurt * 2 > c.hpMax;
    }
    case "shaken":
      return a.sanity * 2 < caps(s, a).sanity;
    case "fallen":
      return r.fallen.length > 0;
    case "lost":
      return r.lost.length > 0;
    case "boss_next":
      return e.chain[e.at] === "boss";
    case "first":
      return !e.chain.slice(0, Math.max(0, e.at - 1)).includes("camp");
    case "rivals":
      return !!b && a.host !== b.host;
    case "kin":
      return !!b && a.host === b.host;
    case "mandatory":
      return e.card.type === "mandatory";
    case "young":
      return a.age < 20;
    case "old":
      return a.age >= 45;
    case "veteran":
      return (a.hist.expeditions ?? 0) >= 4;
    default:
      return false;
  }
}

/** A scene and its speakers, or null when nothing fits (there is always a scene with no conditions for two). */
function cast(s: SovState, ids: number[]): { scene: BanterScene; cast: Cast } | null {
  const e = s.expedition!;
  const r = road(s);
  const said = new Set(e.talked ?? []);
  return withRng(s, (rng) => {
    const people = rng.shuffle(ids.map((id) => s.people.find((p) => p.id === id)!).filter(Boolean));
    if (!people.length) return null;
    const fits: { scene: BanterScene; cast: Cast; weight: number }[] = [];
    for (const scene of BANTER) {
      if (said.has(scene.id)) continue;
      const roles = needs(scene);
      if (roles.length > people.length) continue;
      // The first cast that fits, trying each Scion as the one the scene is about.
      for (let i = 0; i < people.length; i++) {
        const rest = people.filter((_, j) => j !== i);
        const c: Cast = { a: people[i]!, ...(roles.includes("b") ? { b: rest[0] } : {}), ...(roles.includes("c") ? { c: rest[1] } : {}) };
        // B is the first other Scion who makes it hold, for scenes about two Houses.
        const bs = roles.includes("b") ? rest : [undefined];
        const b = bs.find((x) => (scene.when ?? []).every((w) => holds(s, w, { ...c, b: x }, people.length, r)));
        if (b === undefined && roles.includes("b")) continue;
        if (!roles.includes("b") && !(scene.when ?? []).every((w) => holds(s, w, c, people.length, r))) continue;
        fits.push({ scene, cast: { ...c, ...(b ? { b, c: roles.includes("c") ? rest.find((x) => x !== b) : undefined } : {}) }, weight: 1 + 2 * (scene.when?.length ?? 0) });
        break;
      }
    }
    if (!fits.length) return null;
    let roll = rng.int(fits.reduce((n, f) => n + f.weight, 0));
    return fits.find((f) => (roll -= f.weight) < 0)!;
  });
}

/** The party talks at the fire: the scene's lines, names filled in, kept for the camp screen. */
export function campTalk(s: SovState, ids: number[]): void {
  const e = s.expedition!;
  const pick = cast(s, ids);
  if (!pick) {
    e.camp = { at: e.at, lines: [] };
    return;
  }
  const { scene, cast: who } = pick;
  const r = road(s);
  const house = (p?: Person) => (p ? s.houses[p.host]!.name : "");
  const fill = (t: string) =>
    t
      .replaceAll("{a}", who.a.name)
      .replaceAll("{b}", who.b?.name ?? "")
      .replaceAll("{c}", who.c?.name ?? "")
      .replaceAll("{house_a}", house(who.a))
      .replaceAll("{house_b}", house(who.b))
      .replaceAll("{fallen}", r.fallen.join(" and "))
      .replaceAll("{lost}", r.lost.join(" and "))
      .replaceAll("{pool}", POOL_BY_ID.get(e.card.pool)?.name ?? e.card.pool);
  e.camp = { at: e.at, lines: scene.lines.map((l) => ({ who: l.who === "fire" ? null : (who[l.who]?.id ?? null), text: fill(l.text) })) };
  (e.talked ??= []).push(scene.id);
}
