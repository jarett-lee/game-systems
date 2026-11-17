import { describe, expect, test } from "vitest";
import { animationSettings, motionAt, nudgeAnimations, type Motion } from "./motion";

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

test("spring overshoots one notch by default", () => {
  expect(animationSettings.springOvershoot).toBe(1);
});

test("elastic swings past its cell more than once", () => {
  const xs = Array.from({ length: 80 }, (_, step) => motionAt(motion("elastic"), 1000 + step * 8)?.offset.x ?? 0);
  const crossings = xs.slice(1).filter((x, step) => Math.sign(x) !== Math.sign(xs[step] ?? 0)).length;
  expect(crossings).toBeGreaterThan(1);
});

test.each(["ease out", "ease in", "ease in-out", "linear"] as const)("%s never passes its cell", (animation) => {
  const xs = Array.from({ length: 60 }, (_, step) => motionAt(motion(animation), 1000 + step * 5)?.offset.x ?? 0);
  expect(Math.min(...xs)).toBeGreaterThanOrEqual(-0.001);
});

test("ease in starts slow and ease out starts fast", () => {
  const early = (animation: Motion["animation"]) => 100 - (motionAt(motion(animation), 1040)?.offset.x ?? 0);
  expect(early("ease in")).toBeLessThan(early("linear"));
  expect(early("ease out")).toBeGreaterThan(early("linear"));
});

test("pop swells the item while it slides", () => {
  const scales = Array.from({ length: 40 }, (_, step) => motionAt(motion("pop"), 1000 + step * 8)?.scale ?? 1);
  expect(Math.max(...scales)).toBeGreaterThan(1.05);
});

test("a longer duration slows the animation down", () => {
  const before = motionAt(motion("ease out"), 1100)?.offset.x ?? 0;
  const saved = animationSettings.durations["ease out"];
  animationSettings.durations["ease out"] = 800;
  const after = motionAt(motion("ease out"), 1100)?.offset.x ?? 0;
  animationSettings.durations["ease out"] = saved;
  expect(after).toBeGreaterThan(before);
});
