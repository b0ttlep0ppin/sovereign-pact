// The first Years (tuning pass): new Scions can fight, the Rift Gate always offers a card they can take,
// the bots choose and turn back with judgment, and Scions below a level's mark catch up.
import { describe, expect, it } from "vitest";
import { ITEM_BASE_BY_ID, JOBS } from "./content.ts";
import { muster } from "./expedition.ts";
import { band, botCard, offer } from "./gate.ts";
import { baseOf, itemById } from "./items.ts";
import { botPress } from "./journey.ts";
import { assignPlan } from "./bot.ts";
import { levelUp, mayWield, xpAt } from "./progression.ts";
import { promoteRecruit } from "./promotion.ts";
import type { ExpeditionCard, SovState } from "./state.ts";
import { calm, campaign } from "./testing.ts";
import { TUNING } from "./tuning.ts";

const P = TUNING.progression;

describe("new Scions", () => {
  it("each Job's starter is a weapon the Job may wield", () => {
    for (const j of JOBS) {
      const b = ITEM_BASE_BY_ID.get(j.starter!)!;
      expect(b, j.id).toBeDefined();
      expect(b.slot).toBe("main");
      const p = { job: j.id } as Parameters<typeof mayWield>[0];
      expect(mayWield(p, b.type, b.hands ?? 1), j.id).toBe(true);
    }
  });

  it("start with a little JP and the Job's own weapon: a Vagabond a bow", () => {
    const s = calm(campaign(2, 2));
    for (const p of s.people.filter((x) => x.status === "scion")) expect(p.jp[p.job!]).toBe(P.startJp);
    const r = s.people.find((x) => x.host === 0 && x.status === "recruit")!;
    s.houses[0]!.gold = 999;
    promoteRecruit(s, 0, r.id, "vagabond");
    const p = s.people.find((x) => x.id === r.id)!;
    expect(p.jp.vagabond).toBe(P.startJp);
    expect(baseOf(itemById(s, p.gear.main)!).id).toBe("bow");
  });
});

describe("catch-up XP", () => {
  it("pays more to a Scion below the level's mark of 3L, never less at or above it", () => {
    expect(xpAt({ level: 3 }, 100, 1)).toBe(100);
    expect(xpAt({ level: 9 }, 100, 1)).toBe(100);
    expect(xpAt({ level: 1 }, 100, 1)).toBe(Math.round(100 * (1 + (2 * P.catchUpPct) / 100)));
    expect(xpAt({ level: 1 }, 100, 3)).toBeGreaterThan(xpAt({ level: 1 }, 100, 1));
  });
});

describe("the Rift Gate's offer", () => {
  it("always holds a card for 4 at the bottom of the Year's band", () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const year of [1, 7, 12]) {
        const s = campaign(2, seed);
        s.year = year;
        const cards = offer(s).filter((c) => !c.rescue);
        expect(cards.some((c) => c.level === band(year)[0] && c.size === 4)).toBe(true);
      }
    }
  });

  it("the bot picks the card its Scions can take, and a harder one once they have grown", () => {
    const s = campaign(2, 1);
    const card = (level: number): ExpeditionCard => ({ type: "delve", pool: "barrows", level, size: 4 });
    s.gate = { cards: [card(3), card(1), card(2)], votes: [null, null] };
    expect(botCard(s, 0)).toBe(1);
    for (const p of s.people) while (p.status === "scion" && p.level < 7) Object.assign(p, levelUp(p));
    expect(botCard(s, 0)).toBe(0);
  });
});

describe("the bot Leader", () => {
  function underway(): SovState {
    const s = calm(campaign(2, 3));
    s.phase = "expedition";
    muster(s, { type: "delve", pool: "barrows", level: 1, size: 4 });
    const e = s.expedition!;
    e.party = [s.people.filter((p) => p.host === 0 && p.status === "scion").slice(0, 2).map((p) => p.id), s.people.filter((p) => p.host === 1 && p.status === "scion").slice(0, 2).map((p) => p.id)];
    e.leader = e.party[0]![0]!;
    e.chain = ["encounter", "encounter", "boss"];
    return s;
  }

  it("presses on with one Scion hurt, and turns back when half the party is out or badly broken", () => {
    const s = underway();
    const [a, b] = s.expedition!.party.flat() as number[];
    expect(botPress(s)).toBe(true);
    s.expedition!.carry[a!] = { dur: {}, broken: ["arms", "legs"] };
    expect(botPress(s)).toBe(true);
    s.expedition!.out.push(b!);
    expect(botPress(s)).toBe(false);
  });
});

describe("the bot's Sorties", () => {
  it("go with two Scions or more; a lone Scion rests instead", () => {
    const s = calm(campaign(2, 3));
    const sortie = (house: number) => [...assignPlan(s, house).values()].filter((a) => a?.to === "sortie").length;
    expect(sortie(0)).toBeGreaterThanOrEqual(TUNING.sortie.botMin);
    const keep = s.people.find((p) => p.host === 0 && p.status === "scion")!;
    s.people = s.people.filter((p) => p.host !== 0 || p.status !== "scion" || p === keep);
    expect(sortie(0)).toBe(0);
    expect(assignPlan(s, 0).get(keep.id)).toEqual({ to: "rest" });
  });
});
