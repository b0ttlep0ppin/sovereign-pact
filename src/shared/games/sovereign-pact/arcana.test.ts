// Arcana nodes (§14.9): a Major Arcana's mini-boss met once a campaign, likelier with its bearer along,
// fought in the chain; the kill marks the bearer with its trait and drops its Relic.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { arcanaFor, arcanaHuntFor, withArcana } from "./arcana.ts";
import { bossBattle } from "./combat/bosses.ts";
import { BASELINE, realParty } from "./combat/roster.ts";
import { simulate } from "./combat/sim.ts";
import { ARCANA, BOSS_BY_ID, NAMED_BY_ID, TAROT, TAROT_BY_ID, TRAIT_BY_ID } from "./content.ts";
import { muster } from "./expedition.ts";
import { offer } from "./gate.ts";
import { bossFor, pressOn, rollChain } from "./journey.ts";
import { levelUp, passiveBudget } from "./progression.ts";
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

  it("every one of the 22 Major Arcana has its node, once", () => {
    expect(ARCANA.map((a) => a.tarot).sort()).toEqual(TAROT.map((t) => t.id).sort());
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
        // Everyone bears Death; without a bearer, Death is already met, so it counts for nothing.
        for (const p of party) p.tarot = "death";
        if (!bearer) s.flags.push("arcana_death");
        const got = arcanaFor(s, createRng(seed), party);
        if (got) hits++;
        if (!bearer) expect(got).not.toBe("death");
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
  it("the World's mark is a passive point more", () => {
    const p = calm(campaign(2, 8)).people.find((x) => x.status === "scion")!;
    expect(passiveBudget({ ...p, traits: [...p.traits, "worldwalker"] })).toBe(passiveBudget(p) + 1);
  });

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

describe("the great Arcana's Hunts", () => {
  const card = (pool: string, level: number, type: ExpeditionCard["type"] = "delve"): ExpeditionCard => ({ type, pool, level, size: 4 });
  const rolls = (s: SovState, c: ExpeditionCard) => Array.from({ length: 300 }, (_, i) => arcanaHuntFor(s, createRng(i + 1), c));

  it("turn some high cards of their boss's pool into their Hunt, never a low one or a Rescue", () => {
    const s = calm(campaign(2, 1));
    for (const tarot of A.hunts) {
      const pool = BOSS_BY_ID.get(ARCANA.find((a) => a.tarot === tarot)!.boss)!.pool;
      expect(rolls(s, card(pool, A.huntLevel)).filter((t) => t === tarot).length / 300, tarot).toBeGreaterThan(0.15);
      expect(rolls(s, card(pool, A.huntLevel - 1)).some(Boolean)).toBe(false);
      expect(rolls(s, card(pool, 10, "rescue")).some(Boolean)).toBe(false);
    }
    expect(rolls(s, card("pit", 10)).some(Boolean)).toBe(false);
  });

  it("are dealt by the Gate as Hunt cards with the Arcana as their boss", () => {
    let seen = 0;
    for (let seed = 1; seed <= 200 && !seen; seed++) {
      const s = campaign(2, seed);
      s.year = 19;
      for (const c of offer(s).filter((x) => x.arcana)) {
        expect(c).toMatchObject({ type: "hunt", boss: ARCANA.find((a) => a.tarot === c.arcana)!.boss });
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it("killed, the Arcana marks its bearer, leaves its Relic, and is never dealt again", () => {
    // Bare-handed campaign Scions win or lose on the rolls: take the first of a few fights they win.
    const won = Array.from({ length: 20 }, (_, seed) => {
      const s = away({ type: "hunt", pool: "dragon_reaches", level: 1, arcana: "world", boss: "arcana_world" });
      for (const p of s.people) while (p.status === "scion" && p.level < 30) Object.assign(p, levelUp(p));
      walkers(s)[0]!.tarot = "world";
      s.expedition!.chain = rollChain(s).slice(-1);
      expect(s.expedition!.arcana).toBe("world");
      s.rng = seed + 1;
      pressOn(s);
      return s;
    }).find((s) => s.log.some((l) => l.includes("defeats the boss")));
    expect(won).toBeDefined();
    const s = won!;
    const bearer = walkers(s)[0]!;
    expect(s.people.find((p) => p.id === bearer.id)!.traits).toContain("worldwalker");
    expect((s.expedition?.pool ?? []).some((x) => x.item?.named === "the_worlds_mantle")).toBe(true);
    expect(rolls(s, card("dragon_reaches", 10)).some(Boolean)).toBe(false);
  });
});
