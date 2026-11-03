// Expedition events (§9.4): drawing them, the party's vote, the rules' subjects, and the effects.
import { describe, expect, it } from "vitest";
import { HOUSE_TRAITS, TAROT_BY_ID, TOWN_EVENT_BY_ID, TRAIT_BY_ID, TRAITS, TRIP_EVENT_BY_ID, TRIP_EVENTS, type TripEffect, type TripOption } from "./content.ts";
import { STATUSES } from "./combat/status.ts";
import { battle } from "./journey.ts";
import { drawEvent, eligible, resolve, subjects } from "./events.ts";
import { able, muster } from "./expedition.ts";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { mint } from "./items.ts";
import { levelUp } from "./progression.ts";
import { STATS, type ExpeditionCard } from "./state.ts";
import { stockTier } from "./market.ts";
import { calm, campaign, sealYear } from "./testing.ts";
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
const card = (level = 2, type: ExpeditionCard["type"] = "delve", pool = "barrows"): ExpeditionCard => ({ type, pool, level, size: 4 });

/** `H` Houses underway (two Scions each, one House alone fields four), the first fielded leading. */
function underway(H: number, c = card(), seed = 5): SovState {
  let s = calm(campaign(H, seed));
  s.phase = "expedition";
  muster(s, c);
  for (let h = 0; h < H; h++) s = move(s, `p${h + 1}`, { type: "field", people: able(s, h).slice(0, s.expedition!.seats[h]).map((p) => p.id) });
  const leader = s.expedition!.party[0]![0]!;
  if (H > 1) for (let h = 0; h < H; h++) s = move(s, `p${h + 1}`, { type: "lead", person: leader });
  return s;
}
const option = (rule: string, ...effects: TripEffect[]): TripOption => ({ id: "x", label: "Test.", rule, outcomes: [{ w: 1, text: "It happens.", effects }] });
const ofHouse = (s: SovState, h: number) => s.expedition!.party[h]!;

describe("drawing an event (§9.3)", () => {
  it("draws from the card's pools or the general pool, in band, once an expedition, its requirements met", () => {
    const s = underway(1, card(2, "delve", "barrows"));
    for (let i = 0; i < 40; i++) {
      const d = drawEvent(s)!;
      expect(d.band[0] <= 2 && 2 <= d.band[1]).toBe(true);
      expect(d.pools.some((p) => ["general", "delve", "barrows"].includes(p))).toBe(true);
    }
    s.expedition!.seen.push("bread_on_the_water");
    expect(eligible(s, () => true).map((d) => d.id)).not.toContain("bread_on_the_water");
    s.flags.push("banquet_seen");
    expect(eligible(s, () => true).map((d) => d.id)).not.toContain("banquet_of_the_hollow_host");
    s.expedition!.card.level = 1;
    expect(eligible(s, () => true).map((d) => d.id)).not.toContain("ash_rain");
  });

  it("puts the event to the Houses present at an Event node", () => {
    let s = underway(2);
    s.expedition!.chain = ["event", "boss"];
    s = move(s, "p1", { type: "press_on" });
    const ev = s.expedition!.event!;
    expect(TRIP_EVENT_BY_ID.has(ev.id)).toBe(true);
    expect(ev.votes).toEqual([null, null]);
    expect(g.activePlayers(s)).toEqual(["p1", "p2"]);
    expect(error(s, "p1", { type: "press_on" })).toMatch(/decide/);
    expect(error(s, "p1", { type: "decide", option: 9 })).toMatch(/not one of the choices/);
  });
});

