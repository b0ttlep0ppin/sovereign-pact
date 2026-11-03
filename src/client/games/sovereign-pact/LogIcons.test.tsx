import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { sovereignPact as g, type Replay, type ReplayUnit } from "@vibepulse/shared/games/sovereign-pact";
import { campaign, found } from "../../../shared/games/sovereign-pact/testing.ts";
import { BattleLine, ChronicleLine, harmOf } from "./LogIcons";

type Ev = Replay["frames"][number]["ev"][number];
const s = found(campaign(1, 2));
const view = g.view(s, s.players[0]!);
const scion = s.people.find((p) => p.house === 0)!;
const units: ReplayUnit[] = [
  { id: 1, side: "party", name: scion.name, person: scion.id, house: 0, weapon: "spear", size: [1, 1], maxHp: 50, maxMp: 10, maxSanity: 50 },
  { id: 2, side: "enemy", name: "Ghoul", enemy: "ghoul", size: [1, 1], maxHp: 40, maxMp: 0, maxSanity: 0 },
];
const replay = { units, frames: [] } as unknown as Replay;
const line = (e: Ev, ability?: string) => render(<BattleLine e={e} text="text" replay={replay} view={view} {...(ability ? { ability } : {})} />).container;

describe("pictures in the logs (Josh 2026-11-03)", () => {
  it("names the kind of harm: the element, sorcery, or the striker's weapon", () => {
    const hit = (element?: "fire") => ({ t: "hit" as const, unit: 1, target: 2, damage: 9, ...(element ? { element } : {}) });
    expect(harmOf(hit("fire"), "attack", units[0])).toBe("fire");
    expect(harmOf(hit(), "attack", units[0])).toBe("stab");
    expect(harmOf(hit(), "attack", { ...units[0]!, weapon: "sword" })).toBe("blade");
    expect(harmOf(hit(), "attack", { ...units[0]!, weapon: "bow" })).toBe("arrow");
  });

  it("leads a battle line with the actor's face and House arms, and ends it with the blow's mark", () => {
    const c = line({ t: "hit", unit: 1, target: 2, damage: 9 }, "attack");
    expect(c.querySelector(".sp-face")?.getAttribute("title")).toBe(scion.name);
    expect(c.querySelector(".sp-sigil")?.getAttribute("title")).toBe(`House ${view.houses[0]!.name}`);
    expect(c.querySelector(".sp-mark")?.getAttribute("title")).toBe("a thrust");
  });

  it("marks a status laid with its own glyph, and a creature with its sprite", () => {
    const c = line({ t: "status", target: 2, status: "poison", on: true });
    expect(c.querySelector(".sp-face--creature")).toBeTruthy();
    expect(c.querySelector(".sp-sigil")).toBeNull();
    expect(c.querySelector(".sp-mark--status")?.textContent).toBe("☠");
  });

  it("gives a Chronicle line the arms of the House it names and the face of its Scion", () => {
    const h = view.houses[0]!;
    const c = render(<ChronicleLine line={`House ${h.name} sends ${scion.name} to the Gate.`} view={view} />).container;
    expect(c.querySelector(".sp-sigil")?.getAttribute("title")).toBe(`House ${h.name}`);
    expect(c.querySelector(".sp-face")?.getAttribute("title")).toBe(scion.name);
    expect(render(<ChronicleLine line="Snow falls." view={view} />).container.querySelector(".sp-sigil")).toBeNull();
  });
});
