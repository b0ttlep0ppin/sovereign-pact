// The mandatory arc's stakes (§14.7): the Bastion of the Gate, the Court's raids, the Nest.
import { describe, expect, it } from "vitest";
import { ARC, arcResult, bastionFallBack, bastionShields, withRaid } from "./arc.ts";
import { encounter } from "./combat/encounter.ts";
import { projectCost } from "./commons.ts";
import { ENEMY_BY_ID } from "./content.ts";
import { muster } from "./expedition.ts";
import { home, partyOf, pressOn } from "./journey.ts";
import { createRng } from "../../rng.ts";
import type { ExpeditionCard, SovState } from "./state.ts";
import { calm, campaign } from "./testing.ts";
import { TUNING } from "./tuning.ts";

const A = TUNING.arc;

function assault(year: number, card: Partial<ExpeditionCard> = {}): SovState {
  const s = calm(campaign(2, 5));
  s.year = year;
  s.phase = "expedition";
  muster(s, { type: "mandatory", pool: "outer_dark", level: 8, size: 8, boss: "unknown_mother", ...card });
  const e = s.expedition!;
  e.party = [0, 1].map((h) => s.people.filter((p) => p.host === h && p.status === "scion").slice(0, 2).map((p) => p.id));
  e.leader = e.party[0]![0]!;
  return s;
}

describe("Year 5: the Tide at the Walls", () => {
  it("won, the Bastion of the Gate may be built; before, it cannot", () => {
    const s = assault(5);
    expect(projectCost(s, "bastion_of_the_gate")).toBeNull();
    arcResult(s, false);
    expect(projectCost(s, "bastion_of_the_gate")).toBeNull();
    arcResult(s, true);
    expect(s.flags).toContain(ARC.gateWon);
    expect(projectCost(s, "bastion_of_the_gate")).not.toBeNull();
  });

  it("the Bastion shields every Scion of the final assault, and lets it fall back once", () => {
    const s = assault(20);
    const scions = () => partyOf(s, s.expedition!.party.flat() as number[]);
    const none = scions();
    bastionShields(s, none);
    expect(none.some((u) => u.statuses.some((x) => x.id === "shield"))).toBe(false);
    expect(bastionFallBack(s)).toBe(false);
    s.commons.built.bastion_of_the_gate = 1;
    const shielded = scions();
    bastionShields(s, shielded);
    for (const u of shielded) expect(u.statuses.find((x) => x.id === "shield")?.value).toBe(Math.round((u.maxHp * A.bastionShieldPct) / 100));
    expect(bastionFallBack(s)).toBe(true);
    expect(bastionFallBack(s)).toBe(false);
  });

  it("not on any other expedition", () => {
    const s = assault(15);
    s.commons.built.bastion_of_the_gate = 1;
    const party = partyOf(s, s.expedition!.party.flat() as number[]);
    bastionShields(s, party);
    expect(party.some((u) => u.statuses.length)).toBe(false);
  });
});

describe("Year 10: the Hollow Court", () => {
  it("lost, every later chain gains one raid before its boss", () => {
    const s = assault(10, { pool: "barrows", level: 6, boss: "cursed_king" });
    expect(withRaid(s, ["event", "boss"])).toEqual(["event", "boss"]);
    arcResult(s, false);
    expect(s.flags).toContain(ARC.courtRaids);
    for (let i = 0; i < 20; i++) {
      const chain = withRaid(s, ["event", "encounter", "camp", "boss"]);
      expect(chain.filter((k) => k === "raid")).toHaveLength(1);
      expect(chain.at(-1)).toBe("boss");
    }
  });

  it("the raid is a fight, sent by the Court", () => {
    const s = assault(11, { type: "delve", pool: "beast_lands", level: 3, size: 4, boss: undefined });
    s.flags.push(ARC.courtRaids);
    s.expedition!.chain = ["raid", "boss"];
    pressOn(s);
    expect(s.log.some((l) => l.includes("knights ride"))).toBe(true);
    expect(s.log.some((l) => /wins a battle|falls before an encounter/.test(l))).toBe(true);
  });
});

describe("Year 15: the Nest", () => {
  it("lost: the Devastation's Doom is the Nest's, and the Unknown spread", () => {
    const s = assault(15);
    s.doom = 10;
    home(s, "wiped");
    expect(s.doom).toBe(10 + A.nestFailDoom);
    expect(s.flags).toContain(ARC.nestLost);
  });

  it("won: Doom falls", () => {
    const s = assault(15);
    s.doom = 50;
    home(s, "won");
    expect(s.doom).toBe(50 - A.nestWinDoom);
    expect(s.flags).not.toContain(ARC.nestLost);
  });

  it("once spread, the Outer Dark's fodder turns up in other pools' fights", () => {
    const from = (spread: boolean) =>
      Array.from({ length: 60 }, (_, i) => encounter(createRng(i + 1), { pool: "beast_lands", level: 3, party: 4, spread }).enemies)
        .flat()
        .map((u) => ENEMY_BY_ID.get(u.enemy!)?.pool);
    expect(from(false)).not.toContain("outer_dark");
    expect(from(true)).toContain("outer_dark");
  });
});