describe("the vote (Josh, 2026-11-02: the party votes; the rule names who it happens to)", () => {
  it("takes the majority; a tie goes to the Leader's House and costs no Accord", () => {
    let s = underway(3);
    s.expedition!.event = { id: "the_toll", votes: [null, null, null] };
    s = move(move(s, "p1", { type: "decide", option: 1 }), "p2", { type: "decide", option: 0 });
    expect(error(s, "p2", { type: "decide", option: 0 })).toMatch(/already chosen/);
    const accord = s.accord;
    s.houses.forEach((h) => (h.gold = 100));
    s = move(s, "p3", { type: "decide", option: 0 });
    // Pay (0) had two votes: no tie; the highest-Standing House pays.
    expect(s.accord).toBe(accord);
    expect(s.houses.reduce((n, h) => n + h.gold, 0)).toBe(285);
    let t = underway(2);
    t.expedition!.event = { id: "field_of_flowers", votes: [null, null] };
    const a = t.accord;
    t = move(move(t, "p1", { type: "decide", option: 1 }), "p2", { type: "decide", option: 0 });
    expect(t.accord).toBe(a);
    expect(t.log.some((l) => l.startsWith("Don't trust it."))).toBe(true);
  });

  it("asks only the Houses with someone in the party", () => {
    const s = underway(2);
    s.expedition!.event = { id: "bread_on_the_water", votes: [null, -1] };
    expect(error(s, "p2", { type: "decide", option: 0 })).toMatch(/no one in the party/);
    expect(g.activePlayers(s)).toEqual(["p1"]);
  });
});

describe("the rules' subjects (§9.4)", () => {
  it("names the party, the Leader, the veteran, the strongest, the most shaken, and a House by Standing", () => {
    const s = underway(2);
    const e = s.expedition!;
    const party = [...ofHouse(s, 0), ...ofHouse(s, 1)];
    expect(subjects(s, "vote")).toEqual({ scions: party, house: null });
    expect(subjects(s, "leader").scions).toEqual([e.leader]);
    const vet = s.people.find((p) => p.id === party[3])!;
    vet.hist.expeditions = 9;
    expect(subjects(s, "scion:most_expeditions")).toEqual({ scions: [vet.id], house: 1 });
    const strong = s.people.find((p) => p.id === party[2])!;
    Object.assign(strong, levelUp(levelUp(levelUp(strong))), { growth: [160, 160, 160, 160, 160, 160] });
    Object.assign(strong, levelUp(levelUp(strong)));
    expect(subjects(s, "scion:highest:might").scions).toEqual([strong.id]);
    s.people.find((p) => p.id === party[1])!.sanity = 1;
    expect(subjects(s, "scion:lowest:sanity").scions).toEqual([party[1]]);
    s.houses[1]!.score.renown = 50;
    expect(subjects(s, "house:highest_standing")).toEqual({ scions: ofHouse(s, 1), house: 1 });
    expect(subjects(s, "house:lowest_standing").house).toBe(0);
    expect(party).toContain(subjects(s, "scion:random").scions[0]);
  });
});

