import { describe, expect, test } from "vitest";
import { motionAt, nudgeAnimations, type Motion } from "./motion";

const motion = (animation: Motion["animation"]): Motion => ({
  itemId: "T",
  offset: { x: 100, y: -40 },
  start: 1000,
  animation,
});

describe.each(nudgeAnimations.filter((animation) => animation !== "none"))("%s", (animation) => {
  test("starts where the item was let go", () => {
    expect(motionAt(motion(animation), 1000)).toMatchObject({ offset: { x: 100, y: -40 } });
  });

  test("ends exactly in its cell at normal size", () => {
    expect(motionAt(motion(animation), 5000)).toBeNull();
  });
});

test("spring overshoots its cell before settling", () => {
  const xs = Array.from({ length: 60 }, (_, step) => motionAt(motion("spring"), 1000 + step * 8)?.offset.x ?? 0);
  expect(Math.min(...xs)).toBeLessThan(0);
});

test("bounce never passes its cell", () => {
  const xs = Array.from({ length: 80 }, (_, step) => motionAt(motion("bounce"), 1000 + step * 8)?.offset.x ?? 0);
  expect(Math.min(...xs)).toBeGreaterThanOrEqual(-0.001);
});

test("pop swells the item while it slides", () => {
  const scales = Array.from({ length: 40 }, (_, step) => motionAt(motion("pop"), 1000 + step * 8)?.scale ?? 1);
  expect(Math.max(...scales)).toBeGreaterThan(1.05);
});
