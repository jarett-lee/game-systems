import { describe, expect, test } from "vitest";
import { defaultSizes, showreelLayout } from "./catalog";
import { Demo } from "./demo";
import { cellOrigin, frameFor } from "./layout";

function demoWithShowreelLayout(): Demo {
  const demo = new Demo(defaultSizes, 64, { width: 1000, height: 700 });
  demo.reset(defaultSizes, showreelLayout);
  return demo;
}

describe("grabbing an item", () => {
  test("the item stays exactly where it was when picked up off-center", () => {
    const demo = demoWithShowreelLayout();
    const backpack = frameFor(demo.layout, "backpack");
    const swordTop = cellOrigin(demo.layout, backpack, { x: 2, y: 0 });

    demo.press({ x: swordTop.x + 5, y: swordTop.y + 50 });

    expect(demo.heldCorner()).toEqual(swordTop);
  });

  test("the item follows the pointer by the same amount it moves", () => {
    const demo = demoWithShowreelLayout();
    const backpack = frameFor(demo.layout, "backpack");
    const swordTop = cellOrigin(demo.layout, backpack, { x: 2, y: 0 });

    demo.press({ x: swordTop.x + 5, y: swordTop.y + 50 });
    demo.move({ x: swordTop.x + 5 + 37, y: swordTop.y + 50 - 12 });

    expect(demo.heldCorner()).toEqual({ x: swordTop.x + 37, y: swordTop.y - 12 });
  });

  test("dropping without moving puts it back where it was", () => {
    const demo = demoWithShowreelLayout();
    const backpack = frameFor(demo.layout, "backpack");
    const swordMiddle = cellOrigin(demo.layout, backpack, { x: 2, y: 1 });
    const point = { x: swordMiddle.x + demo.layout.cellSize - 2, y: swordMiddle.y + demo.layout.cellSize - 2 };

    demo.press(point);
    demo.release(point);

    expect(demo.inventory.placements).toContainEqual({
      itemId: "sword",
      gridId: "backpack",
      origin: { x: 2, y: 0 },
      rotation: 0,
    });
  });

  test("the drop target follows where the item is drawn, not the pointer", () => {
    const demo = demoWithShowreelLayout();
    const backpack = frameFor(demo.layout, "backpack");
    const swordTop = cellOrigin(demo.layout, backpack, { x: 2, y: 0 });
    const grab = { x: swordTop.x + 4, y: swordTop.y + 4 };

    demo.press(grab);
    demo.move({ x: grab.x + demo.layout.pitch * 0.6, y: grab.y });

    expect(demo.target()?.origin).toEqual({ x: 3, y: 0 });
  });
});