describe("the effects (§9.4)", () => {
  it("moves Sanity and Durability by % of max, Breaking a location at 0, and pays XP", () => {
    const s = underway(1);
    const id = s.expedition!.leader!;
    const p = s.people.find((x) => x.id === id)!;
    p.sanity = 10;
    resolve(s, option("leader", { sanity: 1000 }, { durability: -100, loc: "legs" }, { xp: 30 }));
    const q = s.people.find((x) => x.id === id)!;
    expect(q.sanity).toBeGreaterThan(10);
    expect(s.expedition!.carry[id]!.dur.legs).toBe(0);
    expect(s.expedition!.carry[id]!.broken).toEqual(["legs"]);
    expect(q.xp).toBe(p.xp + 30);
    resolve(s, option("leader", { durability: 50 }));
    expect(s.expedition!.carry[id]!.broken).toEqual([]);
  });

  it("tips an event toward the outcome best for a Gambler with Fortune Favors", () => {
    const s = underway(1);
    const id = s.expedition!.leader!;
    const twoWays: TripOption = { id: "x", label: "Test.", rule: "leader", outcomes: [{ w: 1000, text: "Ill.", effects: [{ sanity: -1 }] }, { w: 1, text: "Well.", effects: [{ xp: 1 }] }] };
    const wells = () => {
      let n = 0;
      for (let i = 0; i < 100; i++) {
        resolve(s, twoWays);
        if (s.log.at(-1)!.endsWith("Well.")) n++;
      }
      return n;
    };
    expect(wells()).toBeLessThan(3);
    s.people.find((x) => x.id === id)!.passives = ["fortune_favors"];
    expect(wells()).toBeGreaterThan(3);
  });

  it("lets a Veteran shrug off one harm an expedition, on a Guile roll", () => {
    const s = underway(1);
    const id = s.expedition!.leader!;
    const p = s.people.find((x) => x.id === id)!;
    Object.assign(p, { passives: ["veteran"], sanity: 50 });
    p.base[STATS.indexOf("guile")] = 200;
    resolve(s, option("leader", { sanity: -20 }));
    expect(s.people.find((x) => x.id === id)!.sanity).toBe(50);
    expect(s.log.at(-1)).toMatch(/shrugs it off/);
    resolve(s, option("leader", { sanity: -20 }));
    expect(s.people.find((x) => x.id === id)!.sanity).toBeLessThan(50);
  });

  it("mends the injured subject's oldest lasting Moderate injury, never a Devastating one", () => {
    const s = underway(1);
    const id = ofHouse(s, 0)[1]!;
    s.people.find((x) => x.id === id)!.injuries = [
      { id: "legs_severed", years: -1 },
      { id: "body_cracked_ribs", years: 1 },
      { id: "head_concussion", years: 3 },
    ];
    resolve(s, option("scion:injured:any", { mend: true }));
    expect(s.people.find((x) => x.id === id)!.injuries.map((i) => i.id)).toEqual(["legs_severed", "head_concussion"]);
  });

  it("sends a subject's finds to its House and the party's to the Commons (§9.10); score likewise", () => {
    const s = underway(2);
    const [g0, c0] = [s.houses[1]!.stores.essence ?? 0, s.commons.stores.essence ?? 0];
    resolve(s, option("house:highest_standing", { resources: { essence: 5 }, score: { lore: 2 } }));
    const house = subjects(s, "house:highest_standing").house!;
    expect(s.houses[house]!.score.lore).toBe(2);
    resolve(s, option("vote", { resources: { essence: 3 }, score: { valor: 1 } }));
    expect(s.commons.stores.essence).toBe(c0 + 3);
    expect(s.houses.map((h) => h.score.valor)).toEqual([1, 1]);
    expect((s.houses[house]!.stores.essence ?? 0) - (house === 1 ? g0 : 0)).toBeGreaterThanOrEqual(5);
  });

  it("skips nodes but never the boss, fights, and ends the expedition", () => {
    const s = underway(1, card(1, "resource", "beast_lands"));
    s.expedition!.chain = ["event", "event", "encounter", "boss"];
    resolve(s, option("leader", { skip: 3 }));
    expect(s.expedition!.at).toBe(3);
    for (const p of s.people) while (p.status === "scion" && p.level < 15) Object.assign(p, levelUp(p));
    resolve(s, option("vote", { encounter: {} }));
    expect(s.log.some((l) => l.includes("wins a battle"))).toBe(true);
    resolve(s, option("vote", { retreat: true }));
    expect(s.expedition!.result).toBe("retreated");
  });

  it("rolls forced injuries, and the dead go to the Chronicle", () => {
    let deaths = 0;
    for (let seed = 1; seed <= 40 && !deaths; seed++) {
      const s = underway(1, card(), seed);
      const before = s.people.length;
      resolve(s, option("vote", { injury: "head" }, { injury: "body" }, { injury: "head" }));
      deaths = before - s.people.length;
      expect(s.houses[0]!.chronicle.length).toBe(deaths);
    }
    expect(deaths).toBeGreaterThan(0);
  });
});

