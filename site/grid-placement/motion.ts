import type { Point } from "./layout";

export const nudgeAnimations = ["slide", "spring", "pop", "none"] as const;

export type NudgeAnimation = (typeof nudgeAnimations)[number];

export type Animation = Exclude<NudgeAnimation, "none">;

export type Motion = {
  readonly itemId: string;
  readonly offset: Point;
  readonly angle?: number;
  readonly duration?: number;
  readonly start: number;
  readonly animation: Animation;
};

export type MotionFrame = { readonly offset: Point; readonly angle: number; readonly scale: number };

export const animationSettings = {
  durations: {
    slide: 200,
    spring: 420,
    pop: 260,
  } satisfies Record<Animation, number>,
  springOvershoot: 1,
  popSwell: 0.14,
  pushMs: 180,
  pushMsPerCell: 60,
  pushMaxMs: 400,
};

export function pushDuration(cells: number): number {
  const { pushMs, pushMsPerCell, pushMaxMs } = animationSettings;
  return Math.min(pushMaxMs, pushMs + pushMsPerCell * cells);
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

const easeOutBack = (t: number) => {
  const overshoot = animationSettings.springOvershoot;
  return 1 + (overshoot + 1) * (t - 1) ** 3 + overshoot * (t - 1) ** 2;
};

const easings: Record<Animation, (t: number) => number> = {
  slide: easeOutCubic,
  spring: easeOutBack,
  pop: easeOutCubic,
};

type Style = { readonly duration: number; readonly ease: (t: number) => number; readonly swell: number };

function styleOf(animation: Animation): Style {
  return {
    duration: animationSettings.durations[animation],
    ease: easings[animation],
    swell: animation === "pop" ? animationSettings.popSwell : 0,
  };
}

export type Spin = {
  readonly angle: number;
  readonly start: number;
  readonly animation: Animation;
};

function settling(animation: Animation, start: number, now: number, duration?: number) {
  const style = styleOf(animation);
  const t = (now - start) / (duration ?? style.duration);
  if (t >= 1) return null;
  const progress = Math.max(0, t);
  return { remaining: 1 - style.ease(progress), scale: 1 + style.swell * Math.sin(Math.PI * progress) };
}

export function motionAt(motion: Motion, now: number): MotionFrame | null {
  const frame = settling(motion.animation, motion.start, now, motion.duration);
  if (!frame) return null;
  return {
    offset: { x: motion.offset.x * frame.remaining, y: motion.offset.y * frame.remaining },
    angle: (motion.angle ?? 0) * frame.remaining,
    scale: frame.scale,
  };
}

export function spinAt(spin: Spin, now: number): { angle: number; scale: number } | null {
  const frame = settling(spin.animation, spin.start, now);
  return frame && { angle: spin.angle * frame.remaining, scale: frame.scale };
}
