import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App } from "./App";

describe("the standalone host", () => {
  it("starts a campaign, seals the Year, lets the bot seal, and autosaves the next Year", () => {
    vi.useFakeTimers();
    try {
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "Swear the Pact" }));
      expect(screen.getByText("Year 1 of 20.")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Seal the Year" }));
      act(() => vi.advanceTimersByTime(1000));
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
      fireEvent.click(screen.getByRole("button", { name: "Seal the Year" }));
      act(() => vi.advanceTimersByTime(1000));
      first.unmount();
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: "Continue the campaign" }));
      expect(screen.getByText("The campaign resumes in Year 2.")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});