describe("the rest of the rules (§9.4)", () => {
  it("finds the laden, the unburdened, a card's bearer, a trait, the maimed and the once-retired; `|` falls back, then the party", () => {
    const s = underway(2);
    const party = [...ofHouse(s, 0), ...ofHouse(s, 1)];
    const p = (i: number) => s.people.find((x) => x.id === party[i])!;
    p(2).gear = {};
    expect(subjects(s, "scion:most_open_slots").scions).toEqual([party[2]]);
    p(1).gear.legs = mint(s, "sabatons", 0, 2).id;
    expect(subjects(s, "scion:heaviest_gear").scions).toEqual([party[1]]);
    for (const x of party) s.people.find((y) => y.id === x)!.tarot = "fool";
    p(3).tarot = "empress";
    expect(subjects(s, "scion:tarot:empress").scions).toEqual([party[3]]);
    expect(subjects(s, "scion:tarot:hermit|leader").scions).toEqual([s.expedition!.leader]);
    expect(subjects(s, "scion:tarot:hermit")).toEqual({ scions: party, house: null });
    for (const x of party) s.people.find((y) => y.id === x)!.traits = [];
    p(1).traits = ["devout"];
    expect(subjects(s, "scion:trait:devout").scions).toEqual([party[1]]);
    p(2).injuries = [{ id: "arms_broken_arm", years: 1 }];
    expect(subjects(s, "scion:injured:any").scions).toEqual([party[2]]);
    expect(subjects(s, "scion:injured:head|scion:retired_once").house).toBeNull();
    p(0).hist.retired = 1;
    expect(subjects(s, "scion:injured:head|scion:retired_once").scions).toEqual([party[0]]);
    const tag = HOUSE_TRAITS.find((t) => t.tags?.length)!;
    s.houses[1]!.traits = [tag.id];
    s.houses[0]!.traits = [];
    expect(subjects(s, `house:trait:${tag.tags![0]}`)).toEqual({ scions: ofHouse(s, 1), house: 1 });
    expect([0, 1]).toContain(subjects(s, "house:random").house);
  });
});

describe("the lasting effects (§9.4)", () => {
  it("changes stats and growths, gains and loses traits (one of a group at a time), curses, and redraws the Tarot", () => {
    const s = underway(1);
    const id = s.expedition!.leader!;
    const p = () => s.people.find((x) => x.id === id)!;
    const [base, growth] = [[...p().base], [...p().growth]];
    p().traits = ["sluggish"];
    p().tarot = "fool";
    resolve(s, option("leader", { stat: { might: 2 } }, { growth: { all: 10, speed: 5 } }, { trait: "+fleet" }, { curse: true }, { tarot: true }));
    expect(p().base[0]).toBe(base[0]! + 2);
    expect(p().growth).toEqual(growth.map((g, i) => g + (STATS[i] === "speed" ? 5 : 10)));
    expect(p().traits).toContain("fleet");
    expect(p().traits).not.toContain("sluggish");
    expect(p().traits.some((t) => TRAIT_BY_ID.get(t)!.tags?.includes("cursed"))).toBe(true);
    expect(p().tarot).not.toBe("fool");
    resolve(s, option("leader", { trait: "-fleet" }));
    expect(p().traits).not.toContain("fleet");
  });

  it("an ailment waits for the next battle only; a Ward's Loyalty moves; a Scion can be Lost", () => {
    const s = underway(2);
    const [a, b] = ofHouse(s, 1);
    for (const p of s.people) while (p.status === "scion" && p.level < 15) Object.assign(p, levelUp(p));
    s.expedition!.leader = a!;
    resolve(s, option("leader", { status: "poison" }));
    expect(s.expedition!.carry[a!]!.start).toEqual(["poison"]);
    s.expedition!.chain = ["encounter", "encounter", "boss"];
    battle(s, false);
    expect(s.expedition!.carry[a!]!.start).toBeUndefined();
    const ward = s.people.find((p) => p.id === b)!;
    ward.host = 0;
    ward.loyalty = 50;
    s.expedition!.leader = b!;
    resolve(s, option("leader", { loyalty: -20 }));
    expect(ward.loyalty).toBe(30);
    resolve(s, option("leader", { scion_lost: true }));
    expect(ward.status).toBe("lost");
    expect(s.log.some((l) => l.includes("left behind"))).toBe(true);
  });

  it("an item goes to the subject's House, or to the draft when the party chose; a timeline entry is queued", () => {
    const s = underway(2);
    const owned = s.items.length;
    resolve(s, option("house:highest_standing", { item: { tier: 3 } }, { timeline: { id: "locked_wing", years: 2 } }));
    const house = s.items.at(-1)!.house;
    expect(s.items.length).toBe(owned + 1);
    expect(s.timeline.at(-1)).toEqual({ year: s.year + 2, id: "locked_wing", house });
    resolve(s, option("vote", { item: { tier: 2 } }));
    expect(s.items.length).toBe(owned + 1);
    expect(s.expedition!.haul!.items.length).toBe(1);
  });
});

