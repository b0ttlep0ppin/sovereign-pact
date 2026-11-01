import { describe, expect, it } from "vitest";
import { botAssign } from "./bot.ts";
import { maxSanity } from "./formulas.ts";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import type { Person } from "./state.ts";
import { calm, campaign, playOut } from "./testing.ts";
import { TUNING } from "./tuning.ts";

const g = sovereignPact;
const A = TUNING.assignments;

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
/** Seals the solo House: the Year turns over. */
const seal = (s: SovState): SovState => move(s, "p1", { type: "seal" });
const scions = (s: SovState) => s.people.filter((p) => p.host === 0 && p.status === "scion");
const person = (s: SovState, id: number): Person => s.people.find((p) => p.id === id)!;

describe("Year assignments (§8.3)", () => {
  it("rests for +25% Sanity, idles for +10%, and the Chapel building adds its own", () => {
    let s = calm(campaign(1, 5));
    const [a, b] = scions(s);
    for (const p of [a!, b!]) p.sanity = 0;
    s = move(s, "p1", { type: "assign", person: a!.id, to: "rest" });
    s = seal(s);
    expect(person(s, a!.id).sanity).toBe(Math.ceil((maxSanity(a!) * A.restSanityPct) / 100));
    expect(person(s, b!.id).sanity).toBe(Math.ceil((maxSanity(b!) * A.idleSanityPct) / 100));
    s.houses[0]!.buildings.chapel = 1;
    person(s, b!.id).sanity = 0;
    s = seal(s);
    expect(person(s, b!.id).sanity).toBe(Math.ceil((maxSanity(b!) * (A.idleSanityPct + A.chapelBuildingSanityPct)) / 100));
  });

  it("keeps an assignment from Year to Year until changed", () => {
    let s = calm(campaign(1, 5));
    const a = scions(s)[0]!;
    s = seal(move(s, "p1", { type: "assign", person: a.id, to: "guard" }));
    expect(s.assign[a.id]).toEqual({ to: "guard" });
    s = move(s, "p1", { type: "assign", person: a.id, to: "idle" });
    expect(s.assign[a.id]).toBeUndefined();
  });

  it("opens slots by building level", () => {
    let s = calm(campaign(1, 5));
    const [a, b, c] = scions(s);
    expect(error(s, "p1", { type: "assign", person: a!.id, to: "chapel" })).toMatch(/no free slot/);
    s.houses[0]!.buildings.chapel = 1;
    s = move(s, "p1", { type: "assign", person: a!.id, to: "chapel" });
    s = move(s, "p1", { type: "assign", person: b!.id, to: "chapel" });
    expect(error(s, "p1", { type: "assign", person: c!.id, to: "chapel" })).toMatch(/no free slot/);
    // Assigning the same thing again is not a second slot.
    s = move(s, "p1", { type: "assign", person: a!.id, to: "chapel" });
    expect(error(s, "p1", { type: "assign", person: a!.id, to: "work", at: "farm" })).toMatch(/no free slot/);
  });

  it("restores Sanity fully and cures a Moderate sanity result in the Chapel", () => {
    let s = calm(campaign(1, 5));
    s.houses[0]!.buildings.chapel = 1;
    const a = scions(s)[0]!;
    a.sanity = 1;
    a.injuries = [{ id: "sanity_night_terrors", years: 3 }];
    s = seal(move(s, "p1", { type: "assign", person: a.id, to: "chapel" }));
    expect(person(s, a.id).sanity).toBe(maxSanity(a));
    expect(person(s, a.id).injuries).toEqual([]);
  });

  it("heals the longest Moderate injury a Year faster in the Infirmary", () => {
    let s = calm(campaign(1, 5));
    s.houses[0]!.buildings.infirmary = 1;
    const a = scions(s)[0]!;
    a.injuries = [
      { id: "arms_broken_arm", years: 3 },
      { id: "arms_sprained", years: 2 },
      { id: "head_lost_eye", years: -1 },
    ];
    s = seal(move(s, "p1", { type: "assign", person: a.id, to: "infirmary" }));
    expect(person(s, a.id).injuries).toEqual([
      { id: "arms_broken_arm", years: 1 },
      { id: "arms_sprained", years: 1 },
      { id: "head_lost_eye", years: -1 },
    ]);
  });

  it("adds a worker's output to a producer", () => {
    let s = calm(campaign(1, 5));
    s.houses[0]!.buildings.quarry = 1;
    const r = s.people.find((p) => p.host === 0 && p.status === "recruit")!;
    const stone = s.houses[0]!.stores.stone!;
    s = seal(move(s, "p1", { type: "assign", person: r.id, to: "work", at: "quarry" }));
    const made = TUNING.town.produce[0]! + A.work;
    expect(s.houses[0]!.stores.stone).toBe(stone + made - Math.round(made * TUNING.economy.tithe));
    expect(error(s, "p1", { type: "assign", person: r.id, to: "chapel" })).toMatch(/recruit/);
  });

  it("refuses a Mentor who is not teaching, a Job they have not mastered, and a third student", () => {
    let s = calm(campaign(1, 5));
    s.houses[0]!.buildings.training_ground = 1;
    const [mentor, a, b, c] = scions(s);
    Object.assign(mentor!, { status: "retired", level: 8, mastered: ["soldier"] });
    expect(error(s, "p1", { type: "assign", person: a!.id, to: "train", mentor: mentor!.id, job: "soldier" })).toMatch(/not teaching/);
    s = move(s, "p1", { type: "assign", person: mentor!.id, to: "teach" });
    expect(error(s, "p1", { type: "assign", person: a!.id, to: "train", mentor: mentor!.id, job: "magus" })).toMatch(/mastered/);
    s = move(s, "p1", { type: "assign", person: a!.id, to: "train", mentor: mentor!.id, job: "soldier" });
    s = move(s, "p1", { type: "assign", person: b!.id, to: "train", mentor: mentor!.id, job: "soldier" });
    expect(error(s, "p1", { type: "assign", person: c!.id, to: "train" })).toMatch(/no free slot/);
    const before = person(s, a!.id);
    s = seal(s);
    const after = person(s, a!.id);
    expect(after.jp.soldier).toBe((before.jp.soldier ?? 0) + A.mentorJp);
    expect(after.level).toBeLessThan(8);
    expect(after.level * 100 + after.xp).toBeGreaterThan(before.level * 100 + before.xp);
    // A Mentor who stops teaching leaves the students training alone.
    s = move(s, "p1", { type: "assign", person: mentor!.id, to: "rest" });
    expect(s.assign[a!.id]).toEqual({ to: "train" });
  });

  it("caps training XP one level below the Mentor (§6.6)", () => {
    let s = calm(campaign(1, 5));
    s.houses[0]!.buildings.training_ground = 1;
    const [mentor, a] = scions(s);
    Object.assign(mentor!, { status: "retired", level: 2, mastered: ["soldier"] });
    s = move(s, "p1", { type: "assign", person: mentor!.id, to: "teach" });
    s = move(s, "p1", { type: "assign", person: a!.id, to: "train", mentor: mentor!.id, job: "soldier" });
    for (let y = 0; y < 5; y++) s = seal(s);
    expect(person(s, a!.id).level).toBe(1);
  });
});

describe("the settlement bot assigns", () => {
  it("fills slots without overfilling them, over whole campaigns", () => {
    for (const H of [1, 3]) {
      playOut(campaign(H, 7), (s) => {
        if (s.phase !== "settlement") return;
        for (let i = 0; i < H; i++) {
          const chapel = s.people.filter((p) => p.host === i && s.assign[p.id]?.to === "chapel").length;
          expect(chapel).toBeLessThanOrEqual(s.houses[i]!.buildings.chapel ? A.chapelSlots[s.houses[i]!.buildings.chapel! - 1]! : 0);
        }
      });
    }
  });

  it("settles on its plan: once applied, it has nothing more to change", () => {
    let s = calm(campaign(1, 9));
    s.houses[0]!.buildings = { training_ground: 1, infirmary: 1, quarry: 1 };
    for (let i = 0; i < 50; i++) {
      const m = botAssign(s, 0);
      if (!m) break;
      s = move(s, "p1", { type: "assign", ...m });
    }
    expect(botAssign(s, 0)).toBeNull();
    expect(Object.values(s.assign).some((a) => a.to === "work")).toBe(true);
    expect(Object.values(s.assign).filter((a) => a.to === "train").length).toBe(A.studentsPerSeat);
  });
});
