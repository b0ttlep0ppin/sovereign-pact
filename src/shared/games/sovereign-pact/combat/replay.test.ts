// Battle replays (§15.5): recording changes nothing, the frames add up to the battle's end, and the
// state carries a move's replays only until the next move, never into a save.
import { describe, expect, it } from "vitest";
import { sovereignPact as g } from "../index.ts";
import { calm, campaign } from "../testing.ts";
import { bossBattle } from "./bosses.ts";
import { standardParty, warbandBattle } from "./fixtures.ts";
import { recorded, replayLine, vitalsOf, type Replay, type Vitals } from "./replay.ts";
import { simulate } from "./sim.ts";

/** Every combatant's vitals after the last frame. */
function finalVitals(r: Replay): Map<number, Vitals> {
  const at = new Map(r.start.map((v) => [v[0], v]));
  for (const f of r.frames) for (const v of f.vit) at.set(v[0], v);
  return at;
}

describe("recording a battle", () => {
  it.each([1, 2, 3])("plays it exactly as the simulator does (seed %i)", (seed) => {
    const plain = warbandBattle(seed, 3);
    const watched = warbandBattle(seed, 3);
    const a = simulate(plain);
    const { summary, replay } = recorded(watched, "An Encounter");
    expect(summary).toEqual(a);
    expect(watched.events).toEqual(plain.events);
    expect(replay.outcome).toBe(plain.outcome);
  });

  it("frames hold every event once, and add up to the battle's last vitals", () => {
    const b = warbandBattle(4, 3);
    const { replay } = recorded(b, "An Encounter");
    expect(replay.frames.flatMap((f) => f.ev)).toEqual(b.events);
    const end = finalVitals(replay);
    for (const u of b.units) expect(end.get(u.id)).toEqual(vitalsOf(u));
    expect(replay.units.map((u) => u.id)).toEqual(b.units.map((u) => u.id));
  });

  it("catches summons and boss minions that join mid-battle", () => {
    const b = bossBattle(7, standardParty(7, 15), "unknown_mother", 5);
    const at = b.units.length;
    const { replay } = recorded(b, "The Unknown Mother");
    expect(b.units.length).toBeGreaterThan(at);
    const end = finalVitals(replay);
    for (const u of b.units.slice(at)) expect(end.get(u.id)).toEqual(vitalsOf(u));
  });

  it("writes log lines by name", () => {
    const { replay } = recorded(warbandBattle(5, 3), "An Encounter");
    const hit = replay.frames.flatMap((f) => f.ev).find((e) => e.t === "hit")!;
    expect(replayLine(replay, hit)).not.toMatch(/\([PE]\d+\)/);
    expect(replayLine(replay, hit)).toMatch(/ hits /);
  });
});

describe("replays in the campaign", () => {
  it("a move that fights shows its battle once, and no save holds it", () => {
    let s = calm(campaign(1, 3));
    let fought = false;
    for (let i = 0; i < 5000 && s.phase !== "over" && s.year < 4; i++) {
      const p = g.activePlayers(s)[0]!;
      const r = g.applyMove(s, p, g.botMove!(s, p, undefined as never));
      if (!r.ok) throw new Error(r.error);
      const before = s;
      s = r.state;
      const v = g.view(s, p);
      if (v.battles.length) {
        fought = true;
        expect(v.battles.every((b) => b.frames.length > 0 && b.key.startsWith(`${s.year}:`))).toBe(true);
        expect(g.view(before, p).battles.map((b) => b.key)).not.toEqual(v.battles.map((b) => b.key));
      }
      const save = g.checkpoint!(s);
      if (save) expect("battles" in save.campaign).toBe(false);
    }
    expect(fought).toBe(true);
  });
});
