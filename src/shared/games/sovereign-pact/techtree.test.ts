// The Commons tech tree (Josh 2026-11-03: "commons only buildings have tech tree effects"): projects whose
// levels every Scion carries into battle, each branch waiting on the one before it.
import { afterEach, describe, expect, it } from "vitest";
import type { Rng } from "../../rng.ts";
import { scionCombatant, newBattle } from "./combat/build.ts";
import { standardParty } from "./combat/fixtures.ts";
import { baseSteps, injure } from "./combat/injury.ts";
import { commonsMods, projectCost } from "./commons.ts";
import { restock } from "./market.ts";
import { calm, campaign, sealYear } from "./testing.ts";
import { TUNING } from "./tuning.ts";
import { foretell } from "./year.ts";

const loaded = (...xs: number[]): Rng => ({ int: () => xs.shift() ?? 10, next: () => 0.5, pick: (a) => a[0]!, shuffle: (a) => [...a], seed: () => 1 });

describe("the Commons tech tree: the Flesh branch", () => {
  it("waits on the project before it", () => {
    const s = campaign(2, 4);
    s.commons.built = {};
    expect(projectCost(s, "armour_of_the_pact")).not.toBeNull();
    expect(projectCost(s, "bonesetters_hall")).toBeNull();
    s.commons.built.armour_of_the_pact = 1;
    expect(projectCost(s, "bonesetters_hall")).not.toBeNull();
    expect(projectCost(s, "the_last_rite")).toBeNull();
    s.commons.built.bonesetters_hall = 1;
    expect(projectCost(s, "the_last_rite")).not.toBeNull();
  });

  it("gives every Scion Durability by the Armour's level, and a step on injury rolls from the Bonesetters", () => {
    const s = campaign(1, 4);
    s.commons.built = {};
    const p = s.people.find((x) => x.status === "scion")!;
    // No traits of their own to round against (Glass Jaw's Head −25%…).
    p.traits = [];
    const plain = scionCombatant(p, { id: 1, col: 0, row: 0 });
    s.commons.built = { armour_of_the_pact: 2, bonesetters_hall: 1 };
    const fitted = scionCombatant(p, { id: 1, col: 0, row: 0, commons: commonsMods(s) });
    for (const loc of ["head", "body", "arms", "legs"] as const) expect(fitted.maxDur![loc]).toBe(Math.max(1, Math.floor(plain.maxDur![loc] * 1.2)));
    expect(baseSteps(fitted, "body")).toBe(baseSteps(plain, "body") + 1);
  });

  it("turns one killing blow in a Scion's life into a severed arm, and only one", () => {
    const [u0] = standardParty(1, 6, 1);
    const u = { ...u0!, person: 1, resilience: 0, steps: 0, mods: { ...u0!.mods, lastRite: 1 } };
    const b = newBattle(3, [u]);
    expect(injure(b, loaded(1), b.units[0]!, "body", 0).id).toBe("arms_severed");
    expect(b.units[0]!.lastStand).toBeFalsy();
    expect(b.events.find((e) => e.t === "injury")).toMatchObject({ table: "arms", rite: true });
    expect(injure(b, loaded(1), b.units[0]!, "body", 0).id).toBe("body_mortal_wound");
  });

  it("is not carried by a Scion the Rite has already saved", () => {
    const s = campaign(1, 4);
    s.commons.built = { armour_of_the_pact: 1, bonesetters_hall: 1, the_last_rite: 1 };
    const p = s.people.find((x) => x.status === "scion")!;
    expect(scionCombatant(p, { id: 1, col: 0, row: 0, commons: commonsMods(s) }).mods.lastRite).toBe(1);
    expect(scionCombatant({ ...p, rite: true }, { id: 1, col: 0, row: 0, commons: commonsMods(s) }).mods.lastRite).toBeUndefined();
  });
});

describe("the Commons tech tree: the Fortune branch", () => {
  afterEach(() => Object.assign(TUNING.commons, { assayPct: 15, saviorPct: 6 }));

  it("waits on the Great Market, then the Assayers", () => {
    const s = campaign(2, 4);
    s.commons.built = {};
    expect(projectCost(s, "rift_assayers")).toBeNull();
    s.commons.built.great_market = 1;
    expect(projectCost(s, "rift_assayers")).not.toBeNull();
    expect(projectCost(s, "bell_of_saviours")).toBeNull();
    s.commons.built.rift_assayers = 1;
    expect(projectCost(s, "bell_of_saviours")).not.toBeNull();
  });

  it("has the Assayers find shop lots a tier finer, never past Masterwork", () => {
    const s = campaign(2, 4);
    s.commons.built = { great_market: 1, armorer: 1, weaponsmith: 1 };
    restock(s);
    const plain = s.market.map((l) => l.item.tier);
    expect(plain.some((t) => t < 3)).toBe(true);
    (TUNING.commons as { assayPct: number }).assayPct = 100;
    s.commons.built.rift_assayers = 1;
    restock(s);
    expect(s.market.every((l) => l.item.tier >= 3 && l.item.tier <= 4)).toBe(true);
  });

  it("makes one of the Foretold a prodigy, stronger in all but Speed", () => {
    const p = campaign(1, 4).people.find((x) => x.status === "recruit") ?? campaign(1, 4).people[0]!;
    const q = structuredClone(p);
    foretell(q);
    expect(q.foretold).toBe(true);
    expect(q.potential).toBe("prodigy");
    for (let i = 0; i < 5; i++) expect(q.base[i]).toBe(p.base[i]! + TUNING.commons.saviorStat);
    expect(q.base[5]).toBe(p.base[5]);
  });

  it("rings the Foretold in among the arrivals once the Bell stands", () => {
    (TUNING.commons as { saviorPct: number }).saviorPct = 100;
    let s = calm(campaign(1, 4));
    s.commons.built = { great_market: 1, rift_assayers: 1, bell_of_saviours: 1 };
    // An empty recruit pool, so nobody is turned away.
    s.people = s.people.filter((p) => p.status !== "recruit");
    const before = new Set(s.people.map((p) => p.id));
    for (let y = 0; y < 4; y++) s = sealYear(s);
    const arrived = s.people.filter((p) => !before.has(p.id));
    expect(arrived.length).toBeGreaterThan(0);
    expect(arrived.every((p) => p.foretold)).toBe(true);
  });
});
