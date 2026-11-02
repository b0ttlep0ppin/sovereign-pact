import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import Amount from "./Amount";

const Harness = ({ max, start = 0 }: { max?: number; start?: number }) => {
  const [n, setN] = useState(start);
  return <Amount label="Timber" max={max} value={n} onChange={setN} />;
};

describe("an amount to give", () => {
  it("replaces the 0 with what is typed, never 015, and keeps within the range", () => {
    render(<Harness max={42} />);
    const box = screen.getByLabelText("Timber") as HTMLInputElement;
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "015" } });
    expect(box.value).toBe("15");
    fireEvent.change(box, { target: { value: "99" } });
    fireEvent.blur(box);
    expect(box.value).toBe("42");
  });

  it("steps with − and +, and slides when there is a ceiling", () => {
    render(<Harness max={3} />);
    const box = screen.getByLabelText("Timber") as HTMLInputElement;
    expect((screen.getByRole("button", { name: "Less Timber" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "More Timber" }));
    expect(box.value).toBe("1");
    fireEvent.change(screen.getByLabelText("Timber, slider"), { target: { value: "3" } });
    expect(box.value).toBe("3");
    expect((screen.getByRole("button", { name: "More Timber" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("has no slider without a ceiling", () => {
    render(<Harness />);
    expect(screen.queryByLabelText("Timber, slider")).toBe(null);
  });
});
