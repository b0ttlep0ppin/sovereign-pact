import { describe, expect, it } from "vitest";
import { createRng } from "../../rng.ts";
import { enemyCombatant, newBattle } from "./combat/build.ts";
import { decide } from "./combat/gambits.ts";
import { packPeople, unpackPeople } from "./codec.ts";
import { sovereignPact, type SovMove, type SovState } from "./index.ts";
import { partyOf } from "./journey.ts";
import { battleActives } from "./progression.ts";
import { calm, campaign } from "./testing.ts";
import { TUNING } from "./tuning.ts";

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
const scions = (s: SovState, house = 0) => s.people.filter((p) => p.host === house && p.status === "scion");

describe("a Scion's own gambits (§6.11)", () => {
  it("come first when they fight by gambits, their usual ways after", () => {
    let s = calm(campaign(1, 5));
    const a = scions(s)[0]!;
    s = move(s, "p1", { type: "gambits", person: a.id, rules: [{ if: "self.hp<0.5", do: "defend" }] });
    const [u] = partyOf(s, [a.id]);
    const b = newBattle(3, [u!, enemyCombatant("barrow_skeleton", { id: 99, level: 1, col: 0, row: u!.row })]);
    // Hale: the rule does not hold, so they fight as before.
    expect(decide(b, createRng(1), u!).action.do).not.toBe("defend");
    u!.hp = Math.floor(u!.maxHp / 3);
    expect(decide(b, createRng(1), u!).action.do).toBe("defend");
  });

  it("are kept in the save and shown only to their own House", () => {
    let s = calm(campaign(2, 5));
    const a = scions(s)[0]!;
    const ab = battleActives(a)[0];
    const rules = [{ if: "ally.hp<0.5", do: ab?.id ?? "attack", target: "ally_lowest_hp" }, { do: "attack", target: "nearest" }];
    s = move(s, "p1", { type: "gambits", person: a.id, rules });
    expect(unpackPeople(JSON.parse(JSON.stringify(packPeople(s.people)))).find((p) => p.id === a.id)?.gambits).toEqual(rules);
    expect(g.view(s, "p1").people.find((p) => p.id === a.id)?.kit?.gambits).toEqual(rules);
    expect(g.view(s, "p2").people.find((p) => p.id === a.id)?.kit).toBeUndefined();
    s = move(s, "p1", { type: "gambits", person: a.id, rules: [] });
    expect(s.people.find((p) => p.id === a.id)?.gambits).toBeUndefined();
  });

  it("are refused for others' Scions, unknown abilities and off-menu rules", () => {
    const s = calm(campaign(2, 5));
    const a = scions(s)[0]!;
    expect(error(s, "p2", { type: "gambits", person: a.id, rules: [] })).toMatch(/own Scions/);
    expect(error(s, "p1", { type: "gambits", person: a.id, rules: [{ do: "meteor_of_the_end" }] })).toMatch(/cannot do that/);
    expect(error(s, "p1", { type: "gambits", person: a.id, rules: [{ if: "foe.hp<2&&turn%2==0", do: "attack" }] })).toMatch(/when/);
    expect(error(s, "p1", { type: "gambits", person: a.id, rules: [{ do: "attack", target: "everyone" }] })).toMatch(/whom/);
    const many = Array.from({ length: TUNING.gambits.maxRules + 1 }, () => ({ do: "attack" }));
    expect(error(s, "p1", { type: "gambits", person: a.id, rules: many })).toMatch(/at most/);
  });
});
