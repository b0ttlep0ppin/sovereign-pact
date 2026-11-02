// Cure items (§11.2, §13.6): one-use Relics that mend what the injury tables did; the Nest's Core yields one of each.
import { describe, expect, it } from "vitest";
import { INJURY_BY_ID, NAMED_BY_ID } from "./content.ts";
import { botCure, CURES, mends } from "./cures.ts";
import { muster } from "./expedition.ts";
import { sovereignPact as g } from "./index.ts";
import { cannotEquip, madeNamed, mintNamed } from "./items.ts";
import { home } from "./journey.ts";
import { categories } from "./score.ts";
import type { SovState } from "./state.ts";
import { calm, campaign } from "./testing.ts";
import { clone } from "./year.ts";

const after = (r: ReturnType<typeof g.applyMove>): SovState => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

/** House 0's first Scion carries `injuries`; House 0 holds the cure `id`. */
function hurt(id: string, injuries: string[]): { s: SovState; item: number; person: number } {
  const s = calm(campaign(2, 3));
  s.phase = "settlement";
  const p = s.people.find((x) => x.host === 0 && x.status === "scion")!;
  p.injuries = injuries.map((i) => ({ id: i, years: INJURY_BY_ID.get(i)!.lasting?.years ?? 0 }));
  const item = mintNamed(s, id, 0, 5);
  s.items.push(item);
  return { s, item: item.id, person: p.id };
}

describe("the cures' content", () => {
  it("has the five of §11.2, each mending real injury results", () => {
    expect(CURES.map((c) => c.id)).toEqual(["saints_hand", "clockwork_leg", "seers_eye", "lethe_water", "surgeons_kit"]);
    for (const c of CURES) for (const i of c.cure!.injuries ?? []) expect(INJURY_BY_ID.has(i), i).toBe(true);
  });

  it("are made as often as they are found, cannot be worn, and score as Relics while unused", () => {
    const { s, item } = hurt("saints_hand", []);
    expect(madeNamed(s, "saints_hand")).toBe(false);
    const p = s.people.find((x) => x.host === 0 && x.status === "scion")!;
    expect(cannotEquip(s, p, s.items.find((i) => i.id === item)!, "acc1")).toMatch(/used, not worn/);
    const relics = categories(s, 0).relics;
    s.items = s.items.filter((i) => i.id !== item);
    expect(categories(s, 0).relics).toBeLessThan(relics);
  });
});

describe("spending one", () => {
  it("the Saint's Hand regrows a severed arm, and is gone", () => {
    const { s, item, person } = hurt("saints_hand", ["arms_severed", "head_concussion"]);
    const t = after(g.applyMove(s, "p1", { type: "cure", item, person }));
    expect(t.people.find((x) => x.id === person)!.injuries.map((i) => i.id)).toEqual(["head_concussion"]);
    expect(t.items.some((i) => i.id === item)).toBe(false);
  });

  it("the Seer's Eye cures blindness and leaves the hollow eyes", () => {
    const { s, item, person } = hurt("seers_eye", ["head_blinded"]);
    const p = after(g.applyMove(s, "p1", { type: "cure", item, person })).people.find((x) => x.id === person)!;
    expect(p.injuries).toEqual([]);
    expect(p.look).toContain(NAMED_BY_ID.get("seers_eye")!.cure!.look);
  });

  it("the Surgeon's Kit takes one lasting Moderate injury, never a Devastating one, the one named if any", () => {
    const { s, item, person } = hurt("surgeons_kit", ["legs_severed", "body_cracked_ribs", "head_concussion"]);
    const p = s.people.find((x) => x.id === person)!;
    expect(mends(s.items.find((i) => i.id === item)!, p)).toEqual(["body_cracked_ribs", "head_concussion"]);
    expect(g.applyMove(clone(s), "p1", { type: "cure", item, person, injury: "legs_severed" }).ok).toBe(false);
    const t = after(g.applyMove(s, "p1", { type: "cure", item, person, injury: "head_concussion" }));
    expect(t.people.find((x) => x.id === person)!.injuries.map((i) => i.id)).toEqual(["legs_severed", "body_cracked_ribs"]);
  });

  it("only on the House's own, at home, for something it mends", () => {
    const { s, item, person } = hurt("lethe_water", ["head_concussion"]);
    expect(g.applyMove(clone(s), "p1", { type: "cure", item, person })).toMatchObject({ ok: false });
    s.people.find((x) => x.id === person)!.injuries.push({ id: "sanity_thrall", years: -1 });
    expect(g.applyMove(clone(s), "p2", { type: "cure", item, person })).toMatchObject({ ok: false });
    const rival = s.people.find((x) => x.host === 1 && x.status === "scion")!;
    rival.injuries.push({ id: "sanity_thrall", years: -1 });
    expect(g.applyMove(clone(s), "p1", { type: "cure", item, person: rival.id })).toMatchObject({ ok: false });
    s.phase = "expedition";
    expect(g.applyMove(clone(s), "p1", { type: "cure", item, person })).toMatchObject({ ok: false });
  });

  it("a bot spends what it holds on its own who need it", () => {
    const { s, item, person } = hurt("clockwork_leg", ["legs_severed"]);
    expect(botCure(s, 0)).toEqual({ type: "cure", item, person });
    expect(botCure(s, 1)).toBeNull();
  });
});

describe("the Nest's Core", () => {
  it("won in Year 15, it yields one cure of each kind to the draft", () => {
    const s = calm(campaign(2, 5));
    s.year = 15;
    s.phase = "expedition";
    muster(s, { type: "mandatory", pool: "outer_dark", level: 8, size: 8, boss: "unknown_mother" });
    s.expedition!.party = [0, 1].map((h) => s.people.filter((p) => p.host === h && p.status === "scion").slice(0, 2).map((p) => p.id));
    home(s, "won");
    const drafted = (s.expedition?.pool ?? []).map((x) => x.item?.named);
    for (const c of CURES) expect(drafted).toContain(c.id);
  });
});
