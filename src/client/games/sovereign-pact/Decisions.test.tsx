import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Content, sovereignPact as g } from "@vibepulse/shared/games/sovereign-pact";
import { found, campaign } from "../../../shared/games/sovereign-pact/testing.ts";
import Decisions, { voteText } from "./Decisions";

const EVENT = Content.TOWN_EVENTS.find((e) => e.scope === "settlement" && (e.options?.length ?? 0) >= 2 && !e.crisis)!;
const CRISIS = Content.TOWN_EVENTS.find((e) => e.crisis?.temptation)!;
const BANE = Content.BARGAINS.find((b) => b.bane)!;
const PROJECT = Content.PROJECTS[0]!;

function town() {
  const s = found(campaign(2, 4));
  s.events = [{ key: EVENT.id, id: EVENT.id, deciders: [0, 1], choices: [null, null] }];
  s.crisis = { id: CRISIS.id, need: { gold: 20 }, pledges: [{}, {}], tempted: [false, false] };
  s.bargains.pending = [{ house: 0, id: BANE.id }];
  s.vote = { kind: "spend", subject: PROJECT.id, options: ["yes", "no"], by: [null, 1], proposer: 1 };
  s.houses[0]!.gold = 50;
  return { s, view: g.view(s, s.players[0]!) };
}

describe("the Settlement Phase's decisions", () => {
  it("shows the open vote with the hands cast, and votes", () => {
    const { view } = town();
    const sendMove = vi.fn();
    render(<Decisions view={view} sendMove={sendMove} canAct />);
    const card = screen.getByLabelText("The open vote");
    expect(within(card).getByText(`A vote: ${voteText(view.vote!).question}`)).toBeTruthy();
    expect(within(card).getByLabelText("1 for No")).toBeTruthy();
    fireEvent.click(within(card).getByRole("button", { name: "Yes" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "vote", choice: 0 });
  });

  it("chooses a town event's option", () => {
    const { view } = town();
    const sendMove = vi.fn();
    render(<Decisions view={view} sendMove={sendMove} canAct />);
    const card = screen.getByLabelText(EVENT.title);
    fireEvent.click(within(card).getByRole("button", { name: EVENT.options![1]!.label }));
    expect(sendMove).toHaveBeenCalledWith({ type: "choose", event: EVENT.id, option: 1 });
  });

  it("pledges privately to the Crisis, and offers its temptation", () => {
    const { view } = town();
    const sendMove = vi.fn();
    render(<Decisions view={view} sendMove={sendMove} canAct />);
    const card = screen.getByLabelText("The Crisis");
    fireEvent.change(within(card).getByLabelText("Gold"), { target: { value: "12" } });
    fireEvent.click(within(card).getByRole("button", { name: "Pledge" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "crisis_pledge", give: { gold: 12 } });
    fireEvent.click(within(card).getByRole("button", { name: CRISIS.crisis!.temptation!.label }));
    expect(sendMove).toHaveBeenCalledWith({ type: "tempt" });
  });

  it("answers a Dark Bargain, naming the rival it falls on", () => {
    const { view } = town();
    const sendMove = vi.fn();
    render(<Decisions view={view} sendMove={sendMove} canAct />);
    const card = screen.getByLabelText(BANE.title);
    fireEvent.click(within(card).getByRole("button", { name: "Accept" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "bargain", id: BANE.id, accept: true, target: 1 });
  });

  it("shows nothing when nothing waits", () => {
    const s = found(campaign(2, 4));
    s.events = [];
    delete s.crisis;
    delete s.vote;
    s.bargains.pending = [];
    s.omensTold = [];
    const { container } = render(<Decisions view={g.view(s, s.players[0]!)} sendMove={() => {}} canAct />);
    expect(container.innerHTML).toBe("");
  });

  it("tells what came of the Omens, keeping another House's stores to itself", () => {
    const s = found(campaign(2, 4));
    s.events = [];
    delete s.crisis;
    delete s.vote;
    s.bargains.pending = [];
    s.omensTold = [
      {
        year: s.year,
        id: EVENT.id,
        by: 1,
        label: "Burn it.",
        text: "It burns.",
        lines: [
          { text: "Accord −3.", of: null, open: true },
          { text: "House B: −20 Gold.", of: 1, open: false },
        ],
      },
    ];
    render(<Decisions view={g.view(s, s.players[0]!)} sendMove={() => {}} canAct />);
    const told = screen.getByLabelText("What came of the Omens");
    expect(within(told).getByText("It burns.")).toBeTruthy();
    expect(within(told).getByText("Accord −3.")).toBeTruthy();
    expect(within(told).queryByText("House B: −20 Gold.")).toBeNull();
  });
});
