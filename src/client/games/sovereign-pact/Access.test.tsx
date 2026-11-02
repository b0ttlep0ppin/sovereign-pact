import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { sovereignPact as g } from "@vibepulse/shared/games/sovereign-pact";
import { warbandBattle } from "../../../shared/games/sovereign-pact/combat/fixtures.ts";
import { recorded } from "../../../shared/games/sovereign-pact/combat/replay.ts";
import { found, campaign } from "../../../shared/games/sovereign-pact/testing.ts";
import { ACCESS_LABELS } from "./Access";
import BattleScreen from "./BattleScreen";
import SovereignPact from "./index";

const view = () => {
  const s = found(campaign(1, 2));
  return g.view(s, s.players[0]!);
};

describe("accessibility toggles (§15.8)", () => {
  afterEach(() => globalThis.localStorage?.clear());

  it("sets each toggle on the root for the CSS, and keeps it for the next visit", () => {
    const v = view();
    const props = { me: "p1", players: [], isMyTurn: true, sendMove: () => {}, lastError: null };
    const { container, unmount } = render(<SovereignPact {...props} view={v} />);
    const root = container.querySelector(".sp")!;
    expect(root.getAttribute("data-motion")).toBeNull();
    fireEvent.click(screen.getByLabelText(ACCESS_LABELS.motion));
    fireEvent.click(screen.getByLabelText(ACCESS_LABELS.big));
    expect(root.getAttribute("data-motion")).toBe("reduced");
    expect(root.getAttribute("data-numbers")).toBe("big");
    unmount();
    const again = render(<SovereignPact {...props} view={v} />);
    expect(again.container.querySelector(".sp")!.getAttribute("data-motion")).toBe("reduced");
  });

  it("shows the full battle log, every turn so far, when asked", () => {
    const v = view();
    const { replay } = recorded(warbandBattle(3, 3), "An Encounter");
    render(<BattleScreen replay={replay} view={v} onClose={() => {}} fullLog />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "End" });
    const log = screen.getByRole("list", { name: "Battle log" });
    const lines = within(log).getAllByRole("listitem");
    const perTurn = replay.frames.at(-1)!.ev.filter((e) => e.t !== "turn").length;
    expect(lines.length).toBeGreaterThan(perTurn);
    expect(lines[0]!.textContent).toMatch(/^1\. /);
  });
});
