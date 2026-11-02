import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Prologue, { PROLOGUE } from "./Prologue";

describe("the prologue (§1)", () => {
  it("tells the story line by line; a click shows it all, and the button enters the city", () => {
    const onDone = vi.fn();
    render(<Prologue onDone={onDone} />);
    expect(document.querySelectorAll(".sp-prologue p.is-shown").length).toBe(1);
    fireEvent.click(screen.getByRole("dialog"));
    expect(document.querySelectorAll(".sp-prologue p.is-shown").length).toBe(PROLOGUE.length);
    fireEvent.click(screen.getByRole("button", { name: "Enter the city" }));
    expect(onDone).toHaveBeenCalled();
  });

  it("can be skipped at once", () => {
    const onDone = vi.fn();
    render(<Prologue onDone={onDone} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(onDone).toHaveBeenCalled();
  });
});