describe("each Scion's own choice and Forks (§9.3, §9.4)", () => {
  it("puts an each_scion event to every Scion: their House picks for each, and each meets their own outcome", () => {
    let s = underway(2);
    s.expedition!.chain = ["event", "boss"];
    s.expedition!.seen = TRIP_EVENTS.filter((d) => d.id !== "mirror_pool").map((d) => d.id);
    s = move(s, "p1", { type: "press_on" });
    const ev = s.expedition!.event!;
    expect(ev.id).toBe("mirror_pool");
    const [a, b] = ofHouse(s, 0);
    const [c, d] = ofHouse(s, 1);
    expect(Object.keys(ev.picks!).map(Number).sort((x, y) => x - y)).toEqual([a, b, c, d].sort((x, y) => x! - y!));
    expect(error(s, "p1", { type: "decide", option: 0, person: c })).toMatch(/your own Scions/);
    s = move(s, "p1", { type: "decide", option: 1, person: a });
    expect(error(s, "p1", { type: "decide", option: 1, person: a })).toMatch(/already chosen/);
    expect(g.activePlayers(s)).toEqual(["p1", "p2"]);
    s = move(s, "p1", { type: "decide", option: 1, person: b });
    expect(g.activePlayers(s)).toEqual(["p2"]);
    s = move(s, "p2", g.botMove!(s, "p2", undefined as never));
    s = move(s, "p2", g.botMove!(s, "p2", undefined as never));
    expect(s.expedition!.event).toBeUndefined();
    expect(s.log.filter((l) => l.startsWith("Look away.")).length).toBe(4);
  });

  it("a Fork drops places ahead and puts others next, never the boss", () => {
    const s = underway(1);
    s.expedition!.chain = ["camp", "event", "encounter", "camp", "boss"];
    s.expedition!.at = 2;
    resolve(s, option("leader", { fork: { drop: 1, add: ["cache", "event"] } }));
    expect(s.expedition!.chain).toEqual(["camp", "event", "cache", "event", "camp", "boss"]);
    resolve(s, option("leader", { fork: { drop: 4 } }));
    expect(s.expedition!.chain).toEqual(["camp", "event", "boss"]);
  });
});

describe("secret events (Q91, Josh 2026-11-02)", () => {
  const meetHoard = (H: number) => {
    let s = underway(H);
    s.expedition!.chain = ["event", "boss"];
    s.expedition!.seen = TRIP_EVENTS.filter((d) => d.id !== "hoard_in_the_hollow").map((d) => d.id);
    s = move(s, "p1", { type: "press_on" });
    expect(s.expedition!.event!.id).toBe("hoard_in_the_hollow");
    return s;
  };

  it("hides the other Houses' picks until all are in", () => {
    let s = meetHoard(3);
    s = move(s, "p1", { type: "decide", option: 1 });
    expect(view(s, "p1").expedition!.event!.votes).toEqual([1, null, null]);
    expect(view(s, "p2").expedition!.event!.votes).toEqual([-2, null, null]);
  });

  it("each House's pick happens to its own Scions, and turns on what the others chose", () => {
    let s = meetHoard(3);
    const gold = s.houses.map((h) => h.gold);
    s = move(move(move(s, "p1", { type: "decide", option: 1 }), "p2", { type: "decide", option: 0 }), "p3", { type: "decide", option: 0 });
    expect(s.log.some((l) => l.startsWith("The choices are revealed"))).toBe(true);
    // House 0 alone took more: 60 gold; the others kept faith and lost their share.
    expect(s.houses.map((h, i) => h.gold - gold[i]!)).toEqual([60, 0, 0]);
    let t = meetHoard(2);
    const tg = t.houses.map((h) => h.gold);
    t = move(move(t, "p1", { type: "decide", option: 0 }), "p2", { type: "decide", option: 0 });
    expect(t.houses.map((h, i) => h.gold - tg[i]!)).toEqual([25, 25]);
    let u = meetHoard(2);
    const ug = u.houses.map((h) => h.gold);
    u = move(move(u, "p1", { type: "decide", option: 1 }), "p2", { type: "decide", option: 1 });
    expect(u.houses.map((h, i) => h.gold - ug[i]!)).toEqual([20, 20]);
  });
});

