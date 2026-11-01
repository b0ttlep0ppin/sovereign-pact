// Checkpoint saves (§4.4): when they are taken, that they continue the campaign, that bad ones start a
// new game, and that a whole campaign's worst checkpoint fits Vibe Pulse's 64 KB.
import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { SAVE_MAX_BYTES } from "../../saves.ts";
import { sovereignPact, type SovState } from "./index.ts";
import { packItems, packPeople, unpackItems, unpackPeople } from "./codec.ts";
import { ITEM_BASES } from "./content.ts";
import { GEAR_SLOTS } from "./state.ts";
import type { SovSave } from "./save.ts";
import { campaign, playOut, seats } from "./testing.ts";
import { TUNING } from "./tuning.ts";

const g = sovereignPact;
const bytes = (x: unknown): number => new TextEncoder().encode(JSON.stringify(x)).length;

function sealAll(s: SovState): SovState {
  for (const p of s.players) {
    const r = g.applyMove(s, p, { type: "seal" });
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  }
  return s;
}

describe("the packed people", () => {
  it("unpack to exactly the people that were packed", () => {
    const s = playOut(campaign(4, 9));
    s.people[0] = { ...s.people[0]!, secondary: "knight", reversed: true, aff: { fire: 20 }, loyalty: 40, gear: { main: 3, acc2: 9 }, hist: { kills: 4, sorties: 1 } };
    s.people[1] = { ...s.people[1]!, injuries: [{ id: "body_broken_ribs", years: 2 }], jp: { magus: 120, soldier: 2500 }, mastered: ["soldier"] };
    expect(unpackPeople(JSON.parse(JSON.stringify(packPeople(s.people))))).toEqual(s.people);
  });

  it("and the packed items unpack to the items", () => {
    const s = campaign(2);
    s.items.push({ id: 900, base: "axe", tier: 4, ilvl: 6, house: 1, props: [["keen", 10], ["bleeding", 25]], dented: 1, cursed: true, named: "widows_kiss" });
    expect(s.items.length).toBeGreaterThan(1);
    expect(unpackItems(JSON.parse(JSON.stringify(packItems(s.items))))).toEqual(s.items);
  });
});

describe("checkpoint", () => {
  it("is the Settlement Phase's first state, and nothing after anyone moves", () => {
    const s = campaign(2);
    const save = g.checkpoint!(s);
    expect(save).not.toBeNull();
    const moved = g.applyMove(s, "p1", { type: "seal" });
    expect(moved.ok && g.checkpoint!(moved.state)).toBeNull();
    expect(g.checkpoint!(sealAll(s))!.campaign.year).toBe(2);
  });

  it("holds no player ids and no log", () => {
    const save = g.checkpoint!(campaign(4))!;
    const text = JSON.stringify(save);
    for (const p of seats(4)) expect(text).not.toContain(`"${p}"`);
    expect(save.campaign).not.toHaveProperty("players");
    expect(save.campaign).not.toHaveProperty("log");
  });

  it("continues the same campaign for whoever sits down, and replays the same", () => {
    const s = sealAll(campaign(3, 5));
    const save = JSON.parse(JSON.stringify(g.checkpoint!(s))) as SovSave;
    const resumed = g.setup(["a", "b", "c"], createRng(999), undefined, undefined, save);
    expect(resumed.year).toBe(2);
    expect(resumed.players).toEqual(["a", "b", "c"]);
    expect(resumed.houses).toEqual(s.houses);
    expect(resumed.people).toEqual(s.people);
    // The RNG carries on from the save, so the rest of the campaign plays out identically.
    const strip = (x: SovState) => ({ ...x, players: [], log: [] });
    expect(strip(playOut(resumed))).toEqual(strip(playOut({ ...s, players: ["a", "b", "c"] })));
  });

  it("describes itself in one line", () => {
    const save = g.checkpoint!(campaign(2, 11))!;
    const [a, b] = save.campaign.houses.map((h) => h.name);
    expect(g.describeSave!(save)).toBe(`Houses ${a} and ${b}, Year 1 of 20, Accord ${TUNING.tracks.accordStart}, Doom 0`);
    expect(g.describeSave!(g.checkpoint!(campaign(1))!)).toMatch(/^House \w+, Year 1 of 20, Unrest/);
  });

  it.each([
    ["nothing", undefined],
    ["junk", "junk"],
    ["another game", { v: 1, game: "chess", campaign: {} }],
    ["another version", { v: 99, game: "sovereign-pact", campaign: {} }],
    ["a broken campaign", { v: 1, game: "sovereign-pact", campaign: { v: 1, houses: "x" } }],
  ])("starts a new campaign from %s", (_, save) => {
    const s = g.setup(seats(2), createRng(1), undefined, undefined, save);
    expect(s.year).toBe(1);
    expect(s.houses).toHaveLength(2);
  });

  it("starts a new campaign when the save has a different number of Houses than seats", () => {
    const save = g.checkpoint!(campaign(3))!;
    const s = g.setup(seats(2), createRng(1), undefined, undefined, save);
    expect(s.houses).toHaveLength(2);
    expect(s.year).toBe(1);
  });
});

