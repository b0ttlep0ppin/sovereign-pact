import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Content } from "@vibepulse/shared/games/sovereign-pact";
import { cueFor, useUiSounds } from "./uiSound";

const played = vi.hoisted(() => [] as [string, number][]);
vi.mock("./sfx", () => ({ canPlay: () => true, playCue: (cue: string, v: number) => played.push([cue, v]) }));
afterEach(() => void played.splice(0));

function Game({ vol = 0.5, children }: { vol?: number; children: React.ReactNode }) {
  useUiSounds(vol);
  return <div className="sp">{children}</div>;
}
const el = (html: string) => {
  const d = document.createElement("div");
  d.innerHTML = html;
  return d.firstElementChild!;
};

describe("the menus' sounds (Josh 2026-11-03)", () => {
  it("names a control's cue: its own or a parent's data-sfx, else by what it is", () => {
    expect(cueFor(el('<button data-sfx="learn">Learn, 40 JP</button>'))).toBe("learn");
    expect(cueFor(el('<div data-sfx="none"><button>x</button></div>').firstElementChild!)).toBe("none");
    expect(cueFor(el("<button>◂ Back</button>"))).toBe("ui_back");
    expect(cueFor(el("<button>Take back the oath</button>"))).toBe("ui_back");
    expect(cueFor(el('<button role="tab">Edda</button>'))).toBe("ui_page");
    expect(cueFor(el("<summary>⚙ Settings</summary>"))).toBe("ui_page");
    expect(cueFor(el('<input type="checkbox">'))).toBe("ui_back");
    expect(cueFor(el('<input type="checkbox" checked>'))).toBe("ui_select");
    expect(cueFor(el("<button>Accept</button>"))).toBe("ui_select");
  });

  it("plays a click in the game, softer than the battle, and nothing for a disabled button, outside the game or with sound off", () => {
    const { getByText, rerender } = render(
      <>
        <Game>
          <button data-sfx="job">Take Job</button>
          <button data-sfx="learn learn_whisper">Learn</button>
          <button disabled>Seal the Year</button>
        </Game>
        <button>Elsewhere</button>
      </>,
    );
    fireEvent.click(getByText("Take Job"));
    fireEvent.click(getByText("Seal the Year"));
    fireEvent.click(getByText("Elsewhere"));
    expect(played).toEqual([["job", 0.4]]);
    fireEvent.click(getByText("Learn"));
    expect(played.slice(1).map(([c]) => c)).toEqual(["learn", "learn_whisper"]);
    played.splice(1);
    rerender(
      <Game vol={0}>
        <button data-sfx="job">Take Job</button>
      </Game>,
    );
    fireEvent.click(getByText("Take Job"));
    expect(played).toHaveLength(1);
  });

  it("sounds a list's choice and a box's change, and ticks once on pointing at a command", () => {
    const { getByRole, getByText } = render(
      <Game>
        <select data-sfx="equip_blade" aria-label="Wear" defaultValue="">
          <option value="">Wear…</option>
          <option value="1">Longsword</option>
        </select>
        <button className="sp-command__choice">
          Attack <small>2 TP</small>
        </button>
      </Game>,
    );
    fireEvent.change(getByRole("combobox"), { target: { value: "1" } });
    fireEvent.mouseOver(getByText("Attack"));
    fireEvent.mouseOver(getByText("2 TP"));
    expect(played.map(([c]) => c)).toEqual(["equip_blade", "ui_move"]);
  });

  it("names only cues it has", () => {
    const dir = __dirname;
    const named = readdirSync(dir)
      .filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."))
      .flatMap((f) => [...readFileSync(join(dir, f), "utf8").matchAll(/(?:data-sfx=\{?[^}>]*?|uiSound\(|: )"((?:(?:ui|equip)_[a-z]+|job|learn(?:_[a-z]+)?)(?: [a-z_]+)*)"/g)].flatMap((m) => m[1]!.split(" ")));
    expect(named.length).toBeGreaterThan(15);
    for (const cue of new Set(named)) expect(Content.SFX_BY_ID.has(cue), cue).toBe(true);
  });
});
