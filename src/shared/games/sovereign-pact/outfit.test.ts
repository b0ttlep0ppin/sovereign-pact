// Readying Scions in town (§12.1, §13.1): abilities bought with JP, Jobs, passives and gear.
import { describe, expect, it } from "vitest";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { itemById, mint, stash } from "./items.ts";
import { botOutfit } from "./outfit.ts";
import { gainJp, jpLeft, knows } from "./progression.ts";
import type { Person } from "./state.ts";
import { calm, campaign } from "./testing.ts";

const g = sovereignPact;
const move = (s: SovState, player: string, m: SovMove): SovState => {
  const r = g.applyMove(s, player, m);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const refuse = (s: SovState, player: string, m: SovMove): string => {
  const r = g.applyMove(s, player, m);
  if (r.ok) throw new Error(`${m.type} was allowed`);
  return r.error;
};

/** A calm Year 1 with House 0's first Scion made a Soldier holding `jp` Soldier JP. */
function town(jp = 0): { s: SovState; p: Person } {
  const s = calm(campaign(2, 3));
  const i = s.people.findIndex((x) => x.host === 0 && x.status === "scion");
  s.people[i] = gainJp({ ...s.people[i]!, job: "soldier", jp: { soldier: 0 }, learned: [], passives: [], secondary: undefined }, jp, "soldier");
  return { s, p: s.people[i]! };
}
const who = (s: SovState, id: number) => s.people.find((x) => x.id === id)!;

describe("buying abilities", () => {
  it("spends the primary Job's JP", () => {
    const { s, p } = town(120);
    const t = move(s, "p1", { type: "learn", person: p.id, ability: "heavy_blow" });
    expect(knows(who(t, p.id), "heavy_blow")).toBe(true);
    expect(jpLeft(who(t, p.id), "soldier")).toBe(70);
    expect(refuse(t, "p1", { type: "learn", person: p.id, ability: "savage_strikes" })).toMatch(/costs 150 JP/);
    expect(refuse(t, "p1", { type: "learn", person: p.id, ability: "heavy_blow" })).toMatch(/already knows/);
    expect(refuse(t, "p1", { type: "learn", person: p.id, ability: "ember" })).toMatch(/primary Job/);
  });

  it("only for the House's own Scions, only in the Settlement Phase, and not once sealed", () => {
    const { s, p } = town(500);
    expect(refuse(s, "p2", { type: "learn", person: p.id, ability: "heavy_blow" })).toMatch(/own Scions/);
    const sealed = move(s, "p1", { type: "seal" });
    expect(refuse(sealed, "p1", { type: "learn", person: p.id, ability: "heavy_blow" })).toMatch(/Unseal/);
    const away = structuredClone(s);
    away.phase = "expedition";
    expect(refuse(away, "p1", { type: "learn", person: p.id, ability: "heavy_blow" })).toMatch(/locked until the expedition returns/);
  });
});

describe("Jobs and passives", () => {
  it("changes Job, sending back to the stash what the new Job may not wear", () => {
    const { s, p } = town();
    const sword = mint(s, "sword", 0, 2);
    s.people.find((x) => x.id === p.id)!.gear = { main: sword.id };
    const t = move(s, "p1", { type: "take_job", person: p.id, job: "magus" });
    expect(who(t, p.id).job).toBe("magus");
    expect(who(t, p.id).gear.main).toBeUndefined();
    expect(stash(t, 0).map((i) => i.id)).toContain(sword.id);
    expect(refuse(t, "p1", { type: "take_job", person: p.id, job: "sword_saint" })).toMatch(/cannot take that Job/);
  });

  it("sets a secondary set only from a Job with an active bought", () => {
    const { s, p } = town(60);
    let t = move(s, "p1", { type: "learn", person: p.id, ability: "heavy_blow" });
    t = move(t, "p1", { type: "take_job", person: p.id, job: "knight" });
    expect(refuse(t, "p1", { type: "secondary", person: p.id, job: "magus" })).toMatch(/knows none/);
    t = move(t, "p1", { type: "secondary", person: p.id, job: "soldier" });
    expect(who(t, p.id).secondary).toBe("soldier");
    t = move(t, "p1", { type: "secondary", person: p.id, job: null });
    expect(who(t, p.id).secondary).toBeUndefined();
  });

  it("equips bought passives within the budget", () => {
    const { s, p } = town(2000);
    let t = s;
    for (const a of ["skullsplitter", "grizzled", "veteran", "weapon_drill"]) t = move(t, "p1", { type: "learn", person: p.id, ability: a });
    expect(refuse(t, "p1", { type: "passive", person: p.id, ability: "ember", on: true })).toMatch(/not bought/);
    t = move(t, "p1", { type: "passive", person: p.id, ability: "skullsplitter", on: true });
    t = move(t, "p1", { type: "passive", person: p.id, ability: "grizzled", on: true });
    // 4 of 5 points used: a 2-point passive no longer fits, a 1-point one does.
    expect(refuse(t, "p1", { type: "passive", person: p.id, ability: "veteran", on: true })).toMatch(/budget/);
    t = move(t, "p1", { type: "passive", person: p.id, ability: "weapon_drill", on: true });
    t = move(t, "p1", { type: "passive", person: p.id, ability: "grizzled", on: false });
    expect(who(t, p.id).passives).toEqual(["skullsplitter", "weapon_drill"]);
  });
});

describe("gear", () => {
  it("puts the House's own gear on, and takes it off", () => {
    const { s, p } = town();
    const mine = mint(s, "spear", 0, 3);
    const theirs = mint(s, "spear", 1, 3);
    expect(refuse(s, "p1", { type: "equip", person: p.id, item: theirs.id, slot: "main" })).toMatch(/not this House's/);
    expect(refuse(s, "p1", { type: "equip", person: p.id, item: mine.id, slot: "head" })).toMatch(/wrong slot/);
    let t = move(s, "p1", { type: "equip", person: p.id, item: mine.id, slot: "main" });
    expect(who(t, p.id).gear.main).toBe(mine.id);
    t = move(t, "p1", { type: "unequip", person: p.id, slot: "main" });
    expect(who(t, p.id).gear.main).toBeUndefined();
    expect(refuse(t, "p1", { type: "unequip", person: p.id, slot: "main" })).toMatch(/Nothing is worn/);
  });

  it("a cursed item will not come off, nor be put over", () => {
    const { s, p } = town();
    const cursed = mint(s, "sword", 0, 3);
    cursed.cursed = true;
    s.people.find((x) => x.id === p.id)!.gear = { main: cursed.id };
    expect(refuse(s, "p1", { type: "unequip", person: p.id, slot: "main" })).toMatch(/cursed/);
    const other = mint(s, "sword", 0, 4);
    expect(refuse(s, "p1", { type: "equip", person: p.id, item: other.id, slot: "main" })).toMatch(/cursed/);
  });
});

describe("the view's kit", () => {
  it("shows a House its own Scions' JP, abilities, Jobs and the gear that fits, and no one else's", () => {
    const { s, p } = town(120);
    const t = move(s, "p1", { type: "learn", person: p.id, ability: "heavy_blow" });
    const spear = mint(t, "spear", 0, 3);
    const kit = g.view(t, "p1").people.find((x) => x.id === p.id)!.kit!;
    expect(kit.jp.soldier).toBe(70);
    expect(kit.known).toContain("heavy_blow");
    expect(kit.jobs).toContain("magus");
    expect(kit.jobs).not.toContain("soldier");
    expect(kit.fits).toContainEqual([spear.id, "main"]);
    expect(kit.fits).not.toContainEqual([spear.id, "head"]);
    expect(kit.budget).toBeGreaterThanOrEqual(5);
    expect(g.view(t, "p2").people.find((x) => x.id === p.id)!.kit).toBeUndefined();
  });
});

describe("the bot", () => {
  it("spends its JP, equips its passives and wears the best of its stash, then stops", () => {
    const { s, p } = town(1500);
    const fine = mint(s, "sword", 0, 3, 2);
    let t = s;
    for (let i = 0; i < 100; i++) {
      const m = botOutfit(t, 0);
      if (!m) break;
      t = move(t, "p1", m);
    }
    expect(botOutfit(t, 0)).toBeNull();
    const q = who(t, p.id);
    expect(q.learned.length).toBeGreaterThan(2);
    expect(q.passives.length).toBeGreaterThan(0);
    expect(jpLeft(q, "soldier")).toBeLessThan(400);
    expect(t.people.some((x) => x.host === 0 && x.gear.main === fine.id)).toBe(true);
    expect(itemById(t, q.gear.main)!.tier).toBeGreaterThanOrEqual(1);
  });

  it("readies its Scions as part of a Settlement Phase", () => {
    const { s } = town(400);
    let t = s;
    const seen: string[] = [];
    for (let i = 0; i < 60 && !t.houses[0]!.sealed; i++) {
      const m = g.botMove!(t, "p1", undefined as never);
      seen.push(m.type);
      t = move(t, "p1", m);
    }
    expect(seen).toContain("learn");
  });
});
