import { describe, expect, test } from "vitest";
import { defaultSizes, showreelLayout } from "./catalog";
import { Demo } from "./demo";
import { cellOrigin, frameFor } from "./layout";

function demoWithShowreelLayout(): Demo {
  const demo = new Demo(defaultSizes, 64, { width: 1000, height: 700 });
  demo.reset(defaultSizes, showreelLayout);
  demo.holdBy = "where grabbed";
  demo.alwaysNudge = false;
  return demo;
}

test("items are held by their center unless set otherwise", () => {
  expect(new Demo(defaultSizes, 64, { width: 1000, height: 700 }).holdBy).toBe("item center");
});

describe("grabbing an item", () => {
  test("the item stays exactly where it was when picked up off-center", () => {
    const demo = demoWithShowreelLayout();
    const backpack = frameFor(demo.layout, "backpack");
    const barTop = cellOrigin(demo.layout, backpack, { x: 2, y: 0 });

    demo.press({ x: barTop.x + 5, y: barTop.y + 50 });

    expect(demo.heldCorner()).toEqual(barTop);
  });

  test("the item follows the pointer by the same amount it moves", () => {
    const demo = demoWithShowreelLayout();
    const backpack = frameFor(demo.layout, "backpack");
    const barTop = cellOrigin(demo.layout, backpack, { x: 2, y: 0 });

    demo.press({ x: barTop.x + 5, y: barTop.y + 50 });
    demo.move({ x: barTop.x + 5 + 37, y: barTop.y + 50 - 12 });

    expect(demo.heldCorner()).toEqual({ x: barTop.x + 37, y: barTop.y - 12 });
  });

  test("dropping without moving puts it back where it was", () => {
    const demo = demoWithShowreelLayout();
    const backpack = frameFor(demo.layout, "backpack");
    const barMiddle = cellOrigin(demo.layout, backpack, { x: 2, y: 1 });
    const point = { x: barMiddle.x + demo.layout.cellSize - 2, y: barMiddle.y + demo.layout.cellSize - 2 };

    demo.press(point);
    demo.release(point);

    expect(demo.inventory.placements).toContainEqual({
      itemId: "I3",
      gridId: "backpack",
      origin: { x: 2, y: 0 },
      rotation: 0,
    });
  });

  test("the drop target follows where the item is drawn, not the pointer", () => {
    const demo = demoWithShowreelLayout();
    const backpack = frameFor(demo.layout, "backpack");
    const barTop = cellOrigin(demo.layout, backpack, { x: 2, y: 0 });
    const grab = { x: barTop.x + 4, y: barTop.y + 4 };

    demo.press(grab);
    demo.move({ x: grab.x + demo.layout.pitch * 0.6, y: grab.y });

    expect(demo.target()?.origin).toEqual({ x: 3, y: 0 });
  });
});

