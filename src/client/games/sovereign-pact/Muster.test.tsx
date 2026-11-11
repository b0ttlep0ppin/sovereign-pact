import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Content, sovereignPact as g, type SovMove, type SovState } from "@vibepulse/shared/games/sovereign-pact";
import { TRIP_EVENTS } from "../../../shared/games/sovereign-pact/content.ts";
import { calm, campaign } from "../../../shared/games/sovereign-pact/testing.ts";
import { able, muster } from "../../../shared/games/sovereign-pact/expedition.ts";
import SovereignPact from "./index";

/** A solo House at the start of an expedition with two seats and more Scions than seats. */
function mustering() {
  const s = calm(campaign(1, 5));
  s.phase = "expedition";
  muster(s, { type: "resource", pool: "beast_lands", level: 1, size: 4 });
  s.expedition!.seats[0] = 2;
  const sendMove = vi.fn();
  render(<SovereignPact me="p1" players={[]} isMyTurn={true} sendMove={sendMove} lastError={null} view={g.view(s, "p1")} />);
  return { s, sendMove, ids: able(s, 0).map((p) => p.id) };
}

const grid = () => screen.getByRole("grid", { name: "The party's grid" });
const standing = () => within(grid()).queryAllByRole("gridcell").filter((c) => c.classList.contains("is-taken")).length;

describe("fielding your seats on an expedition (§9.2)", () => {
  it("shows each Scion as a card, counts the seats, and puts only the chosen in the formation", () => {
    const { sendMove } = mustering();
    const cards = within(screen.getByRole("group", { name: "Your Scions" })).getAllByRole("button");
    expect(cards.length).toBeGreaterThan(2);
    expect(screen.getByText(/seats filled/).textContent).toMatch(/^2 of 2/);
    expect(cards.filter((c) => c.getAttribute("aria-pressed") === "true")).toHaveLength(2);
    // Full: the others wait until someone is set down.
    const out = cards.find((c) => c.getAttribute("aria-pressed") === "false")!;
    expect((out as HTMLButtonElement).disabled).toBe(true);
    expect(standing()).toBe(2);
    fireEvent.click(cards.find((c) => c.getAttribute("aria-pressed") === "true")!);
    expect(screen.getByText(/seats filled/).textContent).toMatch(/^1 of 2/);
    expect(standing()).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Send 1 Scion on the expedition" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "field", people: [expect.any(Number)] });
  });

  it("packs the satchel from the House's stock as it fields its Scions (Josh 2026-11-11)", () => {
    const s = calm(campaign(1, 5));
    s.phase = "expedition";
    muster(s, { type: "resource", pool: "beast_lands", level: 1, size: 4 });
    s.expedition!.seats[0] = 2;
    const tonic = Content.CONSUMABLES.find((c) => c.use === "battle")!;
    const kit = Content.CONSUMABLES.find((c) => c.use === "town");
    s.houses[0]!.consumables = { [tonic.id]: 20, ...(kit ? { [kit.id]: 1 } : {}) };
    const sendMove = vi.fn();
    render(<SovereignPact me="p1" players={[]} isMyTurn={true} sendMove={sendMove} lastError={null} view={g.view(s, "p1")} />);
    const satchel = screen.getByRole("region", { name: "Pack the satchel" });
    if (kit) expect(within(satchel).queryByText(kit.name)).toBeNull();
    const room = g.view(s, "p1").expedition!.packRoom![2]!;
    expect(room).toBeGreaterThan(0);
    // Room for the two fielded Scions' share, and no more.
    fireEvent.change(within(satchel).getByLabelText(`Pack ${tonic.name}, slider`), { target: { value: "99" } });
    expect(satchel.textContent).toContain(`${room} of your ${room} slots`);
    fireEvent.click(screen.getByRole("button", { name: "Send 2 Scions on the expedition" }));
    const sent = sendMove.mock.calls.at(-1)![0] as Extract<SovMove, { type: "field" }>;
    expect(sent.pack).toEqual({ [tonic.id]: room });
    const r = g.applyMove(s, "p1", sent);
    if (!r.ok) throw new Error(r.error);
    expect(r.state.expedition!.satchel).toHaveLength(room);
  });

  it("declines the seats when no one is chosen", () => {
    const { sendMove } = mustering();
    for (const c of within(screen.getByRole("group", { name: "Your Scions" })).getAllByRole("button", { pressed: true })) fireEvent.click(c);
    expect(standing()).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Decline the seats" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "field", people: [] });
  });
});

describe("your stores", () => {
  it("shows gold and every basic resource in one band", () => {
    const { s } = mustering();
    const band = screen.getByRole("list", { name: "Your stores" });
    expect(within(band).getByText(/Gold/).textContent).toContain(String(s.houses[0]!.gold));
    for (const k of ["Grain", "Timber", "Stone", "Iron", "Essence"]) expect(within(band).getByText(new RegExp(k))).toBeTruthy();
  });
});

describe("an event each Scion answers for themself (§9.4 each_scion)", () => {
  it("names the one choosing with their face, puts the choice in their name, and lists who is still to choose (Josh 2026-11-10)", () => {
    const play = (s: SovState, m: SovMove) => {
      const r = g.applyMove(s, "p1", m);
      if (!r.ok) throw new Error(r.error);
      return r.state;
    };
    let s = calm(campaign(1, 5));
    s.phase = "expedition";
    muster(s, { type: "delve", pool: "apostate_court", level: 3, size: 4 });
    s = play(s, { type: "field", people: able(s, 0).slice(0, s.expedition!.seats[0]).map((p) => p.id) });
    s.expedition!.chain = ["event", "boss"];
    s.expedition!.seen = TRIP_EVENTS.filter((d) => d.id !== "the_confessional").map((d) => d.id);
    s = play(s, { type: "press_on" });
    expect(s.expedition!.event?.id).toBe("the_confessional");
    const first = s.people.find((p) => p.id === +Object.keys(s.expedition!.event!.picks!)[0]!)!;
    const sendMove = vi.fn();
    render(<SovereignPact me="p1" players={[]} isMyTurn={true} sendMove={sendMove} lastError={null} view={g.view(s, "p1")} />);
    const now = screen.getByRole("region", { name: `${first.name} chooses` });
    expect(now.querySelector(".sp-scion-face")).not.toBeNull();
    expect(now.textContent).toContain(`What does ${first.name} do?`);
    const confess = within(now).getByRole("button", { name: new RegExp(`^${first.name} steps behind the curtain`) });
    expect(within(screen.getByRole("list", { name: "Your Scions choose in turn" })).getAllByRole("listitem").length).toBe(Object.keys(s.expedition!.event!.picks!).length);
    fireEvent.click(confess);
    expect(sendMove).toHaveBeenCalledWith({ type: "decide", option: 0, person: first.id });
  });
});
