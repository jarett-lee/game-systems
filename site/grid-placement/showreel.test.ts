import { expect, test } from "vitest";
import { defaultSizes } from "./catalog";
import { Demo } from "./demo";
import { act, prepareShowreel, showreel } from "./showreel";

test("the Showreel shows a place, both kinds of push, a swap, and a move between grids", () => {
  const demo = new Demo(defaultSizes, 64, { width: 1000, height: 700 });
  prepareShowreel(demo);
  const shown: string[] = [];

  for (const step of showreel) {
    act(demo, step);
    if (step.do === "move" || step.do === "rotate") {
      const target = demo.target();
      if (target) shown.push(`over:${target.outcome.kind}`);
    }
    if (step.do === "release") shown.push(demo.message);
  }

  expect(shown).toEqual([
    "over:placed",
    "over:pushed",
    "over:placed",
    "Placed",
    "over:pushed",
    "over:placed",
    "Placed",
    "over:pushed",
    "Pushed the dot aside",
    "over:swapped",
    "Swapped: the I 3-piece popped out",
    "over:placed",
    "Placed",
    "over:placed",
    "over:placed",
    "Placed",
  ]);
  expect(demo.inventory.hand).toBeNull();
  expect(demo.oneCovered).toBe("push");
});
