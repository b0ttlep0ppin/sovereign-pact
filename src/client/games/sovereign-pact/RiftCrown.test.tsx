import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RiftCrown, { crownFill } from "./RiftCrown";

describe("the rift crown", () => {
  it("fills a little more every Year, all of it in the last", () => {
    const fills = Array.from({ length: 20 }, (_, i) => crownFill(i + 1, 20));
    expect(fills[0]).toBeGreaterThan(0);
    for (let i = 1; i < fills.length; i++) expect(fills[i]).toBeGreaterThan(fills[i - 1]!);
    expect(fills[19]).toBe(1);
    expect(crownFill(30, 20)).toBe(1);
  });

  it("fades into the cracks at the top, and fizzes until the crown is whole", () => {
    const { container } = render(
      <>
        <RiftCrown fill={0.4} />
        <RiftCrown fill={1} />
      </>,
    );
    const [half, whole] = [...container.querySelectorAll("svg")];
    expect(half!.dataset.fill).toBe("0.40");
    // No hard line where the filling has reached: it fades.
    expect(half!.querySelector("mask rect")!.getAttribute("fill")).toMatch(/^url\(#/);
    expect(whole!.querySelector("mask rect")!.getAttribute("fill")).toBe("#fff");
    // Motes of light rise off the outline, from scattered spots.
    const motes = [...half!.querySelectorAll(".sp-crown__motes rect")].map((m) => m.getAttribute("x"));
    expect(new Set(motes).size).toBeGreaterThan(15);
    // Pixels fizz up off the torn edge, and stop once nothing is left to tear.
    expect(half!.querySelectorAll(".sp-crown__fizz rect").length).toBeGreaterThan(10);
    expect(whole!.querySelector(".sp-crown__fizz")).toBeNull();
    // Each crown's filters are its own.
    expect(half!.querySelector("filter")!.id).not.toBe(whole!.querySelector("filter")!.id);
  });

  it("is only hinted at when faint", () => {
    const { container } = render(<RiftCrown fill={0.3} faint />);
    expect(container.querySelector("svg")!.classList.contains("sp-crown--faint")).toBe(true);
  });
});
