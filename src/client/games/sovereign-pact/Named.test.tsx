import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Content, sovereignPact as g } from "@vibepulse/shared/games/sovereign-pact";
import { campaign } from "../../../shared/games/sovereign-pact/testing.ts";
import { Named, subjectEnd } from "./Named";

const cut = (label: string) => {
  const n = subjectEnd(label);
  return n === null ? null : label.slice(0, n);
};

describe("a choice names its Scion inside its words (Josh 2026-11-10)", () => {
  it("finds the subject phrase a choice opens with", () => {
    expect(cut("The sharpest eye takes up the contest, sure of the aim.")).toBe("The sharpest eye");
    expect(cut("The strongest climbs down to see what knows your names.")).toBe("The strongest");
    expect(cut("The Leader throws down a coin and wishes.")).toBe("The Leader");
    expect(cut("The most seasoned of you tastes it first.")).toBe("The most seasoned of you");
    expect(cut("The quietest hands lift the troll's purse as it snores.")).toBe("The quietest hands");
    expect(cut("Let your wisest step into the gap.")).toBe("Let your wisest");
    expect(cut("The one with the most kills steps up to claim the sword.")).toBe("The one with the most kills");
    expect(cut("The one it names kneels at the cairn.")).toBe("The one it names");
    expect(cut("The one the arrows always find runs ahead.")).toBe("The one the arrows always find");
    expect(cut("Leave it to chance.")).toBeNull();
  });

  it("only ever cuts before a word, for every choice that falls on one Scion", () => {
    for (const ev of Content.TRIP_EVENTS)
      for (const o of ev.options) {
        const n = subjectEnd(o.label);
        if (n !== null) expect(o.label[n], `${ev.id}/${o.id}`).toMatch(/[ ,]/);
      }
  });

  it("puts the name in the House's colour after the subject", () => {
    const s = campaign(1, 3);
    const view = g.view(s, "p1");
    const p = view.people.find((x) => x.host === 0)!;
    const { container } = render(<Named label="The sharpest eye takes up the contest." person={p.id} view={view} />);
    expect(container.textContent).toBe(`The sharpest eye, ${p.name}, takes up the contest.`);
    expect(container.querySelector(".sp-named")?.getAttribute("style")).toContain("color");
  });

  it("leaves the words alone with no one to name", () => {
    const view = g.view(campaign(1, 3), "p1");
    const { container } = render(<Named label="The sharpest eye takes up the contest." person={null} view={view} />);
    expect(container.textContent).toBe("The sharpest eye takes up the contest.");
  });
});
