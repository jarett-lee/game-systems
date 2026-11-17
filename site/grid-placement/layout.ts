import type { Cell, GridSpec } from "../../systems/grid-placement/src";

export type Point = { readonly x: number; readonly y: number };

export type GridFrame = {
  readonly grid: GridSpec;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type Layout = {
  readonly cellSize: number;
  readonly gap: number;
  readonly pitch: number;
  readonly margin: number;
  readonly width: number;
  readonly height: number;
  readonly frames: readonly GridFrame[];
};

export function computeLayout(
  grids: readonly GridSpec[],
  preferredCellSize: number,
  available: { width: number; height: number },
): Layout {
  const gap = 4;
  const margin = 16;
  const labelSpace = 28;
  const spacing = 48;
  const totalCols = grids.reduce((sum, grid) => sum + grid.width, 0);
  const tallest = Math.max(...grids.map((grid) => grid.height));
  const widest = Math.max(...grids.map((grid) => grid.width));
  const totalRows = grids.reduce((sum, grid) => sum + grid.height, 0);

  const sideBySidePitch = Math.min(
    (available.width - 2 * margin - spacing * (grids.length - 1)) / totalCols,
    (available.height - 2 * margin - labelSpace) / tallest,
  );
  const stackedPitch = Math.min(
    (available.width - 2 * margin) / widest,
    (available.height - 2 * margin - labelSpace - spacing * (grids.length - 1)) / totalRows,
  );
  const stacked = stackedPitch > sideBySidePitch;
  const pitch = Math.max(20, Math.floor(Math.min(preferredCellSize + gap, stacked ? stackedPitch : sideBySidePitch)));
  const cellSize = pitch - gap;

  const frames: GridFrame[] = [];
  let cursor = stacked ? margin + labelSpace : margin;
  for (const grid of grids) {
    const width = grid.width * pitch - gap;
    const height = grid.height * pitch - gap;
    frames.push(
      stacked
        ? { grid, x: margin, y: cursor, width, height }
        : { grid, x: cursor, y: margin + labelSpace, width, height },
    );
    cursor += (stacked ? height : width) + spacing;
  }

  const width = Math.max(...frames.map((frame) => frame.x + frame.width)) + margin;
  const height = Math.max(...frames.map((frame) => frame.y + frame.height)) + margin;
  return { cellSize, gap, pitch, margin, width, height, frames };
}

export function cellOrigin(layout: Layout, frame: GridFrame, cell: Cell): Point {
  return { x: frame.x + cell.x * layout.pitch, y: frame.y + cell.y * layout.pitch };
}

export function cellCenter(layout: Layout, frame: GridFrame, cell: Cell): Point {
  const origin = cellOrigin(layout, frame, cell);
  return { x: origin.x + layout.cellSize / 2, y: origin.y + layout.cellSize / 2 };
}

export function frameFor(layout: Layout, gridId: string): GridFrame {
  const frame = layout.frames.find((candidate) => candidate.grid.id === gridId);
  if (!frame) throw new Error(`No frame for grid "${gridId}"`);
  return frame;
}

export function cellUnder(layout: Layout, frame: GridFrame, point: Point): Cell {
  return {
    x: Math.floor((point.x - frame.x + layout.gap / 2) / layout.pitch),
    y: Math.floor((point.y - frame.y + layout.gap / 2) / layout.pitch),
  };
}

export function frameNear(layout: Layout, point: Point): GridFrame | null {
  const reach = layout.pitch;
  return (
    layout.frames.find(
      (frame) =>
        point.x >= frame.x - reach &&
        point.x <= frame.x + frame.width + reach &&
        point.y >= frame.y - reach &&
        point.y <= frame.y + frame.height + reach,
    ) ?? null
  );
}

export function insideFrame(frame: GridFrame, point: Point): boolean {
  return point.x >= frame.x && point.x < frame.x + frame.width && point.y >= frame.y && point.y < frame.y + frame.height;
}
