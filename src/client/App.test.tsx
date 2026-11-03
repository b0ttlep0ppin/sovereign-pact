import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

/** The Year in the header ("Year 2 of 20"); the log's "Year 2 of 20." can scroll out under the bots' sales. */
const shown = (n: number) => screen.queryByText((_, el) => el?.tagName === "STRONG" && el.textContent === `Year ${n} of 20`);
const year = (n: number) => shown(n) ?? screen.getByText(`Year ${n} of 20`);

/** Lets the bots move a few times: each move schedules the next after the render. */
const letBotsMove = () => {
  for (let i = 0; i < 60; i++) act(() => vi.advanceTimersByTime(400));
};

/** The muster: on each of our picks take the first volunteer as a Knight, letting the bots pick between. */
const draft = () => {
  for (let i = 0; i < 20 && screen.queryByRole("region", { name: "The muster" }); i++) {
    const choose = screen.queryAllByRole("button", { name: /^Choose (?!a |their )/ })[0];
    if (choose) {
      fireEvent.click(choose);
      fireEvent.click(screen.getByRole("button", { name: /^Knight/ }));
      fireEvent.click(screen.getByRole("button", { name: /^Take / }));
    }
    letBotsMove();
  }
};

/** The Expedition Phase: send the Scions picked by default, then vote for whoever is first. */
const sendTheParty = () => {
  const send = screen.queryByRole("button", { name: /^Send \d/ });
  if (send) fireEvent.click(send);
  letBotsMove();
  const lead = screen.queryAllByRole("button", { name: / leads$/ })[0];
  if (lead) fireEvent.click(lead);
  letBotsMove();
  for (let i = 0; i < 200; i++) {
    // What happened is read first: a battle's end, an event's outcome (the party waits on it).
    const read = screen.queryAllByRole("button", { name: /^(Go on|To arms|Continue|Next battle \(\d+ more\)|So be it)$/ })[0];
    const on = read ?? screen.queryByRole("button", { name: /^(Press on|Face the boss|Let the gambits fight the rest)$/ }) ?? document.querySelector<HTMLButtonElement>('[aria-label="An event"] button, [aria-label="The draft"] button:not([disabled])');
    // Nothing of ours to click: the bots are still moving (their Scions' battle turns), unless the Year is over.
    if (!on && shown(2)) break;
    if (on) fireEvent.click(on);
    letBotsMove();
  }
};

/** Seals the Year, past the prompt about Scions given no post (they idle). */
const seal = () => {
  // Answer every event and vote first: the Year cannot be sealed with one open (Josh 2026-11-03).
  for (let n = 0; n < 8 && (screen.getByRole("button", { name: "Seal the Year" }) as HTMLButtonElement).disabled; n++) {
    const panel = screen.getByRole("region", { name: "Decisions" });
    const option = [...panel.querySelectorAll<HTMLButtonElement>(".sp-actions button, .sp-hands button")].find((b) => !b.disabled);
    if (option) fireEvent.click(option);
  }
  fireEvent.click(screen.getByRole("button", { name: "Seal the Year" }));
  const anyway = screen.queryByRole("button", { name: "Seal anyway" });
  if (anyway) fireEvent.click(anyway);
};

describe("the standalone host", () => {
  it("starts a campaign, seals the Year, lets the bot seal, and autosaves the next Year", () => {
    vi.useFakeTimers();
    try {
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "Skip" }));
      fireEvent.click(screen.getByRole("button", { name: "Swear the Pact" }));
      fireEvent.click(screen.getAllByRole("radio", { name: /counts double/ })[0]!);
      fireEvent.click(screen.getByRole("button", { name: "Swear the Pact" }));
      letBotsMove();
      draft();
      expect(year(1)).toBeTruthy();
      seal();
      letBotsMove();
      sendTheParty();
      expect(year(2)).toBeTruthy();
      expect(localStorage.getItem("sovereign-pact:save")).toContain('"year":2');
    } finally {
      vi.useRealTimers();
    }
  });

  it("offers to continue an autosaved campaign", () => {
    vi.useFakeTimers();
    try {
      const first = render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "Skip" }));
      fireEvent.click(screen.getByRole("button", { name: "Swear the Pact" }));
      fireEvent.click(screen.getAllByRole("radio", { name: /counts double/ })[0]!);
      fireEvent.click(screen.getByRole("button", { name: "Swear the Pact" }));
      letBotsMove();
      draft();
      seal();
      letBotsMove();
      sendTheParty();
      first.unmount();
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "Skip" }));
      fireEvent.click(screen.getByRole("button", { name: "Continue the campaign" }));
      expect(screen.getByText("The campaign resumes in Year 2.")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
