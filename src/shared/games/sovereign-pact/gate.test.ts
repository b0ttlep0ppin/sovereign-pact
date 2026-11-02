// The Rift Gate (§9.1): the Year's cards at its band, the mandatory arc, the vote and its ties.
import { describe, expect, it } from "vitest";
import { POOL_BY_ID } from "./content.ts";
import { band, chosenCard, offer, openGate } from "./gate.ts";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { calm, campaign, sealYear } from "./testing.ts";
import { TUNING } from "./tuning.ts";
import { view } from "./view.ts";

const g = sovereignPact;
const move = (s: SovState, player: string, m: SovMove): SovState => {
  const r = g.applyMove(s, player, m);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const error = (s: SovState, player: string, m: SovMove): string => {
  const r = g.applyMove(s, player, m);
  if (r.ok) throw new Error("expected a refusal");
  return r.error;
};

/** A still Year (no events) whose Gate is open. */
const open = (H: number, seed = 5): SovState => {
  const s = calm(campaign(H, seed));
  s.flags = s.flags.filter((f) => f !== "calm");
  openGate(s);
  return s;
};

describe("the Rift Gate's offer (§9.1)", () => {
  it("offers 2–3 cards of different pools at the Year's band, each a type its pool allows", () => {
    const s = open(2);
    for (let year = 1; year <= 20; year++) {
      if ((TUNING.campaign.mandatoryYears.full as readonly number[]).includes(year)) continue;
      s.year = year;
      const [lo, hi] = band(year);
      for (let n = 0; n < 10; n++) {
        const cards = offer(s);
        expect(cards.length).toBeGreaterThanOrEqual(2);
        expect(cards.length).toBeLessThanOrEqual(3);
        expect(new Set(cards.map((c) => c.pool)).size).toBe(cards.length);
        for (const c of cards) {
          const pool = POOL_BY_ID.get(c.pool)!;
          expect(c.level).toBeGreaterThanOrEqual(Math.max(lo, pool.levels[0]));
          expect(c.level).toBeLessThanOrEqual(Math.min(hi, pool.levels[1]));
          // A great Arcana's Hunt is dealt in its boss's pool, whatever cards the pool deals (§14.9).
          expect(c.arcana ? ["hunt"] : pool.cards).toContain(c.type);
          expect([4, 8, "2x4"]).toContain(c.size);
        }
      }
    }
  });

  it("offers the mandatory arc's card alone in its Years, in order, for both lengths", () => {
    const s = open(2);
    TUNING.campaign.mandatoryYears.full.forEach((year, i) => {
      s.year = year;
      const arc = TUNING.gate.arc[i]!;
      expect(offer(s)).toEqual([{ type: "mandatory", pool: expect.any(String), level: arc.level, size: 8, boss: arc.boss }]);
    });
    expect(offer({ ...s, year: 5 })[0]!.pool).toBe("pit");
    const short = calm(campaign(2, 5, { length: "short" }));
    short.year = TUNING.campaign.mandatoryYears.short[1]!;
    expect(offer(short)[0]!.boss).toBe("cursed_king");
  });

  it("opens with the Year and shows the cards and votes to everyone", () => {
    const s = open(2);
    expect(s.gate!.cards.length).toBeGreaterThan(1);
    expect(s.gate!.votes).toEqual([null, null]);
    expect(view(s, "p2").gate).toEqual(s.gate);
  });
});

describe("the vote on the card (§9.1)", () => {
  it("takes votes, changeable until the seal, and refuses cards not on offer", () => {
    let s = open(2);
    expect(error(s, "p1", { type: "pick_card", card: 7 })).toMatch(/not on offer/);
    s = move(s, "p1", { type: "pick_card", card: 1 });
    s = move(s, "p1", { type: "pick_card", card: 0 });
    expect(s.gate!.votes).toEqual([0, null]);
    s = move(s, "p1", { type: "seal" });
    expect(error(s, "p1", { type: "pick_card", card: 1 })).toMatch(/Unseal/);
    s.year = TUNING.campaign.mandatoryYears.full[0]!;
    openGate(s);
    expect(error(move(s, "p1", { type: "unseal" }), "p1", { type: "pick_card", card: 0 })).toMatch(/no card to choose/);
  });

  it("goes to the most votes; no votes take the first card", () => {
    const s = open(3);
    s.gate!.cards = [s.gate!.cards[0]!, s.gate!.cards[1]!];
    expect(chosenCard(s)).toBe(s.gate!.cards[0]);
    s.gate!.votes = [1, 1, 0];
    expect(chosenCard(s)).toBe(s.gate!.cards[1]);
  });

  it("breaks a tie for the highest-Renown voter's card, at a cost in Accord", () => {
    const s = open(2);
    s.gate!.votes = [0, 1];
    s.houses[1]!.score.renown = s.houses[0]!.score.renown + 5;
    const accord = s.accord;
    expect(chosenCard(s)).toBe(s.gate!.cards[1]);
    expect(s.accord).toBe(accord - TUNING.tracks.tieCost);
    expect(s.log.at(-1)).toMatch(/final word/);
  });

  it("closes with the Year: the chosen card is logged and the Gate shuts", () => {
    let s = open(2);
    s = move(s, "p1", { type: "pick_card", card: 1 });
    s = move(s, "p2", { type: "pick_card", card: 1 });
    const pool = POOL_BY_ID.get(s.gate!.cards[1]!.pool)!.name;
    s = sealYear(s);
    expect(s.log.some((l) => l.includes(`toward ${pool}`))).toBe(true);
    expect(s.year).toBe(2);
    expect(s.gate!.votes).toEqual([null, null]);
  });

  it("the bot votes for the lowest level on offer", () => {
    const s = open(2);
    s.gate!.cards = [
      { type: "resource", pool: "hollow_wood", level: 3, size: 4 },
      { type: "resource", pool: "beast_lands", level: 1, size: 4 },
    ];
    expect(g.botMove!(s, "p2", undefined as never)).toEqual({ type: "pick_card", card: 1 });
  });
});
