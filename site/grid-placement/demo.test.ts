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

describe("letting go where it can't land", () => {
  test("outside the grids sends the item back to its original spot", () => {
    const demo = demoWithShowreelLayout();
    const backpack = frameFor(demo.layout, "backpack");
    const swordTop = cellOrigin(demo.layout, backpack, { x: 2, y: 0 });

    demo.press({ x: swordTop.x + 10, y: swordTop.y + 10 });
    demo.rotate();
    demo.release({ x: demo.layout.width + 400, y: demo.layout.height + 400 });

    expect(demo.inventory.hand).toBeNull();
    expect(demo.inventory.placements).toContainEqual({
      itemId: "sword",
      gridId: "backpack",
      origin: { x: 2, y: 0 },
      rotation: 0,
    });
  });

  test("a drop the System rejects also sends it back", () => {
    const demo = new Demo(defaultSizes, 64, { width: 1000, height: 700 });
    const full = { backpackWidth: 2, backpackHeight: 2, stashWidth: 2, stashHeight: 2 };
    demo.reset(full, [
      { itemId: "potion", gridId: "backpack", origin: { x: 0, y: 0 }, rotation: 0 },
      { itemId: "gem", gridId: "backpack", origin: { x: 1, y: 0 }, rotation: 0 },
      { itemId: "tonic", gridId: "backpack", origin: { x: 0, y: 1 }, rotation: 0 },
      { itemId: "scroll", gridId: "stash", origin: { x: 0, y: 0 }, rotation: 0 },
    ]);
    const stash = frameFor(demo.layout, "stash");
    const backpack = frameFor(demo.layout, "backpack");
    const scroll = cellOrigin(demo.layout, stash, { x: 0, y: 0 });
    const grab = { x: scroll.x + 10, y: scroll.y + 10 };
    const over = cellOrigin(demo.layout, backpack, { x: 0, y: 0 });

    demo.press(grab);
    demo.release({ x: over.x + 10, y: over.y + 10 });

    expect(demo.message).toBe("Rejected: no room to push those items aside, so it went back to its spot");
    expect(demo.inventory.placements).toContainEqual({
      itemId: "scroll",
      gridId: "stash",
      origin: { x: 0, y: 0 },
      rotation: 0,
    });
  });
});

describe("pushing", () => {
  test("dropping onto two items pushes them aside", () => {
    const demo = demoWithShowreelLayout();
    const backpack = frameFor(demo.layout, "backpack");
    const scroll = cellOrigin(demo.layout, backpack, { x: 0, y: 3 });
    const grab = { x: scroll.x + 10, y: scroll.y + 10 };
    const target = cellOrigin(demo.layout, backpack, { x: 2, y: 1 });

    demo.press(grab);
    demo.release({ x: target.x + 10, y: target.y + 10 });

    expect(demo.message).toMatch(/^Pushed the /);
    expect(demo.inventory.hand).toBeNull();
    expect(demo.inventory.placements).toContainEqual({
      itemId: "scroll",
      gridId: "backpack",
      origin: { x: 2, y: 1 },
      rotation: 0,
    });
  });
});

describe("rotating while holding", () => {
  test("E turns the other way, and the grab point stays under the pointer", () => {
    const demo = demoWithShowreelLayout();
    const backpack = frameFor(demo.layout, "backpack");
    const swordTop = cellOrigin(demo.layout, backpack, { x: 2, y: 0 });
    const grab = { x: swordTop.x + 10, y: swordTop.y + 20 };

    demo.press(grab);
    demo.rotate("counter-clockwise");

    expect(demo.inventory.hand?.rotation).toBe(3);
    const corner = demo.heldCorner();
    expect(corner && { x: grab.x - corner.x, y: grab.y - corner.y }).toEqual({ x: 20, y: demo.layout.cellSize - 10 });
  });
});

describe("holding by the item's center", () => {
  test("the item's center jumps to the pointer", () => {
    const demo = demoWithShowreelLayout();
    demo.holdBy = "item center";
    const backpack = frameFor(demo.layout, "backpack");
    const swordTop = cellOrigin(demo.layout, backpack, { x: 2, y: 0 });
    const grab = { x: swordTop.x + 5, y: swordTop.y + 5 };

    demo.press(grab);

    const corner = demo.heldCorner();
    const { pitch, gap, cellSize } = demo.layout;
    expect(corner && { x: corner.x + cellSize / 2, y: corner.y + (3 * pitch - gap) / 2 }).toEqual(grab);
  });
});

describe("picking up by click", () => {
  test("the first click picks the item up and the next click drops it", () => {
    const demo = demoWithShowreelLayout();
    demo.pickUpBy = "click";
    const stash = frameFor(demo.layout, "stash");
    const backpack = frameFor(demo.layout, "backpack");
    const potion = cellOrigin(demo.layout, backpack, { x: 3, y: 0 });
    const grab = { x: potion.x + 10, y: potion.y + 10 };
    const free = cellOrigin(demo.layout, stash, { x: 2, y: 0 });
    const dropAt = { x: free.x + 10, y: free.y + 10 };

    demo.press(grab);
    demo.release(grab);
    expect(demo.inventory.hand?.itemId).toBe("potion");

    demo.move(dropAt);
    demo.press(dropAt);
    demo.release(dropAt);
    expect(demo.inventory.hand).toBeNull();
    expect(demo.inventory.placements).toContainEqual({
      itemId: "potion",
      gridId: "stash",
      origin: { x: 2, y: 0 },
      rotation: 0,
    });
  });

  test("press and drag stays the default, dropping on release", () => {
    const demo = demoWithShowreelLayout();
    const backpack = frameFor(demo.layout, "backpack");
    const potion = cellOrigin(demo.layout, backpack, { x: 3, y: 0 });
    const grab = { x: potion.x + 10, y: potion.y + 10 };

    demo.press(grab);
    demo.release(grab);

    expect(demo.pickUpBy).toBe("press and drag");
    expect(demo.inventory.hand).toBeNull();
  });
});
