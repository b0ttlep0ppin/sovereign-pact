// The Gate's Reflection (§9.7, §14.7, §14.7a): the final chain's last place before the boss. Each House in
// the party is offered the last Dark Bargain, and each Scion may look into the Gate and see their House's future.
import { describe, expect, it } from "vitest";
import { BARGAIN_BY_ID, TRIP_EVENT_BY_ID } from "./content.ts";
import { drawEvent, present } from "./events.ts";
import { muster, waiting } from "./expedition.ts";
import { sovereignPact as g } from "./index.ts";
import { pressOn, rollChain } from "./journey.ts";
import { ascendancy } from "./score.ts";
import type { ExpeditionCard, SovState } from "./state.ts";
import { calm, campaign } from "./testing.ts";
import { TUNING } from "./tuning.ts";
import { clone } from "./year.ts";

function finale(year = 20, card: Partial<ExpeditionCard> = {}): SovState {
  const s = calm(campaign(2, 4));
  s.year = year;
  s.phase = "expedition";
  muster(s, { type: "mandatory", pool: "outer_dark", level: 10, size: 8, boss: "end_ruler", ...card });
  const e = s.expedition!;
  e.party = [0, 1].map((h) => s.people.filter((p) => p.host === h && p.status === "scion").slice(0, 2).map((p) => p.id));
  e.leader = e.party[0]![0]!;
  return s;
}
/** At the Reflection, with the boss next. */
function atGlass(): SovState {
  const s = finale();
  s.expedition!.chain = ["reflection", "boss"];
  pressOn(s);
  return s;
}
const after = (r: ReturnType<typeof g.applyMove>): SovState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

describe("the final chain", () => {
  it("ends with the Reflection just before the boss, only in the final Year", () => {
    const chain = rollChain(finale());
    expect(chain.slice(-2)).toEqual(["reflection", "boss"]);
    expect(rollChain(finale(15, { boss: "unknown_mother", level: 8 }))).not.toContain("reflection");
    expect(rollChain(finale(20, { type: "delve" }))).not.toContain("reflection");
  });

  it("the Reflection is never met by chance", () => {
    const s = finale(12, { type: "delve" });
    for (let i = 0; i < 50; i++) expect(drawEvent(s)?.id).not.toBe(TUNING.arc.reflectionEvent);
    expect(TRIP_EVENT_BY_ID.get(TUNING.arc.reflectionEvent)!.pools).toEqual(["reflection"]);
  });
});

describe("at the glass", () => {
  it("each House in the party is offered the last bargain, always with a Pact mark, and the party waits on it", () => {
    const s = atGlass();
    expect(s.expedition!.event!.id).toBe("gates_reflection");
    const pending = s.bargains.pending;
    expect(pending.map((b) => b.house).sort()).toEqual(present(s));
    for (const b of pending) expect(BARGAIN_BY_ID.get(b.id)).toMatchObject({ when: ["reflection"], mark: 100 });
    delete s.expedition!.event;
    expect(waiting(s)).toEqual(present(s));
    expect(g.applyMove(clone(s), s.players[0]!, { type: "press_on" })).toMatchObject({ ok: false });
  });

  it("accepted in the expedition, the bargain is paid at once and marks the House", () => {
    const s = atGlass();
    const b = s.bargains.pending.find((x) => x.house === 0)!;
    const t = after(g.applyMove(s, s.players[0]!, { type: "bargain", id: b.id, accept: true, ...(BARGAIN_BY_ID.get(b.id)!.bane ? { target: 1 } : {}) }));
    expect(t.houses[0]!.pactMarks).toBe(1);
    expect(t.bargains.pending.some((x) => x.house === 0)).toBe(false);
  });

  it("a Scion who looks shows their House its Ascendancy and is blessed for the fight; bots refuse and go on", () => {
    let s = atGlass();
    const ev = s.expedition!.event!;
    const look = TRIP_EVENT_BY_ID.get(ev.id)!.options.findIndex((o) => o.id === "look");
    for (const id of Object.keys(ev.picks!).map(Number)) {
      const host = s.people.find((p) => p.id === id)!.host;
      s = after(g.applyMove(s, s.players[host]!, { type: "decide", option: look, person: id }));
    }
    for (const h of present(s)) {
      expect(s.notes[h]!.filter((n) => n.includes("an Ascendancy of"))).toEqual([`In the Gate you see your House's future: an Ascendancy of ${ascendancy(s, h)}.`]);
    }
    for (const c of Object.values(s.expedition!.carry)) expect(c.start).toContain("protect");
    // Bots answer the whisper (refusing) before the Leader goes on to the boss.
    for (let n = 0; n < 6 && s.bargains.pending.length; n++) {
      const who = waiting(s)[0]!;
      s = after(g.applyMove(s, s.players[who]!, g.botMove!(s, s.players[who]!, undefined as never)));
    }
    expect(s.bargains.pending).toEqual([]);
    expect(s.houses.map((h) => h.pactMarks)).toEqual([0, 0]);
    expect(waiting(s)).toEqual([s.people.find((p) => p.id === s.expedition!.leader)!.host]);
  });
});
