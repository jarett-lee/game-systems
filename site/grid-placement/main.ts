import { Pane } from "tweakpane";
import { mountBackdrop } from "../shared/backdrop";
import { defaultSizes, type GridSizes } from "./catalog";
import { Demo } from "./demo";
import { readPalette, render } from "./render";
import { playShowreel } from "./showreel";

mountBackdrop();

function required<Kind extends Element>(selector: string, kind: new () => Kind): Kind {
  const element = document.querySelector(selector);
  if (!(element instanceof kind)) throw new Error(`Missing ${selector}`);
  return element;
}

const stage = required(".stage", HTMLElement);
const canvas = required("canvas", HTMLCanvasElement);
const status = required(".status", HTMLElement);
const caption = required(".caption", HTMLElement);
const context = canvas.getContext("2d");
if (!context) throw new Error("Canvas 2D is not available");
const ctx = context;

const params = new URLSearchParams(location.search);
const recording = params.has("showreel");
document.body.classList.toggle("recording", recording);

const settings: GridSizes & { cellSize: number } = { ...defaultSizes, cellSize: 64 };
const palette = readPalette();

function available() {
  const box = stage.getBoundingClientRect();
  return { width: box.width, height: recording ? box.height : Math.max(320, window.innerHeight - box.top - 96) };
}

const demo = new Demo(defaultSizes, settings.cellSize, available());
let playing = false;

function fitCanvas(): void {
  const ratio = window.devicePixelRatio || 1;
  const { width, height } = demo.layout;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function relayout(): void {
  demo.resize(available(), settings.cellSize);
  fitCanvas();
}

function toCanvas(event: PointerEvent | MouseEvent) {
  const box = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - box.left) * demo.layout.width) / box.width,
    y: ((event.clientY - box.top) * demo.layout.height) / box.height,
  };
}

let primaryPointer: number | null = null;

canvas.addEventListener("pointerdown", (event) => {
  if (playing) return;
  if (event.button === 2) return;
  if (primaryPointer !== null && event.pointerId !== primaryPointer) {
    demo.rotate();
    return;
  }
  primaryPointer = event.pointerId;
  demo.press(toCanvas(event));
  if (canvas.hasPointerCapture(event.pointerId)) return;
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch {
    primaryPointer = event.pointerId;
  }
});

canvas.addEventListener("pointermove", (event) => {
  if (playing) return;
  if (primaryPointer !== null && event.pointerId !== primaryPointer) return;
  demo.move(toCanvas(event));
});

function finishPress(event: PointerEvent): void {
  if (playing || event.pointerId !== primaryPointer) return;
  primaryPointer = null;
  demo.release(toCanvas(event));
}

window.addEventListener("pointerup", finishPress);
canvas.addEventListener("lostpointercapture", finishPress);

window.addEventListener("pointercancel", (event) => {
  if (event.pointerId === primaryPointer) primaryPointer = null;
});

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  if (!playing) demo.rotate();
});

window.addEventListener("keydown", (event) => {
  if (playing) return;
  if (event.key === "r" || event.key === "R") demo.rotate("clockwise");
  if (event.key === "e" || event.key === "E") demo.rotate("counter-clockwise");
  if (event.key === "Escape") demo.stowHeld();
});

window.addEventListener("resize", relayout);

async function runShowreel(): Promise<void> {
  if (playing) return;
  playing = true;
  document.body.classList.add("playing");
  Object.assign(settings, defaultSizes);
  pane.refresh();
  relayout();
  await playShowreel(demo, (text) => {
    caption.textContent = text;
    caption.hidden = text === "";
  });
  playing = false;
  document.body.classList.remove("playing");
  document.body.dataset.showreel = "done";
}

const pane = new Pane({ title: "Grid Placement", container: required(".controls", HTMLElement) });
const grids = pane.addFolder({ title: "Grids" });
const resetFromSettings = () => {
  if (playing) return;
  demo.reset(settings);
  relayout();
};
grids.addBinding(settings, "backpackWidth", { label: "backpack w", min: 2, max: 10, step: 1 }).on("change", resetFromSettings);
grids.addBinding(settings, "backpackHeight", { label: "backpack h", min: 2, max: 8, step: 1 }).on("change", resetFromSettings);
grids.addBinding(settings, "stashWidth", { label: "stash w", min: 2, max: 10, step: 1 }).on("change", resetFromSettings);
grids.addBinding(settings, "stashHeight", { label: "stash h", min: 2, max: 8, step: 1 }).on("change", resetFromSettings);
pane.addBinding(settings, "cellSize", { label: "cell size", min: 28, max: 96, step: 2 }).on("change", relayout);
pane.addBinding(demo, "holdBy", {
  label: "hold item by",
  options: { "where grabbed": "where grabbed", "item center": "item center" },
});
pane.addButton({ title: "Rotate held (R)" }).on("click", () => demo.rotate("clockwise"));
pane.addButton({ title: "Rotate held back (E)" }).on("click", () => demo.rotate("counter-clockwise"));
pane.addButton({ title: "Stow held (Esc)" }).on("click", () => demo.stowHeld());
pane.addButton({ title: "Reset items" }).on("click", resetFromSettings);
pane.addButton({ title: "Play Showreel" }).on("click", () => void runShowreel());

function frame(): void {
  render(ctx, palette, demo);
  status.textContent = demo.message;
  requestAnimationFrame(frame);
}

relayout();
requestAnimationFrame(frame);
if (recording) void document.fonts.ready.then(runShowreel);
