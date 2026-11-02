import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { sovereignPact as g } from "@vibepulse/shared/games/sovereign-pact";
import { calm, campaign } from "../../../shared/games/sovereign-pact/testing.ts";
import Formation from "./Formation";

describe("the formation", () => {
  it("posts a picked Scion to the cell picked next, and sends one back to their Job", () => {
    const s = calm(campaign(1, 5));
    const view = g.view(s, "p1");
    const people = view.people.filter((p) => p.host === 0 && p.status === "scion");
    const sendMove = vi.fn();
    const { rerender } = render(<Formation view={view} people={people} sendMove={sendMove} canAct />);
    // A Scion whose name nobody else shares.
    const a = people.find((p) => people.filter((q) => q.name === p.name).length === 1)!;
    fireEvent.click(screen.getByRole("gridcell", { name: new RegExp(`^${a.name}, `) }));
    fireEvent.click(screen.getByRole("gridcell", { name: "Back, row 8" }));
    expect(sendMove).toHaveBeenCalledWith({ type: "post", person: a.id, col: 2, row: 7 });
    // Once posted, they stand there, and can be sent back to their Job's column.
    const posted = people.map((p) => (p.id === a.id ? { ...p, post: [2, 7] as [number, number] } : p));
    rerender(<Formation view={view} people={posted} sendMove={sendMove} canAct />);
    fireEvent.click(screen.getByRole("gridcell", { name: `${a.name}, Back, row 8` }));
    fireEvent.click(screen.getByRole("button", { name: "Stand by their Job" }));
    expect(sendMove).toHaveBeenLastCalledWith({ type: "post", person: a.id, col: null, row: null });
  });

  it("lets nobody move anything when the House cannot act", () => {
    const s = calm(campaign(1, 5));
    const view = g.view(s, "p1");
    const people = view.people.filter((p) => p.host === 0 && p.status === "scion");
    render(<Formation view={view} people={people} sendMove={() => {}} canAct={false} />);
    for (const c of screen.getAllByRole("gridcell")) expect((c as HTMLButtonElement).disabled).toBe(true);
  });
});
