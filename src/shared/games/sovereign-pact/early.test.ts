// The first Years (tuning pass): new Scions can fight, the Rift Gate always offers a card they can take,
// the bots choose and turn back with judgment, and Scions below a level's mark catch up.
import { describe, expect, it } from "vitest";
import { ITEM_BASE_BY_ID, JOBS } from "./content.ts";
import { botField, botLeader, muster } from "./expedition.ts";
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
  it("pays more to a Scion below the most seasoned one who marched, up to a cap, never less", () => {
    expect(xpAt({ level: 3 }, 100, 3)).toBe(100);
    expect(xpAt({ level: 9 }, 100, 3)).toBe(100);
    expect(xpAt({ level: 1 }, 100, 3)).toBe(Math.round(100 * (1 + (2 * P.catchUpPct) / 100)));
    expect(xpAt({ level: 1 }, 100, 20)).toBe(Math.round(100 * (1 + (P.catchUpLevels * P.catchUpPct) / 100)));
  });
  it("pays a fresh party about a level and a half for a five-battle expedition", () => {
    expect(5 * P.battleXp + P.expeditionXp).toBe(150);
    expect(5 * P.battleJp + P.expeditionJp).toBe(250);
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
    e.at = 1;
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

  it("never turns back at the Gate, before the party has met anything (Josh 2026-11-10)", () => {
    const s = underway();
    const [a] = s.expedition!.party.flat() as number[];
    s.people.find((p) => p.id === a)!.sanity = 3;
    expect(botPress(s)).toBe(false);
    s.expedition!.at = 0;
    expect(botPress(s)).toBe(true);
  });

  it("keeps a Scion near the end of their Sanity home, and never makes them Leader", () => {
    const s = calm(campaign(2, 3));
    s.phase = "expedition";
    muster(s, { type: "delve", pool: "barrows", level: 1, size: 4 });
    const mine = s.people.filter((p) => p.host === 1 && p.status === "scion");
    for (const p of mine) p.level = 1;
    mine[0]!.level = 3;
    mine[0]!.sanity = 5;
    expect(botField(s, 1)).not.toContain(mine[0]!.id);
    s.expedition!.party = [[], [mine[0]!.id, mine[1]!.id]];
    expect(botLeader(s, 1)).toBe(mine[1]!.id);
  });

  it("votes a person's Scion Leader whenever one marches, and never turns back with one (Josh 2026-11-10)", () => {
    const s = underway();
    const [a, , c] = s.expedition!.party.flat() as number[];
    s.botSeats = [1];
    s.expedition!.leader = c;
    expect(botLeader(s, 1)).toBe(a);
    s.people.find((p) => p.id === c)!.sanity = 3;
    expect(botPress(s)).toBe(true);
    s.botSeats = [0, 1];
    expect(botPress(s)).toBe(false);
  });
});

describe("the bot's Sorties", () => {
  it("go with two Scions or more, the best kept home for the expedition; a lone Scion rests instead", () => {
    const s = calm(campaign(2, 3));
    // A House with Scions to spare: more of its own, after the training seats and the expedition's.
    const first = s.people.find((p) => p.host === 0 && p.status === "scion")!;
    const top = Math.max(...s.people.map((p) => p.id));
    for (let i = 1; i <= 6; i++) s.people.push({ ...first, id: top + i, name: `${first.name} ${i}`, gear: {}, level: 1 });
    const sortie = (house: number) => [...assignPlan(s, house).values()].filter((a) => a?.to === "sortie").length;
    expect(sortie(0)).toBeGreaterThanOrEqual(TUNING.sortie.botMin);
    const plan = assignPlan(s, 0);
    const best = s.people.filter((p) => p.host === 0 && p.status === "scion").sort((a, b) => b.level - a.level || a.id - b.id).slice(0, Math.ceil(TUNING.sortie.botKeepSeats / 2));
    for (const p of best) expect(plan.get(p.id)?.to).not.toBe("sortie");
    const keep = s.people.find((p) => p.host === 0 && p.status === "scion")!;
    s.people = s.people.filter((p) => p.host !== 0 || p.status !== "scion" || p === keep);
    expect(sortie(0)).toBe(0);
    expect(assignPlan(s, 0).get(keep.id)).toEqual({ to: "rest" });
  });
});
