import { placementCells, type Cell, type Footprint } from "../../systems/grid-placement/src";
import { catalogItem, type CatalogItem } from "./catalog";
import type { MotionFrame } from "./motion";
import type { Demo, Target } from "./demo";
import { cellOrigin, type GridFrame, type Layout, type Point } from "./layout";

export type Palette = Record<"navy" | "navyDeep" | "navyRaised" | "coral" | "slate" | "slateDeep" | "pale" | "ink", string>;

export function readPalette(): Palette {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    navy: token("--navy"),
    navyDeep: token("--navy-deep"),
    navyRaised: token("--navy-raised"),
    coral: token("--coral"),
    slate: token("--slate"),
    slateDeep: token("--slate-deep"),
    pale: token("--pale"),
    ink: token("--ink"),
  };
}

type Rect = { x: number; y: number; width: number; height: number };

function has(cells: readonly Cell[], x: number, y: number): boolean {
  return cells.some((cell) => cell.x === x && cell.y === y);
}

function mergedRects(cells: readonly Cell[], layout: Layout, at: (cell: Cell) => Point): Rect[] {
  const { cellSize, gap } = layout;
  const rects: Rect[] = [];
  for (const cell of cells) {
    const { x, y } = at(cell);
    rects.push({ x, y, width: cellSize, height: cellSize });
    const right = has(cells, cell.x + 1, cell.y);
    const below = has(cells, cell.x, cell.y + 1);
    if (right) rects.push({ x: x + cellSize, y, width: gap, height: cellSize });
    if (below) rects.push({ x, y: y + cellSize, width: cellSize, height: gap });
    if (right && below && has(cells, cell.x + 1, cell.y + 1)) {
      rects.push({ x: x + cellSize, y: y + cellSize, width: gap, height: gap });
    }
  }
  return rects;
}