describe("letting go where it can't land", () => {
  test("with always-nudge off, outside the grids sends the item back to its original spot", () => {
    const demo = demoWithShowreelLayout();
    demo.alwaysNudge = false;
    const backpack = frameFor(demo.layout, "backpack");
    const barTop = cellOrigin(demo.layout, backpack, { x: 2, y: 0 });

    demo.press({ x: barTop.x + 10, y: barTop.y + 10 });
    demo.rotate();
    demo.release({ x: demo.layout.width + 400, y: demo.layout.height + 400 });

    expect(demo.inventory.hand).toBeNull();
    expect(demo.inventory.placements).toContainEqual({
      itemId: "I3",
      gridId: "backpack",
      origin: { x: 2, y: 0 },
      rotation: 0,
    });
  });

  test("a drop the System rejects also sends it back", () => {
    const demo = new Demo(defaultSizes, 64, { width: 1000, height: 700 });
    const full = { backpackWidth: 2, backpackHeight: 2, stashWidth: 2, stashHeight: 2 };
    demo.reset(full, [
      { itemId: "dot-1", gridId: "backpack", origin: { x: 0, y: 0 }, rotation: 0 },
      { itemId: "dot-2", gridId: "backpack", origin: { x: 1, y: 0 }, rotation: 0 },
      { itemId: "dot-3", gridId: "backpack", origin: { x: 0, y: 1 }, rotation: 0 },
      { itemId: "domino", gridId: "stash", origin: { x: 0, y: 0 }, rotation: 0 },
    ]);
    const stash = frameFor(demo.layout, "stash");
    const backpack = frameFor(demo.layout, "backpack");
    const domino = cellOrigin(demo.layout, stash, { x: 0, y: 0 });
    const grab = { x: domino.x + 10, y: domino.y + 10 };
    const over = cellOrigin(demo.layout, backpack, { x: 0, y: 0 });

    demo.press(grab);
    demo.release({ x: over.x + 10, y: over.y + 10 });

    expect(demo.message).toBe("Rejected: no room to push those items aside, so it went back to its spot");
    expect(demo.inventory.placements).toContainEqual({
      itemId: "domino",
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
    const domino = cellOrigin(demo.layout, backpack, { x: 0, y: 3 });
    const grab = { x: domino.x + 10, y: domino.y + 10 };
    const target = cellOrigin(demo.layout, backpack, { x: 2, y: 1 });

    demo.press(grab);
    demo.release({ x: target.x + 10, y: target.y + 10 });

    expect(demo.message).toMatch(/^Pushed the /);
    expect(demo.inventory.hand).toBeNull();
    expect(demo.inventory.placements).toContainEqual({
      itemId: "domino",
      gridId: "backpack",
      origin: { x: 2, y: 1 },
      rotation: 0,
    });
  });
});

describe("always nudge", () => {
  function dropDotOntoL(demo: Demo) {
    const stash = frameFor(demo.layout, "stash");
    const dot = cellOrigin(demo.layout, stash, { x: 3, y: 3 });
    const l = cellOrigin(demo.layout, stash, { x: 0, y: 0 });
    demo.press({ x: dot.x + 10, y: dot.y + 10 });
    demo.move({ x: l.x + 10, y: l.y + 10 });
    const target = demo.target();
    demo.release({ x: l.x + 10, y: l.y + 10 });
    return target;
  }

  test("is on by default", () => {
    expect(new Demo(defaultSizes, 64, { width: 1000, height: 700 }).alwaysNudge).toBe(true);
  });

  test("slides the piece to a free spot next to it instead of swapping", () => {
    const demo = demoWithShowreelLayout();
    demo.alwaysNudge = true;

    expect(dropDotOntoL(demo)).toMatchObject({ origin: { x: 1, y: 0 }, nudged: true, outcome: { kind: "placed" } });
    expect(demo.inventory.hand).toBeNull();
    expect(demo.inventory.placements).toContainEqual({
      itemId: "dot-3",
      gridId: "stash",
      origin: { x: 1, y: 0 },
      rotation: 0,
    });
  });

  test("swaps when nothing within reach is free", () => {
    const demo = demoWithShowreelLayout();
    demo.alwaysNudge = true;
    demo.nudgeReach = 1;
    demo.reset(defaultSizes, [
      { itemId: "dot-1", gridId: "stash", origin: { x: 0, y: 0 }, rotation: 0 },
      { itemId: "dot-2", gridId: "stash", origin: { x: 1, y: 0 }, rotation: 0 },
      { itemId: "domino", gridId: "stash", origin: { x: 0, y: 1 }, rotation: 0 },
      { itemId: "dot-3", gridId: "stash", origin: { x: 3, y: 3 }, rotation: 0 },
    ]);

    expect(dropDotOntoL(demo)).toMatchObject({ nudged: false, outcome: { kind: "swapped" } });
  });

  test("when off, swaps right away", () => {
    const demo = demoWithShowreelLayout();
    expect(dropDotOntoL(demo)).toMatchObject({ nudged: false, outcome: { kind: "swapped" } });
  });
});

describe("rotating while holding", () => {
  test("E turns the other way, and the grab point stays under the pointer", () => {
    const demo = demoWithShowreelLayout();
    const backpack = frameFor(demo.layout, "backpack");
    const barTop = cellOrigin(demo.layout, backpack, { x: 2, y: 0 });
    const grab = { x: barTop.x + 10, y: barTop.y + 20 };

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
    const barTop = cellOrigin(demo.layout, backpack, { x: 2, y: 0 });
    const grab = { x: barTop.x + 5, y: barTop.y + 5 };

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
    const dot = cellOrigin(demo.layout, backpack, { x: 3, y: 0 });
    const grab = { x: dot.x + 10, y: dot.y + 10 };
    const free = cellOrigin(demo.layout, stash, { x: 2, y: 0 });
    const dropAt = { x: free.x + 10, y: free.y + 10 };

    demo.press(grab);
    demo.release(grab);
    expect(demo.inventory.hand?.itemId).toBe("dot-1");

    demo.move(dropAt);
    demo.press(dropAt);
    demo.release(dropAt);
    expect(demo.inventory.hand).toBeNull();
    expect(demo.inventory.placements).toContainEqual({
      itemId: "dot-1",
      gridId: "stash",
      origin: { x: 2, y: 0 },
      rotation: 0,
    });
  });

  test("press and drag stays the default, dropping on release", () => {
    const demo = demoWithShowreelLayout();
    const backpack = frameFor(demo.layout, "backpack");
    const dot = cellOrigin(demo.layout, backpack, { x: 3, y: 0 });
    const grab = { x: dot.x + 10, y: dot.y + 10 };

    demo.press(grab);
    demo.release(grab);

    expect(demo.pickUpBy).toBe("press and drag");
    expect(demo.inventory.hand).toBeNull();
  });
});

describe("nudge animation", () => {
  function nudgedDrop(demo: Demo): void {
    demo.alwaysNudge = true;
    const stash = frameFor(demo.layout, "stash");
    const dot = cellOrigin(demo.layout, stash, { x: 3, y: 3 });
    const l = cellOrigin(demo.layout, stash, { x: 0, y: 0 });
    demo.press({ x: dot.x + 10, y: dot.y + 10 });
    demo.move({ x: l.x + 10, y: l.y + 10 });
    demo.release({ x: l.x + 10, y: l.y + 10 });
  }

  test("a nudged drop animates the item from where it was let go into its cell", () => {
    const demo = demoWithShowreelLayout();
    nudgedDrop(demo);

    const [motion] = demo.motions;
    expect(motion).toMatchObject({ itemId: "dot-3", animation: demo.nudgeAnimation, offset: { x: -demo.layout.pitch, y: 0 } });
  });

  test("a drop that lands where it was let go does not animate", () => {
    const demo = demoWithShowreelLayout();
    const backpack = frameFor(demo.layout, "backpack");
    const dot = cellOrigin(demo.layout, backpack, { x: 3, y: 0 });

    demo.press({ x: dot.x + 10, y: dot.y + 10 });
    demo.release({ x: dot.x + 10, y: dot.y + 10 });

    expect(demo.motions).toEqual([]);
  });

  test("choosing none turns the animation off", () => {
    const demo = demoWithShowreelLayout();
    demo.nudgeAnimation = "none";
    nudgedDrop(demo);
    expect(demo.motions).toEqual([]);
  });
});

describe("preview animation", () => {
  function hoverDotOverL(demo: Demo) {
    demo.alwaysNudge = true;
    const stash = frameFor(demo.layout, "stash");
    const dot = cellOrigin(demo.layout, stash, { x: 3, y: 3 });
    const l = cellOrigin(demo.layout, stash, { x: 0, y: 0 });
    demo.press({ x: dot.x + 10, y: dot.y + 10 });
    demo.move({ x: l.x + 10, y: l.y + 10 });
    return demo.target();
  }

  function hoverDominoOverDots(demo: Demo) {
    demo.reset(defaultSizes, [
      { itemId: "dot-1", gridId: "stash", origin: { x: 0, y: 0 }, rotation: 0 },
      { itemId: "dot-2", gridId: "stash", origin: { x: 1, y: 0 }, rotation: 0 },
      { itemId: "domino", gridId: "stash", origin: { x: 0, y: 3 }, rotation: 0 },
    ]);
    const stash = frameFor(demo.layout, "stash");
    const domino = cellOrigin(demo.layout, stash, { x: 0, y: 3 });
    const dots = cellOrigin(demo.layout, stash, { x: 0, y: 0 });
    demo.press({ x: domino.x + 10, y: domino.y + 10 });
    demo.move({ x: dots.x + 10, y: dots.y + 10 });
    return demo.target();
  }

  test("nudge reach is unlimited by default", () => {
    expect(new Demo(defaultSizes, 64, { width: 1000, height: 700 }).nudgeReach).toBe(Infinity);
  });

  test("the preview slides from where the piece is aimed to where it would be nudged", () => {
    const demo = demoWithShowreelLayout();
    const target = hoverDotOverL(demo);

    expect(demo.previewMotions(target, 1000).get("dot-3")).toMatchObject({ offset: { x: -demo.layout.pitch, y: 0 } });
  });

  test("the preview keeps playing while the target stays the same, and plays again when it changes", () => {
    const demo = demoWithShowreelLayout();
    const target = hoverDotOverL(demo);
    demo.previewMotions(target, 1000);

    expect(demo.previewMotions(target, 5000).size).toBe(0);
    demo.previewMotions(null, 5001);
    expect(demo.previewMotions(target, 5002).get("dot-3")).toMatchObject({ offset: { x: -demo.layout.pitch, y: 0 } });
  });

  test("aiming at another cell with the same destination doesn't restart the slide", () => {
    const demo = demoWithShowreelLayout();
    const target = hoverDotOverL(demo);
    if (!target) throw new Error("no target");
    demo.previewMotions(target, 1000);

    const later = demo.previewMotions({ ...target, aimed: { x: 0, y: 1 } }, 1100).get("dot-3");

    expect(Math.abs(later?.offset.x ?? 0)).toBeLessThan(demo.layout.pitch);
    expect(later?.offset.y).toBe(0);
  });

  test("a new destination slides on from where the preview is shown", () => {
    const demo = demoWithShowreelLayout();
    const target = hoverDotOverL(demo);
    if (!target) throw new Error("no target");
    demo.previewMotions(target, 1000);

    const moved = demo.previewMotions({ ...target, origin: { x: 2, y: 0 } }, 1000).get("dot-3");

    expect(moved).toMatchObject({ offset: { x: -2 * demo.layout.pitch, y: 0 } });
  });

  test("pieces that would be pushed slide from their spot to where they'd go", () => {
    const demo = demoWithShowreelLayout();
    const target = hoverDominoOverDots(demo);
    expect(target?.outcome.kind).toBe("pushed");
    if (target?.outcome.kind !== "pushed") return;

    const motions = demo.previewMotions(target, 1000);
    const stash = frameFor(demo.layout, "stash");
    for (const destination of target.outcome.pushed) {
      const was = demo.inventory.placements.find((placement) => placement.itemId === destination.itemId);
      if (!was) throw new Error("missing placement");
      const from = cellOrigin(demo.layout, stash, was.origin);
      const to = cellOrigin(demo.layout, stash, destination.origin);
      expect(motions.get(destination.itemId)).toMatchObject({ offset: { x: from.x - to.x, y: from.y - to.y } });
    }
  });

  test("pushed pieces don't slide a second time when the drop lands after the preview finished", () => {
    const demo = demoWithShowreelLayout();
    demo.clock = () => 5000;
    const target = hoverDominoOverDots(demo);
    demo.previewMotions(target, 1000);
    const stash = frameFor(demo.layout, "stash");
    const dots = cellOrigin(demo.layout, stash, { x: 0, y: 0 });

    demo.release({ x: dots.x + 10, y: dots.y + 10 });

    expect(demo.message).toMatch(/^Pushed/);
    expect(demo.motions).toEqual([]);
  });

  test("choosing none turns the preview animation off", () => {
    const demo = demoWithShowreelLayout();
    demo.nudgeAnimation = "none";
    expect(demo.previewMotions(hoverDotOverL(demo), 1000).size).toBe(0);
  });
});
