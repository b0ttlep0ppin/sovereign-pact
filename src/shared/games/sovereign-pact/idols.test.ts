// Idols (§14.9): old gods at the end of high Pilgrimages, an offer first and a boss if refused or cheated.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { BOSS_BY_ID, IDOLS, IDOL_BY_ID, NAMED_BY_ID, POOL_BY_ID, TRIP_EVENT_BY_ID } from "./content.ts";
import { decide, drawEvent, present } from "./events.ts";
import { muster } from "./expedition.ts";
import { idolFor, withIdol } from "./idols.ts";
import { bossFor, pressOn } from "./journey.ts";
import { levelUp } from "./progression.ts";
import type { ExpeditionCard, SovState } from "./state.ts";
import { calm, campaign } from "./testing.ts";
import { TUNING } from "./tuning.ts";

const I = TUNING.idol;

function pilgrimage(idol = "idol_weigher", card: Partial<ExpeditionCard> = {}): SovState {
  const s = calm(campaign(2, 9));
  s.phase = "expedition";
  const def = IDOL_BY_ID.get(idol)!;
  muster(s, { type: "pilgrimage", pool: def.pool, level: 6, size: 4, idol, boss: def.boss, ...card });
  const e = s.expedition!;
  e.party = [0, 1].map((h) => s.people.filter((p) => p.host === h && p.status === "scion").slice(0, 2).map((p) => p.id));
  e.leader = e.party[0]![0]!;
  return s;
}
const choose = (s: SovState, option: string) => {
  const def = TRIP_EVENT_BY_ID.get(s.expedition!.event!.id)!;
  const i = def.options.findIndex((o) => o.id === option);
  for (const h of present(s)) decide(s, h, i);
};

describe("the Idols' content", () => {
  it.each(IDOLS.map((i) => [i.id, i] as const))("%s: a boss of its own, an offer, and a Lore Relic", (_, i) => {
    expect(BOSS_BY_ID.get(i.boss)!.tags).toContain("idol");
    expect(TRIP_EVENT_BY_ID.get(i.event)!.pools).toEqual(["idol"]);
    expect(NAMED_BY_ID.get(i.relic)).toMatchObject({ boss: i.boss, artifact: { category: "lore" } });
    expect(POOL_BY_ID.get(i.pool)!.cards).toContain("pilgrimage");
  });

  it("are never met by chance: not as a pool's boss, not as a passing event", () => {
    for (const i of IDOLS) {
      for (let level = 1; level <= 10; level++) {
        const s = pilgrimage(i.id, { level, idol: undefined, boss: undefined });
        for (let n = 0; n < 5; n++) {
          expect(bossFor(s)).not.toBe(i.boss);
          expect(drawEvent(s)?.pools).not.toContain("idol");
        }
      }
    }
  });
});

describe("the Rift Gate", () => {
  it("ends some high Pilgrimages at an Idol of the pool, never a low one or another card", () => {
    const s = calm(campaign(2, 1));
    const card = (type: ExpeditionCard["type"], level: number): ExpeditionCard => ({ type, pool: "barrows", level, size: 4 });
    const rolls = (c: ExpeditionCard) => Array.from({ length: 300 }, (_, i) => idolFor(s, createRng(i + 1), c));
    const high = rolls(card("pilgrimage", I.minLevel));
    expect(high.filter(Boolean).length / 300).toBeCloseTo(I.pct / 100, 1);
    for (const id of high.filter(Boolean)) expect(IDOL_BY_ID.get(id!)!.pool).toBe("barrows");
    expect(rolls(card("pilgrimage", I.minLevel - 1)).some(Boolean)).toBe(false);
    expect(rolls(card("delve", 8)).some(Boolean)).toBe(false);
  });

  it("puts the offer just before the Idol, once a campaign", () => {
    const s = pilgrimage();
    expect(withIdol(s, ["event", "camp", "boss"])).toEqual(["event", "camp", "idol", "boss"]);
    for (let i = 0; i < 100; i++) expect(idolFor(s, createRng(i), { type: "pilgrimage", pool: "barrows", level: 8, size: 4 })).not.toBe("idol_weigher");
  });
});

describe("the offer", () => {
  it("kneeling pays the price for the blessing, costs Renown, and ends the expedition in triumph", () => {
    const s = pilgrimage();
    s.expedition!.chain = ["idol", "boss"];
    const renown = s.houses.map((h) => h.score.renown);
    pressOn(s);
    expect(s.expedition!.event!.id).toBe("idol_weigher_offer");
    choose(s, "kneel");
    expect(s.log.some((l) => l.includes("returns in triumph"))).toBe(true);
    expect(s.log.some((l) => l.includes("defeats the boss"))).toBe(false);
    for (const [i, h] of s.houses.entries()) expect(h.score.renown).toBeLessThan(renown[i]!);
  });

  it("refused, the Idol is the boss; killed, it pays Valor and Renown and leaves its Relic", () => {
    // The fight goes one way or the other on its rolls: take the first of a few that the party wins.
    const won = Array.from({ length: 10 }, (_, seed) => {
      const s = pilgrimage();
      for (const p of s.people) while (p.status === "scion" && p.level < 30) Object.assign(p, levelUp(p));
      s.expedition!.chain = ["idol", "boss"];
      pressOn(s);
      choose(s, "defy");
      s.rng = seed + 1;
      const before = s.houses.map((h) => ({ ...h.score }));
      pressOn(s);
      return { s, before };
    }).find(({ s }) => s.log.some((l) => l.includes("defeats the boss")));
    expect(won).toBeDefined();
    const { s, before } = won!;
    for (const [i, h] of s.houses.entries()) {
      expect(h.score.renown - before[i]!.renown).toBe(I.renown);
      expect(h.score.valor - before[i]!.valor).toBeGreaterThanOrEqual(I.valor);
    }
    const shares = s.expedition?.pool ?? [];
    expect(shares.some((x) => x.item?.named === "the_feather_of_truth")).toBe(true);
  });
});
