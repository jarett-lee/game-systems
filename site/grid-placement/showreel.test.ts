import { expect, test } from "vitest";
import { defaultSizes, showreelLayout } from "./catalog";
import { Demo } from "./demo";
import { cellCenter, frameFor } from "./layout";
import { showreel } from "./showreel";

test("the Showreel shows a place, a rejection, a swap, and a move between grids", () => {
  const demo = new Demo(defaultSizes, 64, { width: 1000, height: 700 });
  demo.reset(defaultSizes, showreelLayout);
  const shown: string[] = [];

  for (const step of showreel) {
    if (step.do === "press") demo.press(cellCenter(demo.layout, frameFor(demo.layout, step.at.grid), step.at.cell));
    if (step.do === "move") {
      demo.move(cellCenter(demo.layout, frameFor(demo.layout, step.to.grid), step.to.cell));
      const target = demo.target();
      if (target) shown.push(`over:${target.outcome.kind}`);
    }
    if (step.do === "rotate") {
      demo.rotate();
      const target = demo.target();
      if (target) shown.push(`over:${target.outcome.kind}`);
    }
    if (step.do === "release" && demo.pointer) {
      demo.release(demo.pointer);
      shown.push(demo.message);
    }
  }

  expect(shown).toEqual([
    "over:placed",
    "over:swapped",
    "over:placed",
    "Placed",
    "over:rejected",
    "over:placed",
    "Placed",
    "over:swapped",
    "Swapped: the potion popped out",
    "over:placed",
    "Placed",
    "over:placed",
    "over:placed",
    "Placed",
  ]);
  expect(demo.inventory.hand).toBeNull();
});
