// Arcana nodes (§14.9): a Major Arcana's mini-boss met once a campaign, likelier with its bearer along,
// fought in the chain; the kill marks the bearer with its trait and drops its Relic.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { arcanaFor, withArcana } from "./arcana.ts";
import { bossBattle } from "./combat/bosses.ts";
import { BASELINE, realParty } from "./combat/roster.ts";
import { simulate } from "./combat/sim.ts";
import { ARCANA, BOSS_BY_ID, NAMED_BY_ID, TAROT_BY_ID, TRAIT_BY_ID } from "./content.ts";
import { muster } from "./expedition.ts";
import { bossFor, pressOn } from "./journey.ts";
import { levelUp } from "./progression.ts";
import type { ExpeditionCard, SovState } from "./state.ts";
import { calm, campaign } from "./testing.ts";
import { TUNING } from "./tuning.ts";

const A = TUNING.arcana;

function away(card: Partial<ExpeditionCard> = {}): SovState {
  const s = calm(campaign(2, 8));
  s.phase = "expedition";
  muster(s, { type: "delve", pool: "barrows", level: 3, size: 4, ...card });
  const e = s.expedition!;
  e.party = [0, 1].map((h) => s.people.filter((p) => p.host === h && p.status === "scion").slice(0, 2).map((p) => p.id));
  e.leader = e.party[0]![0]!;
  return s;
}
const walkers = (s: SovState) => s.people.filter((p) => s.expedition!.party.flat().includes(p.id));

describe("the Arcana's content", () => {
  it.each(ARCANA.map((a) => [a.tarot, a] as const))("%s names its card, its boss, a trait gained only so, and a Relic that boss drops", (_, a) => {
    expect(TAROT_BY_ID.has(a.tarot)).toBe(true);
    expect(BOSS_BY_ID.has(a.boss)).toBe(true);
    expect(TRAIT_BY_ID.get(a.trait)?.weight).toBe(0);
    expect(NAMED_BY_ID.get(a.relic)?.boss).toBe(a.boss);
  });

  it("an Arcana's own boss never ends a card as the pool's boss", () => {
    for (const a of ARCANA.filter((x) => BOSS_BY_ID.get(x.boss)!.tags.includes("arcana"))) {
      const pool = BOSS_BY_ID.get(a.boss)!.pool;
      for (let level = 1; level <= 10; level++) for (let seed = 1; seed <= 5; seed++) {
        const s = away({ pool, level });
        s.rng = seed;
        expect(bossFor(s)).not.toBe(a.boss);
      }
    }
  });

  it.each(ARCANA.map((a) => [a.boss] as const))("%s is fought to the end by the bots", (boss) => {
    const b = bossBattle(5, realParty(5, 12, BASELINE), boss, 4);
    expect(simulate(b).outcome).toBeDefined();
  });
});

describe("meeting one", () => {
  it("is far likelier with a Scion of that Tarot along, and then it is theirs", () => {
    const share = (bearer: boolean) => {
      let hits = 0;
      for (let seed = 1; seed <= 400; seed++) {
        const s = away();
        const party = walkers(s);
        for (const p of party) p.tarot = "chariot";
        if (bearer) party[0]!.tarot = "death";
        const got = arcanaFor(s, createRng(seed), party);
        if (got) hits++;
        if (got && bearer) expect(["death", ...ARCANA.map((a) => a.tarot)]).toContain(got);
      }
      return hits / 400;
    };
    expect(share(true)).toBeGreaterThan(A.bearerPct / 100 - 0.07);
    expect(share(false)).toBeLessThan(A.basePct / 100 + 0.05);
    expect(share(true)).toBeGreaterThan(share(false) * 2);
  });

  it("at most once a campaign, never on a mandatory or forced card", () => {
    const s = away();
    const party = walkers(s);
    party[0]!.tarot = "death";
    const chain = withArcana(s, createRng(1), ["event", "encounter", "boss"], "death");
    expect(chain.filter((k) => k === "arcana")).toHaveLength(1);
    expect(chain.at(-1)).toBe("boss");
    delete s.expedition!.arcana;
    for (let seed = 1; seed <= 100; seed++) expect(arcanaFor(s, createRng(seed), [party[0]!])).not.toBe("death");
    for (const type of ["mandatory", "forced"] as const) {
      const t = away({ type, size: 8 });
      for (let seed = 1; seed <= 50; seed++) expect(arcanaFor(t, createRng(seed), walkers(t))).toBeUndefined();
    }
  });
});

describe("the kill", () => {
  it("marks its bearer with the card's trait and carries its Relic home", () => {
    const s = away({ level: 1 });
    for (const p of s.people) while (p.status === "scion" && p.level < 25) Object.assign(p, levelUp(p));
    const bearer = walkers(s)[0]!;
    bearer.tarot = "fool";
    s.expedition!.arcana = "fool";
    s.expedition!.chain = ["arcana", "boss"];
    pressOn(s);
    expect(s.log.some((l) => l.includes("A card turns over"))).toBe(true);
    expect(s.people.find((p) => p.id === bearer.id)!.traits).toContain("fools_luck");
    expect(s.expedition!.haul!.items.some((i) => i.named === "the_fools_bell")).toBe(true);
  });
});
