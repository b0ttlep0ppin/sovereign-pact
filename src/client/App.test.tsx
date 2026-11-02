import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

/** Lets the bots move a few times: each move schedules the next after the render. */
const letBotsMove = () => {
  for (let i = 0; i < 60; i++) act(() => vi.advanceTimersByTime(400));
};

/** The Expedition Phase: send the Scions picked by default, then vote for whoever is first. */
const sendTheParty = () => {
  const send = screen.queryByRole("button", { name: /^Send \d/ });
  if (send) fireEvent.click(send);
  letBotsMove();
  const lead = screen.queryAllByRole("button", { name: / leads$/ })[0];
  if (lead) fireEvent.click(lead);
  letBotsMove();
  for (let i = 0; i < 20; i++) {
    const on = screen.queryByRole("button", { name: /^(Press on|Face the boss)$/ });
    if (!on) break;
    fireEvent.click(on);
    letBotsMove();
  }
};

describe("the standalone host", () => {
  it("starts a campaign, seals the Year, lets the bot seal, and autosaves the next Year", () => {
    vi.useFakeTimers();
    try {
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "Swear the Pact" }));
      fireEvent.click(screen.getAllByRole("button", { name: /^Swear, keeping/ })[0]!);
      letBotsMove();
      expect(screen.getByText("Year 1 of 20.")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Seal the Year" }));
      letBotsMove();
      sendTheParty();
      expect(screen.getByText("Year 2 of 20.")).toBeTruthy();
      expect(localStorage.getItem("sovereign-pact:save")).toContain('"year":2');
    } finally {
      vi.useRealTimers();
    }
  });

  it("offers to continue an autosaved campaign", () => {
    vi.useFakeTimers();
    try {
      const first = render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "Swear the Pact" }));
      fireEvent.click(screen.getAllByRole("button", { name: /^Swear, keeping/ })[0]!);
      letBotsMove();
      fireEvent.click(screen.getByRole("button", { name: "Seal the Year" }));
      letBotsMove();
      sendTheParty();
      first.unmount();
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "Continue the campaign" }));
      expect(screen.getByText("The campaign resumes in Year 2.")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
