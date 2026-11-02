// Dark Bargains (§14.7a): private offers, a price paid at once, a hidden roll, banes that read as bad
// luck, Pact marks counted only at the end, and bots that always refuse.
import { describe, expect, it } from "vitest";
import { arcResult } from "./arc.ts";
import { bargain, botBargain, closeBargains, offerCrown, offerOmenBargains } from "./bargains.ts";
import { BARGAINS } from "./content.ts";
import { sovereignPact as g } from "./index.ts";
import { ascendancy, finalAscendancy, placements } from "./score.ts";
import type { SovState } from "./state.ts";
import { calm, campaign, playOut } from "./testing.ts";
import { TUNING } from "./tuning.ts";
import { view } from "./view.ts";
import { clone } from "./year.ts";

const B = TUNING.bargain;

function offered(id: string, houses = 2): SovState {
  const s = calm(campaign(houses, 7));
  s.bargains.pending.push({ house: 0, id });
  return s;
}

/** Accepts `id` under `runs` different hidden rolls. */
function many(id: string, runs: number, setup: (s: SovState) => void = () => {}, target?: number): SovState[] {
  return Array.from({ length: runs }, (_, seed) => {
    const s = offered(id);
    setup(s);
    s.rng = seed + 1;
    bargain(s, 0, { type: "bargain", id, accept: true, ...(target === undefined ? {} : { target }) });
    return s;
  });
}

const share = (xs: boolean[]) => xs.filter(Boolean).length / xs.length;

describe("the offers' content", () => {
  it.each(BARGAINS.map((b) => [b.id, b] as const))("%s grants a boon or names a bane, never both", (_, b) => {
    expect(!!b.boon !== !!b.bane).toBe(true);
    if (b.bane) expect(b.misfortune).toBeTruthy();
  });
});

describe("offering", () => {
  it("whispers at Omens to the House alone, at most twice a campaign", () => {
    const s = campaign(2, 3);
    s.year = 4;
    // No House traits, so none is Wary of whispers.
    for (const h of s.houses) h.traits = [];
    const pct = B.omenPct;
    (B as { omenPct: number }).omenPct = 100;
    try {
      const before = s.log.length;
      offerOmenBargains(s);
      expect(s.bargains.pending.map((b) => b.house)).toEqual([0, 1]);
      expect(s.log.length).toBe(before);
      expect(view(s, "p1").mine!.bargains).toEqual([s.bargains.pending[0]!.id]);
      for (let y = 0; y < 5; y++) offerOmenBargains(s);
      expect(s.bargains.offered).toEqual([B.omenMax, B.omenMax]);
    } finally {
      (B as { omenPct: number }).omenPct = pct;
    }
  });

  it("the crown makes every House an offer when the Cursed King kneels", () => {
    const s = calm(campaign(3, 2));
    s.year = 10;
    arcResult(s, true);
    expect(s.bargains.pending.map((b) => b.house)).toEqual([0, 1, 2]);
    for (const b of s.bargains.pending) expect(BARGAINS.find((x) => x.id === b.id)!.when).toContain("crown");
  });

  it("solo, never offers a bane: there is no rival to name", () => {
    const s = calm(campaign(1, 2));
    for (let i = 0; i < 30; i++) {
      s.bargains.pending = [];
      s.rng = i + 1;
      offerCrown(s);
      expect(BARGAINS.find((x) => x.id === s.bargains.pending[0]!.id)!.bane).toBeUndefined();
    }
  });
});

