// The Lost and their Rescue (§9.9): a Rescue card where they were left, home if it is won, dead after two Years.
import { describe, expect, it } from "vitest";
import { levelUp } from "./progression.ts";
import { muster } from "./expedition.ts";
import { botCard, offer } from "./gate.ts";
import type { SovState } from "./index.ts";
import { home, lose, lostClock } from "./journey.ts";
import { campaign } from "./testing.ts";


/** Two Houses; one Scion of each Lost in the Barrows at level 3 in Year 1. */
function lostTwo(): { s: SovState; ids: number[] } {
  const s = campaign(2, 4);
  s.phase = "expedition";
  muster(s, { type: "delve", pool: "barrows", level: 3, size: 4 });
  const ids = [0, 1].map((h) => s.people.find((p) => p.host === h && p.status === "scion")!.id);
  for (const id of ids) lose(s, s.people.find((p) => p.id === id)!);
  delete s.expedition;
  return { s, ids };
}

describe("the Lost (§9.9)", () => {
  it("are sought next Year on a Rescue card where they were left, beside the usual offer", () => {
    const { s, ids } = lostTwo();
    expect(s.people.find((p) => p.id === ids[0])!.lost).toEqual({ year: 1, pool: "barrows", level: 3 });
    s.year = 2;
    const cards = offer(s);
    expect({ ...cards[0], rescue: [...((cards[0] as { rescue?: number[] }).rescue ?? [])].sort((a, b) => a - b) }).toEqual({ type: "rescue", pool: "barrows", level: 3, size: 4, rescue: [...ids].sort((a, b) => a - b) });
    expect(cards.length).toBeGreaterThanOrEqual(3);
  });

  it("come home when their Rescue card is won", () => {
    const { s, ids } = lostTwo();
    s.year = 2;
    s.phase = "expedition";
    muster(s, offer(s)[0]!);
    s.expedition!.leader = s.people.find((p) => p.status === "scion")!.id;
    home(s, "won");
    for (const id of ids) {
      const p = s.people.find((x) => x.id === id)!;
      expect(p.status).toBe("scion");
      expect(p.lost).toBeUndefined();
    }
    expect(s.log.filter((l) => l.includes("found alive")).length).toBe(2);
  });

  it("are counted among the dead at the second Reckoning after they were left", () => {
    const { s, ids } = lostTwo();
    s.year = 2;
    lostClock(s);
    expect(s.people.filter((p) => ids.includes(p.id)).length).toBe(2);
    s.year = 3;
    lostClock(s);
    expect(s.people.filter((p) => ids.includes(p.id))).toEqual([]);
    expect(s.houses.map((h) => h.chronicle.at(-1)?.cause)).toEqual(["lost", "lost"]);
  });

  it("are looked for by a bot House that lost them, once its Scions can take the card", () => {
    const { s } = lostTwo();
    s.year = 2;
    s.gate = { cards: [...offer(s).slice(1), offer(s)[0]!], votes: [null, null] };
    // Level-1 Scions do not go after a level-3 Rescue (the bot is cautious).
    expect(s.gate.cards[botCard(s, 1)]!.type).not.toBe("rescue");
    for (const p of s.people) while (p.status === "scion" && p.level < 7) Object.assign(p, levelUp(p));
    expect(s.gate.cards[botCard(s, 1)]!.type).toBe("rescue");
  });
});
