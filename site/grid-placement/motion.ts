import type { Point } from "./layout";

export const nudgeAnimations = ["slide", "spring", "bounce", "pop", "none"] as const;

export type NudgeAnimation = (typeof nudgeAnimations)[number];

export type Motion = {
  readonly itemId: string;
  readonly offset: Point;
  readonly start: number;
  readonly animation: Exclude<NudgeAnimation, "none">;
};

export type MotionFrame = { readonly offset: Point; readonly scale: number };

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

const easeOutBack = (t: number) => {
  const overshoot = 2.2;
  return 1 + (overshoot + 1) * (t - 1) ** 3 + overshoot * (t - 1) ** 2;
};

const easeOutBounce = (t: number) => {
  const n = 7.5625;
  const d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t - 1.5 / d) ** 2 + 0.75;
  if (t < 2.5 / d) return n * (t - 2.25 / d) ** 2 + 0.9375;
  return n * (t - 2.625 / d) ** 2 + 0.984375;
};

const styles: Record<Motion["animation"], { duration: number; ease: (t: number) => number; swell: number }> = {
  slide: { duration: 200, ease: easeOutCubic, swell: 0 },
  spring: { duration: 420, ease: easeOutBack, swell: 0 },
  bounce: { duration: 520, ease: easeOutBounce, swell: 0 },
  pop: { duration: 260, ease: easeOutCubic, swell: 0.14 },
};

export type Spin = {
  readonly angle: number;
  readonly start: number;
  readonly animation: Exclude<NudgeAnimation, "none">;
};

function settling(animation: Motion["animation"], start: number, now: number) {
  const style = styles[animation];
  const t = (now - start) / style.duration;
  if (t >= 1) return null;
  const progress = Math.max(0, t);
  return { remaining: 1 - style.ease(progress), scale: 1 + style.swell * Math.sin(Math.PI * progress) };
}

export function motionAt(motion: Motion, now: number): MotionFrame | null {
  const frame = settling(motion.animation, motion.start, now);
  if (!frame) return null;
  return {
    offset: { x: motion.offset.x * frame.remaining, y: motion.offset.y * frame.remaining },
    scale: frame.scale,
  };
}

export function spinAt(spin: Spin, now: number): { angle: number; scale: number } | null {
  const frame = settling(spin.animation, spin.start, now);
  return frame && { angle: spin.angle * frame.remaining, scale: frame.scale };
}
