import { describe, expect, test } from "vitest";
import { animationSettings, motionAt, nudgeAnimations, pushDuration, type Motion } from "./motion";

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

test("spring overshoot defaults to 1", () => {
  expect(animationSettings.springOvershoot).toBe(1);
});

test("slide never passes its cell", () => {
  const xs = Array.from({ length: 60 }, (_, step) => motionAt(motion("slide"), 1000 + step * 5)?.offset.x ?? 0);
  expect(Math.min(...xs)).toBeGreaterThanOrEqual(-0.001);
});

test("pop swells the item while it slides", () => {
  const scales = Array.from({ length: 40 }, (_, step) => motionAt(motion("pop"), 1000 + step * 8)?.scale ?? 1);
  expect(Math.max(...scales)).toBeGreaterThan(1.05);
});

test("a longer duration slows the animation down", () => {
  const before = motionAt(motion("slide"), 1100)?.offset.x ?? 0;
  const saved = animationSettings.durations.slide;
  animationSettings.durations.slide = 800;
  const after = motionAt(motion("slide"), 1100)?.offset.x ?? 0;
  animationSettings.durations.slide = saved;
  expect(after).toBeGreaterThan(before);
});

test("push duration grows with distance and stops at the cap", () => {
  expect(pushDuration(0)).toBe(animationSettings.pushMs);
  expect(pushDuration(2)).toBe(animationSettings.pushMs + 2 * animationSettings.pushMsPerCell);
  expect(pushDuration(100)).toBe(animationSettings.pushMaxMs);
});

test("a motion with its own duration lasts that long", () => {
  const long = { ...motion("slide"), duration: 1000 };
  expect(motionAt(long, 1999)).not.toBeNull();
  expect(motionAt(long, 2000)).toBeNull();
});
