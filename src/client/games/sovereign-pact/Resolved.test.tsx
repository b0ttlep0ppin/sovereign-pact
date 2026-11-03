import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { sovereignPact as g, type SovMove, type SovState } from "@vibepulse/shared/games/sovereign-pact";
import { calm, campaign } from "../../../shared/games/sovereign-pact/testing.ts";
import Resolved, { toldTitle, useResolved } from "./Resolved";

const move = (s: SovState, player: string, m: SovMove): SovState => {
  const r = g.applyMove(s, player, m);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

function Harness({ s, player }: { s: SovState; player: string }) {
  const view = g.view(s, player);
  const r = useResolved(view);
  return r.open ? <Resolved view={view} fresh={r.fresh} onClose={r.close} /> : <p>Nothing new.</p>;
}

afterEach(() => globalThis.localStorage?.clear());

describe("what was decided (Josh 2026-11-03: a prompt after every decision, with a sigil flare)", () => {
  it("tells a Council vote's result to everyone, once, under the city's mark", () => {
    let s = calm(campaign(2, 4));
    s.commons.gold = 500;
    s.commons.stores = { timber: 200, stone: 200, iron: 200 };
    s.commons.built = {};
    s = move(s, "p1", { type: "propose", project: "granary", host: 1 });
    s = move(s, "p1", { type: "vote", choice: 0 });
    s = move(s, "p2", { type: "vote", choice: 0 });
    const { unmount } = render(<Harness s={s} player="p2" />);
    const card = screen.getByRole("dialog", { name: "What was decided" });
    const part = within(card).getByRole("region", { name: toldTitle("council:granary") });
    expect(within(part).getByText(/The motion passes \(2 for, 0 against\)/)).toBeTruthy();
    expect(within(part).getByText(/district/)).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "Go on" }));
    expect(screen.getByText("Nothing new.")).toBeTruthy();
    unmount();
    render(<Harness s={s} player="p2" />);
    expect(screen.getByText("Nothing new.")).toBeTruthy();
  });

  it("tells a Year order to its own House only, under its sigil", () => {
    let s = calm(campaign(2, 4));
    s.houses[0]!.buildings.farm = 1;
    s.houses[0]!.gold = 100;
    s = move(s, "p1", { type: "order", building: "farm", order: "farm_nightshift" });
    const { unmount } = render(<Harness s={s} player="p1" />);
    const part = screen.getByRole("region", { name: toldTitle("order:farm") });
    expect(within(part).getByLabelText(`House ${s.houses[0]!.name}`)).toBeTruthy();
    expect(within(part).getByText(/Work through the night/)).toBeTruthy();
    unmount();
    render(<Harness s={s} player="p2" />);
    expect(screen.queryByRole("region", { name: toldTitle("order:farm") })).toBeNull();
  });
});