function bounds(rects: readonly Rect[]): Rect {
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function itemFill(ctx: CanvasRenderingContext2D, palette: Palette, item: CatalogItem, box: Rect): string | CanvasGradient {
  if (item.swatch === "coral") return palette.coral;
  if (item.swatch === "pale") return palette.pale;
  const gradient = ctx.createLinearGradient(0, box.y, 0, box.y + box.height);
  gradient.addColorStop(0, palette.slate);
  gradient.addColorStop(1, palette.slateDeep);
  return gradient;
}

function drawItem(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  layout: Layout,
  item: CatalogItem,
  cells: readonly Cell[],
  at: (cell: Cell) => Point,
): void {
  const rects = mergedRects(cells, layout, at);
  const box = bounds(rects);
  ctx.fillStyle = itemFill(ctx, palette, item, box);
  for (const rect of rects) ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  if (item.marked) {
    const first = cells[0];
    if (!first) return;
    const corner = at(first);
    ctx.fillStyle = palette.coral;
    ctx.beginPath();
    ctx.arc(corner.x + layout.cellSize / 2, corner.y + layout.cellSize / 2, layout.cellSize * 0.16, 0, Math.PI * 2);
    ctx.fill();
  }
}

function moved(ctx: CanvasRenderingContext2D, motion: MotionFrame | undefined | null, box: Rect, draw: () => void): void {
  ctx.save();
  if (motion) {
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    ctx.translate(cx + motion.offset.x, cy + motion.offset.y);
    ctx.scale(motion.scale, motion.scale);
    ctx.translate(-cx, -cy);
  }
  draw();
  ctx.restore();
}

function drawHatch(ctx: CanvasRenderingContext2D, palette: Palette, rect: Rect): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.width, rect.height);
  ctx.clip();
  ctx.strokeStyle = palette.pale;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  const step = 8;
  ctx.beginPath();
  for (let offset = -rect.height; offset < rect.width; offset += step) {
    ctx.moveTo(rect.x + offset, rect.y + rect.height);
    ctx.lineTo(rect.x + offset + rect.height, rect.y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawTarget(
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  demo: Demo,
  target: Target,
  held: Footprint,
  motions: Map<string, MotionFrame>,
): void {
  const { layout, inventory } = demo;
  const { frame, origin, outcome } = target;
  const cells = held
    .map((cell) => ({ x: origin.x + cell.x, y: origin.y + cell.y }))
    .filter((cell) => cell.x >= 0 && cell.y >= 0 && cell.x < frame.grid.width && cell.y < frame.grid.height);

  if (outcome.kind === "rejected") {
    for (const cell of cells) {
      const corner = cellOrigin(layout, frame, cell);
      drawHatch(ctx, palette, { x: corner.x, y: corner.y, width: layout.cellSize, height: layout.cellSize });
    }
    return;
  }

  const ghost = mergedRects(cells, layout, (cell) => cellOrigin(layout, frame, cell));
  const heldId = inventory.hand?.itemId;
  moved(ctx, heldId ? motions.get(heldId) : null, bounds(ghost), () => {
    ctx.fillStyle = palette.slate;
    ctx.globalAlpha = 0.35;
    for (const rect of ghost) ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  });

  if (outcome.kind === "pushed") {
    for (const destination of outcome.pushed) {
      const at = (cell: Cell) => cellOrigin(layout, frame, cell);
      const cellsThere = placementCells(inventory, destination);
      const box = bounds(mergedRects(cellsThere, layout, at));
      moved(ctx, motions.get(destination.itemId), box, () => {
        drawItem(ctx, palette, layout, catalogItem(destination.itemId), cellsThere, at);
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = palette.coral;
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x - 3, box.y - 3, box.width + 6, box.height + 6);
      });
    }
  }

  if (outcome.kind === "swapped") {
    const popped = inventory.placements.find((placement) => placement.itemId === outcome.poppedItemId);
    if (!popped) return;
    const box = bounds(
      mergedRects(placementCells(inventory, popped), layout, (cell) => cellOrigin(layout, frame, cell)),
    );
    ctx.strokeStyle = palette.coral;
    ctx.lineWidth = 3;
    ctx.strokeRect(box.x - 3, box.y - 3, box.width + 6, box.height + 6);
  }
}

function drawFrame(ctx: CanvasRenderingContext2D, palette: Palette, layout: Layout, frame: GridFrame): void {
  ctx.fillStyle = palette.navyDeep;
  ctx.fillRect(frame.x - layout.gap, frame.y - layout.gap, frame.width + layout.gap * 2, frame.height + layout.gap * 2);
  ctx.fillStyle = palette.navyRaised;
  for (let y = 0; y < frame.grid.height; y++) {
    for (let x = 0; x < frame.grid.width; x++) {
      const corner = cellOrigin(layout, frame, { x, y });
      ctx.fillRect(corner.x, corner.y, layout.cellSize, layout.cellSize);
    }
  }
  ctx.fillStyle = palette.ink;
  ctx.globalAlpha = 0.7;
  ctx.font = "600 12px 'Space Grotesk', system-ui, sans-serif";
  ctx.textBaseline = "bottom";
  ctx.fillText(frame.grid.id.toUpperCase(), frame.x - layout.gap, frame.y - layout.gap - 6);
  ctx.globalAlpha = 1;
}

export function render(ctx: CanvasRenderingContext2D, palette: Palette, demo: Demo, now: number): void {
  const { layout, inventory } = demo;
  ctx.clearRect(0, 0, layout.width, layout.height);

  for (const frame of layout.frames) drawFrame(ctx, palette, layout, frame);

  const held = demo.heldFootprint();
  const target = demo.target();
  const pushedIds = target?.outcome.kind === "pushed" ? target.outcome.pushed.map((placement) => placement.itemId) : [];

  for (const placement of inventory.placements) {
    const frame = layout.frames.find((candidate) => candidate.grid.id === placement.gridId);
    if (!frame) continue;
    const cells = placementCells(inventory, placement);
    const at = (cell: Cell) => cellOrigin(layout, frame, cell);
    moved(ctx, demo.motionFor(placement.itemId, now), bounds(mergedRects(cells, layout, at)), () => {
      ctx.globalAlpha = pushedIds.includes(placement.itemId) ? 0.22 : 1;
      drawItem(ctx, palette, layout, catalogItem(placement.itemId), cells, at);
    });
  }

  const previews = demo.previewMotions(target, now);
  if (held && target) drawTarget(ctx, palette, demo, target, held, previews);

  const grabbed = held?.[demo.grabIndex];
  const corner = demo.heldCorner();
  if (held && grabbed && corner && demo.pointer && inventory.hand) {
    const pointer = demo.pointer;
    const at = (cell: Cell): Point => ({
      x: corner.x + (cell.x - grabbed.x) * layout.pitch,
      y: corner.y + (cell.y - grabbed.y) * layout.pitch,
    });
    const spin = demo.spinFor(now);
    ctx.save();
    if (spin) {
      ctx.translate(pointer.x, pointer.y);
      ctx.rotate(spin.angle);
      ctx.scale(spin.scale, spin.scale);
      ctx.translate(-pointer.x, -pointer.y);
    }
    ctx.globalAlpha = 0.88;
    drawItem(ctx, palette, layout, catalogItem(inventory.hand.itemId), held, at);
    ctx.restore();
    ctx.fillStyle = palette.coral;
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}