describe("answering", () => {
  it("a refusal costs nothing; an unanswered whisper fades at the seal", () => {
    const s = offered("gold_in_the_ashes");
    const gold = s.houses[0]!.gold;
    bargain(s, 0, { type: "bargain", id: "gold_in_the_ashes", accept: false });
    expect(s.bargains.pending).toEqual([]);
    expect(s.houses[0]!.gold).toBe(gold);
    const t = offered("gold_in_the_ashes");
    closeBargains(t);
    expect(t.bargains.pending).toEqual([]);
    expect(t.notes[0]!.at(-1)).toMatch(/fades/);
  });

  it("a bane must name a rival", () => {
    const s = offered("a_name_in_the_ledger");
    const r = (target?: number) => g.applyMove(clone(s), "p1", { type: "bargain", id: "a_name_in_the_ledger", accept: true, ...(target === undefined ? {} : { target }) });
    expect(r()).toMatchObject({ ok: false });
    expect(r(0)).toMatchObject({ ok: false });
    expect(r(1).ok).toBe(true);
    expect(g.applyMove(clone(s), "p2", { type: "bargain", id: "a_name_in_the_ledger", accept: false })).toMatchObject({ ok: false });
  });

  it("is paid at once, then comes as promised, comes to nothing, or comes smaller, on a hidden roll", () => {
    const runs = many("gold_in_the_ashes", 300);
    const start = offered("gold_in_the_ashes").houses[0]!.gold;
    const got = runs.map((s) => s.houses[0]!.gold - start);
    expect(new Set(got)).toEqual(new Set([300, 150, 0]));
    expect(share(got.map((n) => n === 300))).toBeCloseTo(B.promisedPct / 100, 1);
    expect(share(got.map((n) => n === 0))).toBeCloseTo(B.nothingPct / 100, 1);
    // The price, a share of every Scion's Sanity, is paid whatever comes.
    for (const s of runs) expect(s.people.filter((p) => p.host === 0 && p.status === "scion").every((p) => p.sanity < 100)).toBe(true);
  });

  it("a bane reads as plain bad luck to its victim, and the same to the bargainer whether it struck or not", () => {
    const setup = (s: SovState) => {
      s.houses[0]!.buildings = { watchtower: 2 };
      s.houses[1]!.buildings = { watchtower: 2 };
    };
    const runs = many("a_name_in_the_ledger", 200, setup, 1);
    const def = BARGAINS.find((b) => b.id === "a_name_in_the_ledger")!;
    const struck = runs.map((s) => s.houses[1]!.buildings.watchtower === 1);
    const backfired = runs.map((s) => s.houses[0]!.buildings.watchtower === 1);
    expect(share(struck)).toBeCloseTo(B.promisedPct / 100, 1);
    expect(share(backfired)).toBeGreaterThan(0);
    for (const [i, s] of runs.entries()) {
      expect(s.notes[0]).toContain(`${def.title}: ${def.promise}`);
      if (struck[i]) expect(s.notes[1]).toEqual([def.misfortune]);
      else expect(s.notes[1]).toEqual([]);
      expect(s.log.join(" ")).not.toMatch(/bargain/i);
    }
  });

  it("Demon-Blooded, Cursed Line and Old Blood of Kings get better odds", () => {
    const plain = many("gold_in_the_ashes", 300).map((s) => s.houses[0]!.gold);
    const dark = many("gold_in_the_ashes", 300, (s) => s.houses[0]!.traits.push("demon_blooded")).map((s) => s.houses[0]!.gold);
    const top = Math.max(...plain);
    expect(share(dark.map((n) => n === top))).toBeGreaterThan(share(plain.map((n) => n === top)));
  });
});

describe("Pact marks", () => {
  it("some bargains carry one, seen by no one until the end", () => {
    const runs = many("gold_in_the_ashes", 300);
    expect(share(runs.map((s) => s.houses[0]!.pactMarks === 1))).toBeCloseTo(0.5, 1);
    const s = runs.find((x) => x.houses[0]!.pactMarks)!;
    expect(view(s, "p1").houses[0]).not.toHaveProperty("pactMarks");
    s.phase = "over";
    expect(view(s, "p2").houses[0]!.pactMarks).toBe(1);
  });

  it("cost a House a share of the kingdom's mean at the final score", () => {
    const s = calm(campaign(2, 4));
    s.houses[0]!.score.valor += 200;
    const mean = (ascendancy(s, 0) + ascendancy(s, 1)) / 2;
    expect(placements(s)).toEqual([1, 2]);
    s.houses[0]!.pactMarks = 2;
    expect(finalAscendancy(s, 0)).toBe(ascendancy(s, 0) - Math.round((2 * B.markPct * mean) / 100));
    expect(finalAscendancy(s, 1)).toBe(ascendancy(s, 1));
    s.houses[0]!.pactMarks = 8;
    expect(placements(s)).toEqual([2, 1]);
  });
});

describe("the bot", () => {
  it("always refuses", () => {
    const s = offered("gold_in_the_ashes");
    expect(botBargain(s, 0)).toEqual({ type: "bargain", id: "gold_in_the_ashes", accept: false });
    expect(botBargain(s, 1)).toBeNull();
    const pct = B.omenPct;
    (B as { omenPct: number }).omenPct = 100;
    try {
      const end = playOut(campaign(2, 9, { length: "short" }));
      expect(end.houses.every((h) => h.pactMarks === 0)).toBe(true);
      expect(end.bargains.offered.every((n) => n === B.omenMax)).toBe(true);
    } finally {
      (B as { omenPct: number }).omenPct = pct;
    }
  });
});
