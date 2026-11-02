import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { sovereignPact as g, type SovMove, type SovState } from "./index.ts";
import { seats } from "./testing.ts";
import { forHouses, TUNING } from "./tuning.ts";
import { view } from "./view.ts";

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
/** Three Houses, all sworn: the draft is open. */
const sworn = (): SovState => {
  let s = g.setup(seats(3), createRng(11), undefined, undefined);
  for (const p of s.players) s = move(s, p, { type: "swear", ambition: 0 });
  return s;
};

describe("the opening recruit draft (Josh, 2026-11-02)", () => {
  it("opens when the last House swears: one shared pool, a few more than the picks, in snake order", () => {
    const s = sworn();
    const picks = forHouses(TUNING.houses.startScions, 3);
    expect(s.phase).toBe("founding");
    expect(s.muster!.pool.length).toBe(3 * (picks + TUNING.founding.musterExtra));
    expect(s.muster!.order.length).toBe(3 * picks);
    const [a, b, c] = s.muster!.order;
    expect(new Set([a, b, c]).size).toBe(3);
    expect(s.muster!.order.slice(3, 6)).toEqual([c, b, a]);
    // Every House sees the same volunteers; only the House whose pick it is may move.
    expect(view(s, "p1").muster).toEqual(view(s, "p2").muster);
    expect(g.activePlayers(s)).toEqual([s.players[a!]]);
    // Each House's own recruits are already born; no Scions yet.
    expect(s.people.filter((p) => p.status === "scion")).toEqual([]);
    expect(s.people.filter((p) => p.status === "recruit" && p.host === 0).length).toBe(forHouses(TUNING.houses.startRecruits, 3));
  });

  it("refuses a pick out of turn, from outside the pool, without a base Job, or an oath taken back", () => {
    const s = sworn();
    const turn = s.muster!.order[0]!;
    const other = s.players[(turn + 1) % 3]!;
    const me = s.players[turn]!;
    const id = s.muster!.pool[0]!.id;
    expect(error(s, other, { type: "muster", person: id, job: "knight" })).toMatch(/another House's pick/);
    expect(error(s, me, { type: "muster", person: -5, job: "knight" })).toMatch(/volunteers/);
    expect(error(s, me, { type: "muster", person: id, job: "sword_saint" })).toMatch(/base Job/);
    expect(error(s, me, { type: "unseal" })).toMatch(/draft is under way/);
    expect(g.passiveMoves!(s, me)).toEqual([]);
  });

  it("raises each pick to a Scion of the House in the chosen Job; the last pick opens Year 1", () => {
    let s = sworn();
    const turn = s.muster!.order[0]!;
    const id = s.muster!.pool[0]!.id;
    s = move(s, s.players[turn]!, { type: "muster", person: id, job: "magus" });
    const scion = s.people.find((p) => p.id === id)!;
    expect(scion).toMatchObject({ status: "scion", house: turn, host: turn, job: "magus" });
    expect(s.muster!.pool.some((p) => p.id === id)).toBe(false);
    while (s.muster) {
      const p = g.activePlayers(s)[0]!;
      s = move(s, p, g.botMove!(s, p, undefined as never));
    }
    expect(s.phase).toBe("settlement");
    expect(s.year).toBe(1);
    for (let h = 0; h < 3; h++) expect(s.people.filter((p) => p.host === h && p.status === "scion").length).toBe(forHouses(TUNING.houses.startScions, 3));
    expect(s.houses.every((h) => !h.sealed)).toBe(true);
  });
});
