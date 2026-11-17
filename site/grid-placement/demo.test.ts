import { describe, expect, test } from "vitest";
import { defaultSizes, showreelLayout } from "./catalog";
import { Demo } from "./demo";
import { cellOrigin, frameFor } from "./layout";

function demoWithShowreelLayout(): Demo {
  const demo = new Demo(defaultSizes, 64, { width: 1000, height: 700 });
  demo.reset(defaultSizes, showreelLayout);
  demo.holdBy = "where grabbed";
  return demo;
}

test("animations slide by default", () => {
  expect(new Demo(defaultSizes, 64, { width: 1000, height: 700 }).nudgeAnimation).toBe("slide");
});

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
  test("outside the grids sends the item back to its original spot", () => {
    const demo = demoWithShowreelLayout();
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

describe("covering one item", () => {
  function dropDotOntoL(demo: Demo) {
    const stash = frameFor(demo.layout, "stash");
    const dot = cellOrigin(demo.layout, stash, { x: 3, y: 3 });
    const l = cellOrigin(demo.layout, stash, { x: 0, y: 0 });
    demo.press({ x: dot.x + 10, y: dot.y + 10 });
    demo.move({ x: l.x + 10, y: l.y + 10 });
    demo.release({ x: l.x + 10, y: l.y + 10 });
  }

  test("swaps it out by default", () => {
    const demo = demoWithShowreelLayout();
    dropDotOntoL(demo);
    expect(demo.inventory.hand?.itemId).toBe("L3");
  });

  test("pushes it aside when set to push", () => {
    const demo = demoWithShowreelLayout();
    demo.oneCovered = "push";
    dropDotOntoL(demo);

    expect(demo.inventory.hand).toBeNull();
    expect(demo.message).toBe("Pushed the L 3-piece aside");
    expect(demo.inventory.placements).toContainEqual({ itemId: "dot-3", gridId: "stash", origin: { x: 0, y: 0 }, rotation: 0 });
  });
});

describe("rotation animation", () => {
  function holdBar(demo: Demo): void {
    const backpack = frameFor(demo.layout, "backpack");
    const barTop = cellOrigin(demo.layout, backpack, { x: 2, y: 0 });
    demo.press({ x: barTop.x + 10, y: barTop.y + 10 });
  }

  test("a turn starts drawn at the old angle and settles at the new one", () => {
    const demo = demoWithShowreelLayout();
    demo.clock = () => 1000;
    holdBar(demo);

    demo.rotate("clockwise");

    expect(demo.spinFor(1000)?.angle).toBeCloseTo(-Math.PI / 2);
    expect(demo.spinFor(9000)).toBeNull();
  });

  test("turning back starts from the other side", () => {
    const demo = demoWithShowreelLayout();
    demo.clock = () => 1000;
    holdBar(demo);

    demo.rotate("counter-clockwise");

    expect(demo.spinFor(1000)?.angle).toBeCloseTo(Math.PI / 2);
  });

  test("quick turns add up from where the piece is drawn", () => {
    const demo = demoWithShowreelLayout();
    demo.clock = () => 1000;
    holdBar(demo);

    demo.rotate("clockwise");
    demo.rotate("clockwise");

    expect(demo.spinFor(1000)?.angle).toBeCloseTo(-Math.PI);
  });

  test("choosing none turns it off", () => {
    const demo = demoWithShowreelLayout();
    demo.nudgeAnimation = "none";
    holdBar(demo);
    demo.rotate("clockwise");
    expect(demo.spinFor(demo.clock())).toBeNull();
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
    const backpack = frameFor(demo.layout, "backpack");
    const stash = frameFor(demo.layout, "stash");
    const barBottom = cellOrigin(demo.layout, backpack, { x: 2, y: 2 });
    const aim = cellOrigin(demo.layout, stash, { x: 2, y: 1 });
    demo.press({ x: barBottom.x + 10, y: barBottom.y + 10 });
    demo.move({ x: aim.x + 10, y: aim.y + 10 });
    demo.release({ x: aim.x + 10, y: aim.y + 10 });
  }

  test("a nudged drop animates the item from where it was let go into its cell", () => {
    const demo = demoWithShowreelLayout();
    nudgedDrop(demo);

    const [motion] = demo.motions;
    expect(motion).toMatchObject({ itemId: "I3", animation: demo.nudgeAnimation, offset: { x: 0, y: -demo.layout.pitch } });
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
  function hoverBarOffTheTop(demo: Demo) {
    const backpack = frameFor(demo.layout, "backpack");
    const stash = frameFor(demo.layout, "stash");
    const barBottom = cellOrigin(demo.layout, backpack, { x: 2, y: 2 });
    const aim = cellOrigin(demo.layout, stash, { x: 2, y: 1 });
    demo.press({ x: barBottom.x + 10, y: barBottom.y + 10 });
    demo.move({ x: aim.x + 10, y: aim.y + 10 });
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

  test("the preview slides from where the piece is aimed to where it would be nudged", () => {
    const demo = demoWithShowreelLayout();
    const target = hoverBarOffTheTop(demo);

    expect(target).toMatchObject({ aimed: { x: 2, y: -1 }, origin: { x: 2, y: 0 }, nudged: true });
    expect(demo.previewMotions(target, 1000).get("I3")).toMatchObject({ offset: { x: 0, y: -demo.layout.pitch } });
  });

  test("the preview keeps playing while the target stays the same, and plays again when it changes", () => {
    const demo = demoWithShowreelLayout();
    const target = hoverBarOffTheTop(demo);
    demo.previewMotions(target, 1000);

    expect(demo.previewMotions(target, 5000).size).toBe(0);
    demo.previewMotions(null, 5001);
    expect(demo.previewMotions(target, 5002).get("I3")).toMatchObject({ offset: { x: 0, y: -demo.layout.pitch } });
  });

  test("aiming at another cell with the same destination doesn't restart the slide", () => {
    const demo = demoWithShowreelLayout();
    const target = hoverBarOffTheTop(demo);
    if (!target) throw new Error("no target");
    demo.previewMotions(target, 1000);

    const later = demo.previewMotions({ ...target, aimed: { x: 2, y: -2 } }, 1100).get("I3");

    expect(Math.abs(later?.offset.y ?? 0)).toBeLessThan(demo.layout.pitch);
  });

  test("a new destination slides on from where the preview is shown", () => {
    const demo = demoWithShowreelLayout();
    const target = hoverBarOffTheTop(demo);
    if (!target) throw new Error("no target");
    demo.previewMotions(target, 1000);

    const moved = demo.previewMotions({ ...target, origin: { x: 3, y: 0 } }, 1000).get("I3");

    expect(moved).toMatchObject({ offset: { x: -demo.layout.pitch, y: -demo.layout.pitch } });
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

  test("pieces that would have been pushed slide back when the preview ends", () => {
    const demo = demoWithShowreelLayout();
    const target = hoverDominoOverDots(demo);
    if (target?.outcome.kind !== "pushed") throw new Error("expected a push");
    demo.previewMotions(target, 1000);
    demo.previewMotions(target, 5000);

    demo.previewMotions(null, 5000);

    const stash = frameFor(demo.layout, "stash");
    for (const destination of target.outcome.pushed) {
      const was = demo.inventory.placements.find((placement) => placement.itemId === destination.itemId);
      if (!was) throw new Error("missing placement");
      const from = cellOrigin(demo.layout, stash, destination.origin);
      const home = cellOrigin(demo.layout, stash, was.origin);
      expect(demo.motionFor(destination.itemId, 5000)).toMatchObject({ offset: { x: from.x - home.x, y: from.y - home.y } });
    }
    for (const destination of target.outcome.pushed) expect(demo.motionFor(destination.itemId, 9000)).toBeNull();
  });

  test("the piece being held doesn't slide anywhere when its preview ends", () => {
    const demo = demoWithShowreelLayout();
    demo.previewMotions(hoverBarOffTheTop(demo), 1000);
    demo.previewMotions(null, 1100);
    expect(demo.motions).toEqual([]);
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
    expect(demo.previewMotions(hoverBarOffTheTop(demo), 1000).size).toBe(0);
  });
});

describe("pushed pieces that turn", () => {
  function hoverDominoBesideBar(demo: Demo) {
    demo.oneCovered = "push";
    demo.reset({ ...defaultSizes, stashWidth: 3, stashHeight: 3 }, [
      { itemId: "I3", gridId: "stash", origin: { x: 0, y: 0 }, rotation: 0 },
      { itemId: "dot-1", gridId: "stash", origin: { x: 2, y: 2 }, rotation: 0 },
      { itemId: "dot-2", gridId: "stash", origin: { x: 1, y: 2 }, rotation: 0 },
      { itemId: "domino", gridId: "backpack", origin: { x: 0, y: 0 }, rotation: 0 },
    ]);
    const backpack = frameFor(demo.layout, "backpack");
    const stash = frameFor(demo.layout, "stash");
    const domino = cellOrigin(demo.layout, backpack, { x: 0, y: 0 });
    const aim = cellOrigin(demo.layout, stash, { x: 0, y: 1 });
    demo.press({ x: domino.x + 10, y: domino.y + 10 });
    demo.move({ x: aim.x + 10, y: aim.y + 10 });
    return demo.target();
  }

  test("the push lays the bar flat", () => {
    const target = hoverDominoBesideBar(demoWithShowreelLayout());
    expect(target?.outcome).toMatchObject({ kind: "pushed", pushed: [{ itemId: "I3", origin: { x: 0, y: 0 }, rotation: expect.any(Number) }] });
    if (target?.outcome.kind !== "pushed") return;
    expect(target.outcome.pushed[0]?.rotation).not.toBe(0);
  });

  test("the preview turns the piece a quarter turn while it slides", () => {
    const demo = demoWithShowreelLayout();
    const target = hoverDominoBesideBar(demo);

    const frame = demo.previewMotions(target, 1000).get("I3");

    expect(Math.abs(frame?.angle ?? 0)).toBeCloseTo(Math.PI / 2);
    expect(demo.previewMotions(target, 9000).get("I3")).toBeUndefined();
  });

  test("it turns back when the preview ends", () => {
    const demo = demoWithShowreelLayout();
    const target = hoverDominoBesideBar(demo);
    const turn = demo.previewMotions(target, 1000).get("I3")?.angle ?? 0;
    demo.previewMotions(target, 9000);

    demo.previewMotions(null, 9000);

    expect(demo.motionFor("I3", 9000)?.angle).toBeCloseTo(-turn);
  });

  test("a drop without a preview turns it as it lands", () => {
    const demo = demoWithShowreelLayout();
    demo.clock = () => 1000;
    const target = hoverDominoBesideBar(demo);
    if (!target) throw new Error("no target");
    const stash = frameFor(demo.layout, "stash");
    const aim = cellOrigin(demo.layout, stash, { x: 0, y: 1 });

    demo.release({ x: aim.x + 10, y: aim.y + 10 });

    expect(Math.abs(demo.motionFor("I3", 1000)?.angle ?? 0)).toBeCloseTo(Math.PI / 2);
  });
});
