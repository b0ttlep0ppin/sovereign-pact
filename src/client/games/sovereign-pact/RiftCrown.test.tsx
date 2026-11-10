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

  it("shows the torn edge until the crown is whole", () => {
    const { container } = render(
      <>
        <RiftCrown fill={0.4} />
        <RiftCrown fill={1} />
      </>,
    );
    const [half, whole] = [...container.querySelectorAll("svg")];
    expect(half!.dataset.fill).toBe("0.40");
    expect(half!.querySelector(".sp-crown__edge")).not.toBeNull();
    expect(whole!.querySelector(".sp-crown__edge")).toBeNull();
    // Each crown's filters are its own.
    expect(half!.querySelector("filter")!.id).not.toBe(whole!.querySelector("filter")!.id);
  });
});
