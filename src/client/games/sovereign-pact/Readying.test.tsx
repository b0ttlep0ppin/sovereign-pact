import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Content, sovereignPact as g } from "@vibepulse/shared/games/sovereign-pact";
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

/** Opens one of a Scion's pages: Jobs and abilities (the first), Gear or Gambits. */
const page = (name: string) => fireEvent.click(screen.getByRole("tab", { name }));

describe("readying Scions", () => {
  // The page last opened is remembered; each test starts on the first.
  beforeEach(() => localStorage.clear());

  it("buys an ability with JP, refusing what it cannot afford", () => {
    const { s, p } = town();
    const sendMove = vi.fn();
    render(<Readying view={g.view(s, "p1")} sendMove={sendMove} canAct />);
    const panel = screen.getByRole("tabpanel", { name: p.name });
    const row = within(panel).getByText("Heavy Blow").closest("li")!;
    fireEvent.click(within(row).getByRole("button", { name: /Learn, 50 JP/ }));
    expect(sendMove).toHaveBeenCalledWith({ type: "learn", person: p.id, ability: "heavy_blow" });
    // Each active says what it costs to use (Josh 2026-11-11).
    const heavy = Content.ABILITY_SET_BY_JOB.get("soldier")!.actives.find((a) => a.id === "heavy_blow")!;
    expect(row.textContent).toContain(heavy.tp ? `${heavy.tp} TP` : heavy.mp ? `${heavy.mp} MP` : "free");
    const dear = within(panel).getByText("Savage Strikes").closest("li")!;
    expect((within(dear).getByRole("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("turns a passive on and off with a switch that lights its row (Josh 2026-11-10)", () => {
    const { s, p } = town();
    const i = s.people.findIndex((x) => x.id === p.id);
    s.people[i] = { ...s.people[i]!, learned: ["veteran", "grizzled"], passives: ["veteran"] };
    const sendMove = vi.fn();
    render(<Readying view={g.view(s, "p1")} sendMove={sendMove} canAct />);
    const on = screen.getByRole("button", { name: "Veteran, 2 pt" });
    expect(on.getAttribute("aria-pressed")).toBe("true");
    expect(on.closest("li")!.className).toContain("is-on");
    const off = screen.getByRole("button", { name: "Grizzled, 2 pt" });
    expect(off.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(off);
    expect(sendMove).toHaveBeenCalledWith({ type: "passive", person: p.id, ability: "grizzled", on: true });
    fireEvent.click(on);
    expect(sendMove).toHaveBeenCalledWith({ type: "passive", person: p.id, ability: "veteran", on: false });
  });

  it("takes a Job and puts stashed gear on", () => {
    const { s, p, spear } = town();
    const sendMove = vi.fn();
    render(<Readying view={g.view(s, "p1")} sendMove={sendMove} canAct />);
    // The Job icons: Magus shows its abilities, and the Scion may take it.
    fireEvent.click(within(screen.getByRole("list", { name: "Jobs" })).getByRole("button", { name: /Magus/ }));
    expect(screen.getByLabelText("Magus abilities").textContent).toContain("must take this Job to learn here");
    fireEvent.click(screen.getByRole("button", { name: "Take Job" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "take_job", person: p.id, job: "magus" });
    page("Gear");
    const main = within(screen.getByRole("list", { name: "Arms and trinkets" })).getByText("Main hand").closest("li")!;
    fireEvent.click(within(main).getByRole("button", { name: /Wear/ }));
    const choices = screen.getByRole("region", { name: "Choose for Main hand" });
    const card = within(choices).getByText("Fine Spear").closest("li")!;
    expect(card.textContent).toMatch(/Power\d+/);
    expect(card.textContent).toContain("Accuracy");
    fireEvent.click(within(card).getByRole("button", { name: "Wear" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "equip", person: p.id, item: spear.id, slot: "main" });
    expect(screen.queryByRole("region", { name: "Choose for Main hand" })).toBeNull();
    const head = within(screen.getByRole("list", { name: "Armor" })).getByText("Head").closest("li")!;
    const other = within(head).queryByRole("button", { name: /Wear|Change/ });
    if (other) fireEvent.click(other);
    expect(screen.queryByRole("region", { name: "Choose for Head" })?.textContent ?? "").not.toContain("Spear");
  });

  it("sets each choice's numbers beside what is worn, and its properties out in words", () => {
    const { s, p, spear } = town();
    const sword = mint(s, "sword", 0, 2);
    s.people.find((x) => x.id === p.id)!.gear = { main: sword.id };
    spear.props = [["keen", 12]];
    render(<Readying view={g.view(s, "p1")} sendMove={vi.fn()} canAct />);
    page("Gear");
    const main = within(screen.getByRole("list", { name: "Arms and trinkets" })).getByText("Main hand").closest("li")!;
    expect(main.textContent).toMatch(/Power \d+ · Accuracy \d+% · Crit \d+%/);
    fireEvent.click(within(main).getByRole("button", { name: /Change/ }));
    const card = within(screen.getByRole("region", { name: "Choose for Main hand" })).getByText("Fine Spear").closest("li")!;
    expect(card.querySelector(".sp-gearpick__delta")).not.toBeNull();
    expect(card.textContent).toContain("Keen 12: Crit chance up");
    expect(card.textContent).toMatch(/One-handed|Two-handed/);
  });

  it("offers nothing once sealed, and shows a spectator nothing", () => {
    const { s } = town();
    const sendMove = vi.fn();
    render(<Readying view={g.view(s, "p1")} sendMove={sendMove} canAct={false} />);
    expect(screen.queryByRole("button", { name: "Take Job" })).toBeNull();
    expect((within(screen.getByText("Heavy Blow").closest("li")!).getByRole("button") as HTMLButtonElement).disabled).toBe(true);
    const spectator = render(<Readying view={g.view(s, "nobody")} sendMove={sendMove} canAct />);
    expect(spectator.container.innerHTML).toBe("");
  });

  it("shows each Scion's face to pick them by, and one page of them at a time (Josh 2026-11-10)", () => {
    const { s, p } = town();
    const { container } = render(<Readying view={g.view(s, "p1")} sendMove={vi.fn()} canAct />);
    const scions = s.people.filter((x) => x.host === 0 && x.status === "scion").length;
    expect(container.querySelectorAll(".sp-ready__tabs .sp-scion-face").length).toBe(scions);
    expect(screen.getByRole("tab", { name: new RegExp(p.name) })).toBeTruthy();
    expect(screen.getByRole("list", { name: "Jobs" })).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Armor" })).toBeNull();
    page("Gambits");
    expect(screen.getByRole("button", { name: "Add a gambit" })).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Jobs" })).toBeNull();
  });

  it("shows a locked Job's abilities and what opens it, and wears gear on a paper doll", () => {
    const { s, p } = town();
    render(<Readying view={g.view(s, "p1")} sendMove={vi.fn()} canAct />);
    fireEvent.click(within(screen.getByRole("list", { name: "Jobs" })).getByRole("button", { name: /Sword Saint/ }));
    const detail = screen.getByLabelText("Sword Saint abilities");
    expect(detail.textContent).toContain("Opens with 400 JP as a Soldier and 400 JP as a Knight");
    expect(within(detail).queryByRole("button", { name: /Learn/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Take Job" })).toBeNull();
    page("Gear");
    const armor = screen.getByRole("list", { name: "Armor" });
    expect(within(armor).getByText("Head")).toBeTruthy();
    expect(within(screen.getByRole("list", { name: "Arms and trinkets" })).getByText("Main hand")).toBeTruthy();
    expect(p.id).toBeDefined();
  });
});
