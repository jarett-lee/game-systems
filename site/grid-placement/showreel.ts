import type { Cell } from "../../systems/grid-placement/src";
import { defaultSizes, showreelLayout } from "./catalog";
import type { Demo } from "./demo";
import { cellCenter, frameFor, type Point } from "./layout";

type Spot = { readonly grid: "backpack" | "stash"; readonly cell: Cell };

type Step =
  | { readonly do: "caption"; readonly text: string }
  | { readonly do: "press"; readonly at: Spot }
  | { readonly do: "move"; readonly to: Spot }
  | { readonly do: "release" }
  | { readonly do: "rotate" }
  | { readonly do: "one item covered"; readonly then: Demo["oneCovered"] }
  | { readonly do: "wait"; readonly ms: number };

const at = (grid: Spot["grid"], x: number, y: number): Spot => ({ grid, cell: { x, y } });

export const showreel: readonly Step[] = [
  { do: "caption", text: "Drag any shape" },
  { do: "press", at: at("backpack", 2, 1) },
  { do: "move", to: at("stash", 2, 1) },
  { do: "wait", ms: 500 },
  { do: "caption", text: "Rotate in 90° steps" },
  { do: "rotate" },
  { do: "wait", ms: 1100 },
  { do: "move", to: at("stash", 2, 2) },
  { do: "release" },
  { do: "wait", ms: 500 },
  { do: "caption", text: "Two items underneath? They get pushed aside." },
  { do: "press", at: at("backpack", 1, 1) },
  { do: "move", to: at("backpack", 3, 1) },
  { do: "wait", ms: 1200 },
  { do: "move", to: at("backpack", 5, 1) },
  { do: "release" },
  { do: "wait", ms: 400 },
  { do: "caption", text: "One item underneath? It's pushed aside too." },
  { do: "press", at: at("backpack", 0, 3) },
  { do: "move", to: at("backpack", 2, 0) },
  { do: "wait", ms: 1100 },
  { do: "release" },
  { do: "wait", ms: 500 },
  { do: "caption", text: "Or set it to swap" },
  { do: "one item covered", then: "swap" },
  { do: "press", at: at("backpack", 1, 0) },
  { do: "move", to: at("stash", 1, 2) },
  { do: "wait", ms: 900 },
  { do: "release" },
  { do: "caption", text: "The swapped item pops into your hand" },
  { do: "wait", ms: 900 },
  { do: "move", to: at("stash", 2, 0) },
  { do: "release" },
  { do: "one item covered", then: "push" },
  { do: "wait", ms: 400 },
  { do: "caption", text: "Move items between grids" },
  { do: "press", at: at("stash", 0, 0) },
  { do: "move", to: at("backpack", 1, 0) },
  { do: "wait", ms: 400 },
  { do: "rotate" },
  { do: "wait", ms: 600 },
  { do: "release" },
  { do: "wait", ms: 1400 },
];

const moveMs = 650;

function nextFrame(): Promise<number> {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

async function glide(demo: Demo, to: Point): Promise<void> {
  const from = demo.pointer ?? { x: demo.layout.width / 2, y: demo.layout.height / 2 };
  const start = await nextFrame();
  for (let now = start; now - start < moveMs; now = await nextFrame()) {
    const t = ease((now - start) / moveMs);
    demo.move({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t });
  }
  demo.move(to);
}

function pointAt(demo: Demo, spot: Spot): Point {
  return cellCenter(demo.layout, frameFor(demo.layout, spot.grid), spot.cell);
}

export function prepareShowreel(demo: Demo): void {
  demo.reset(defaultSizes, showreelLayout);
  demo.holdBy = "where grabbed";
  demo.pickUpBy = "press and drag";
  demo.oneCovered = "push";
}

export function act(demo: Demo, step: Step): void {
  switch (step.do) {
    case "press":
      demo.press(pointAt(demo, step.at));
      break;
    case "move":
      demo.move(pointAt(demo, step.to));
      break;
    case "release":
      if (demo.pointer) demo.release(demo.pointer);
      break;
    case "rotate":
      demo.rotate();
      break;
    case "one item covered":
      demo.oneCovered = step.then;
      break;
    case "caption":
    case "wait":
      break;
  }
}

export async function playShowreel(demo: Demo, onCaption: (text: string) => void): Promise<void> {
  const settings = { holdBy: demo.holdBy, pickUpBy: demo.pickUpBy, oneCovered: demo.oneCovered };
  prepareShowreel(demo);
  demo.move({ x: demo.layout.width / 2, y: demo.layout.height / 2 });
  for (const step of showreel) {
    if (step.do === "caption") onCaption(step.text);
    if (step.do === "wait") await sleep(step.ms);
    if (step.do === "press") await glide(demo, pointAt(demo, step.at));
    if (step.do === "move") await glide(demo, pointAt(demo, step.to));
    act(demo, step);
  }
  onCaption("");
  Object.assign(demo, settings);
}