describe("save size (HANDOFF §7: a 20-Year, 4-House campaign stays under 64 KB)", () => {
  it("keeps every checkpoint of a bot campaign under the limit", () => {
    let worst = 0;
    playOut(campaign(4, 3), (s) => {
      const save = g.checkpoint!(s);
      if (save) worst = Math.max(worst, bytes(save));
    });
    expect(worst).toBeGreaterThan(0);
    expect(worst).toBeLessThan(SAVE_MAX_BYTES);
  });

  // A late campaign at its fullest, so later milestones see their margin shrink here first: four Houses
  // with full recruit pools, a dozen veteran Scions each with two Jobs mastered and a third under way,
  // scars, gear, a long Chronicle and a crowded timeline. Content ids come from pools the size the
  // spec's content will be (14 Jobs × ~20 abilities, ~60 traits, LPC layers).
  it("leaves room in a crowded Year-20 checkpoint", () => {
    const s = playOut(campaign(4, 3), undefined, 0);
    const rng = createRng(77);
    const pool = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}_${i.toString(36)}_${"x".repeat(6)}`);
    const abilities = pool("ability", 280);
    const traits = pool("trait", 60);
    const layers = pool("lpc_layer", 90);
    const some = (from: string[], n: number) => rng.shuffle(from).slice(0, n);
    // Items as the late game holds them: Fine to Relic, each with 1–3 rolled properties (§13.4).
    const props = pool("prop", 70);
    const bases = ITEM_BASES.map((b) => b.id);
    const item = (house: number) => {
      const tier = (3 + rng.int(3)) as 3 | 4 | 5;
      s.items.push({ id: s.nextId, base: rng.pick(bases), tier, ilvl: 8, house, props: some(props, tier - 2).map((id) => [id, 5 + rng.int(30)]) });
      return s.nextId++;
    };
    for (let h = 0; h < 4; h++) {
      for (let n = 0; n < 12; n++) {
        const veteran = { ...s.people.find((p) => p.status === "scion")! };
        Object.assign(veteran, {
          id: s.nextId++,
          house: h,
          host: (h + (n === 0 ? 1 : 0)) % 4,
          status: n < 10 ? "scion" : "retired",
          level: 24,
          xp: 18_250,
          job: "sword_saint",
          secondary: "knight",
          jp: { soldier: 2500, knight: 2500, sword_saint: 1840, magus: 210 },
          mastered: ["soldier", "knight"],
          learned: some(abilities, 14),
          passives: some(abilities, 7),
          traits: [...some(traits, 3), "veteran_of_the_rift"],
          look: some(layers, 10),
          injuries: [{ id: "head_lost_eye", years: -1 }, { id: "legs_torn_knee", years: 2 }],
          gear: Object.fromEntries(GEAR_SLOTS.map((slot) => [slot, item(h)])),
          hist: { kills: 312, expeditions: 14, healing: 4200, targeted: 640, led: 4, devastating: 2, sorties: 6, bosses: 5 },
          aff: { fire: 20, water: -20 },
          loyalty: n === 0 ? 63 : undefined,
        });
        s.people.push(veteran);
      }
      while (s.people.filter((p) => p.host === h && p.status === "recruit").length < TUNING.houses.recruitPoolCap) {
        s.people.push({ ...s.people.find((p) => p.status === "recruit")!, id: s.nextId++, host: h, house: h, traits: some(traits, 3), look: some(layers, 8) });
      }
      for (let n = 0; n < 16; n++) item(h);
      const house = s.houses[h]!;
      house.traits = some(traits, 6);
      house.buildings = Object.fromEntries(pool("building", 13).map((b) => [b, 3]));
      house.stores = { grain: 120, timber: 340, stone: 210, iron: 95, essence: 44, wyrmbone: 2, moonsilver: 1, voidglass: 3 };
      house.chronicle = Array.from({ length: 16 }, () => ({ name: "Esclarmonde", year: 12, cause: rng.pick(abilities), level: 17 }));
    }
    s.timeline.push(...pool("event", 30).map((id, i) => ({ year: 1 + (i % 20), id, house: i % 4 })));
    s.flags.push(...pool("flag", 80));
    s.year = 20;
    const size = bytes(g.checkpoint!(s));
    console.info(`Crowded Year-20 checkpoint: ${(size / 1024).toFixed(1)} KB of ${SAVE_MAX_BYTES / 1024} KB`);
    // Items, the bestiary and expedition records still have to fit in what is left (Milestones 2–7).
    expect(size).toBeLessThan(SAVE_MAX_BYTES * 0.75);
  });
});