describe("blessings and House improvements (§9.4)", () => {
  it("a blessing is a trait held for a time: it fades at a later Reckoning", () => {
    let s = underway(1);
    const id = s.expedition!.leader!;
    const p = () => s.people.find((x) => x.id === id)!;
    p().traits = [];
    resolve(s, option("leader", { blessing: { trait: "lucky", years: 1 } }));
    expect(p().traits).toEqual(["lucky"]);
    s.expedition!.chain = ["event", "boss"];
    s = move(s, "p1", { type: "retreat" });
    expect([s.year, p().traits]).toEqual([2, ["lucky"]]);
    s = sealYear(s);
    expect(s.year).toBe(3);
    expect(p().traits).toEqual([]);
    expect(p().blessed).toBeUndefined();
    expect(s.log.some((l) => l.includes("blessing fades"))).toBe(true);
  });

  it("brings a recruit or a building's next level to the subject's House, or a better shop to everyone", () => {
    const s = underway(2);
    // Buildings count for Holdings, so both get one before the lower is found.
    for (const h of s.houses) h.buildings = { forge: 1 };
    const sub = subjects(s, "house:lowest_standing").house!;
    const recruits = s.people.filter((p) => p.host === sub && p.status === "recruit").length;
    resolve(s, option("house:lowest_standing", { house_improvement: "recruit" }, { house_improvement: "building" }));
    expect(s.people.filter((p) => p.host === sub && p.status === "recruit").length).toBe(recruits + 1);
    expect(s.houses[sub]!.buildings.forge).toBe(2);
    s.commons.built.armorer = 1;
    resolve(s, option("vote", { house_improvement: "shop" }));
    expect(stockTier(s, "armorer")).toBe(2);
  });
});

describe("the content and the bot", () => {
  it("names only real cards, traits, statuses and town events", () => {
    const houseTags = new Set(HOUSE_TRAITS.flatMap((t) => [t.id, ...(t.tags ?? [])]));
    const tags = new Set(TRAITS.flatMap((t) => [t.id, ...(t.tags ?? [])]));
    for (const d of TRIP_EVENTS)
      for (const o of d.options) {
        for (const r of o.rule.split("|")) {
          const [kind, a, b] = r.split(":");
          if (a === "tarot") expect(TAROT_BY_ID.has(b!), `${d.id}: ${r}`).toBe(true);
          if (a === "trait") expect((kind === "house" ? houseTags : tags).has(b!), `${d.id}: ${r}`).toBe(true);
        }
        for (const w of o.outcomes.flatMap((x) => (x.when ? [x.when.any ?? x.when.none] : []))) expect(d.options.map((x) => x.id), `${d.id}: when ${w}`).toContain(w);
        for (const fx of o.outcomes.flatMap((x) => x.effects)) {
          if (fx.trait) expect(TRAIT_BY_ID.has(fx.trait.slice(1)), `${d.id}: ${fx.trait}`).toBe(true);
          if (fx.blessing) expect(TRAIT_BY_ID.has(fx.blessing.trait), `${d.id}: ${fx.blessing.trait}`).toBe(true);
          if (fx.status) expect(STATUSES[fx.status], `${d.id}: ${fx.status}`).toBeDefined();
          if (fx.timeline) expect(TOWN_EVENT_BY_ID.has(fx.timeline.id), `${d.id}: ${fx.timeline.id}`).toBe(true);
        }
      }
  });

  it("tags every option of a choice for balancing (§9.5), and the bot takes the cautious one", () => {
    for (const d of TRIP_EVENTS) if (d.options.length > 1) for (const o of d.options) expect(o.tags?.length, `${d.id}.${o.id}`).toBeGreaterThan(0);
    const s = underway(1);
    s.expedition!.event = { id: "the_toll", votes: [null] };
    expect(g.botMove!(s, "p1", undefined as never)).toEqual({ type: "decide", option: 0 });
  });
});
