import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { sovereignPact as g } from "@vibepulse/shared/games/sovereign-pact";
import { calm, campaign } from "../../../shared/games/sovereign-pact/testing.ts";
import { mint } from "../../../shared/games/sovereign-pact/items.ts";
import { gainJp } from "../../../shared/games/sovereign-pact/progression.ts";
import Readying from "./Readying";

/** House 0's first Scion a Soldier with 120 JP, a spear in the stash. */
function town() {
  const s = calm(campaign(2, 3));
  const i = s.people.findIndex((x) => x.host === 0 && x.status === "scion");
  s.people[i] = gainJp({ ...s.people[i]!, job: "soldier", jp: { soldier: 0 }, learned: [], passives: [], secondary: undefined, gear: {} }, 120, "soldier");
  const spear = mint(s, "spear", 0, 3);
  return { s, p: s.people[i]!, spear };
}

describe("readying Scions", () => {
  it("buys an ability with JP, refusing what it cannot afford", () => {
    const { s, p } = town();
    const sendMove = vi.fn();
    render(<Readying view={g.view(s, "p1")} sendMove={sendMove} canAct />);
    const panel = screen.getByRole("tabpanel", { name: p.name });
    const row = within(panel).getByText("Heavy Blow").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: /Learn, 50 JP/ }));
    expect(sendMove).toHaveBeenCalledWith({ type: "learn", person: p.id, ability: "heavy_blow" });
    const dear = within(panel).getByText("Savage Strikes").closest("li")!;
    expect((within(dear).getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("takes a Job and puts stashed gear on", () => {
    const { s, p, spear } = town();
    const sendMove = vi.fn();
    render(<Readying view={g.view(s, "p1")} sendMove={sendMove} canAct />);
    fireEvent.change(screen.getByLabelText("Take a Job"), { target: { value: "magus" } });
    fireEvent.click(screen.getByRole("button", { name: "Take Job" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "take_job", person: p.id, job: "magus" });
    fireEvent.change(screen.getByLabelText("Wear in Main hand"), { target: { value: String(spear.id) } });
    expect(sendMove).toHaveBeenCalledWith({ type: "equip", person: p.id, item: spear.id, slot: "main" });
    const head = screen.queryByLabelText("Wear in Head");
    expect(head ? within(head).queryByRole("option", { name: /Spear/ }) : null).toBeNull();
  });

  it("offers nothing once sealed, and shows a spectator nothing", () => {
    const { s } = town();
    const sendMove = vi.fn();
    render(<Readying view={g.view(s, "p1")} sendMove={sendMove} canAct={false} />);
    expect(screen.queryByLabelText("Take a Job")).toBeNull();
    expect((within(screen.getByText("Heavy Blow").closest("li")!).getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    const spectator = render(<Readying view={g.view(s, "nobody")} sendMove={sendMove} canAct />);
    expect(spectator.container.innerHTML).toBe("");
  });
});
