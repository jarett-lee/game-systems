import {
  createInventory,
  drop,
  itemAt,
  popOut,
  previewDrop,
  rotateFootprint,
  rotateHand,
  stow,
  type Cell,
  type DropOutcome,
  type Footprint,
  type Inventory,
  type Placement,
} from "../../systems/grid-placement/src";
import { catalog, catalogItem, type GridSizes } from "./catalog";
import {
  cellOrigin,
  cellUnder,
  computeLayout,
  frameNear,
  insideFrame,
  type GridFrame,
  type Layout,
  type Point,
} from "./layout";

export type Target = { readonly frame: GridFrame; readonly origin: Cell; readonly outcome: DropOutcome };

function gridsFor(sizes: GridSizes) {
  return [
    { id: "backpack", width: sizes.backpackWidth, height: sizes.backpackHeight },
    { id: "stash", width: sizes.stashWidth, height: sizes.stashHeight },
  ];
}

function centerIndex(footprint: Footprint): number {
  const cx = footprint.reduce((sum, cell) => sum + cell.x, 0) / footprint.length;
  const cy = footprint.reduce((sum, cell) => sum + cell.y, 0) / footprint.length;
  let best = 0;
  footprint.forEach((cell, index) => {
    const bestCell = footprint[best] ?? cell;
    if (Math.hypot(cell.x - cx, cell.y - cy) < Math.hypot(bestCell.x - cx, bestCell.y - cy)) best = index;
  });
  return best;
}

export class Demo {
  inventory: Inventory;
  layout: Layout;
  pointer: Point | null = null;
  grabIndex = 0;
  grabOffset: Point = { x: 0, y: 0 };
  message = "Drag an item. R or right-click rotates it.";

  constructor(
    private sizes: GridSizes,
    private preferredCellSize: number,
    private available: { width: number; height: number },
  ) {
    this.inventory = createInventory(gridsFor(sizes), catalog);
    this.layout = computeLayout(this.inventory.grids, preferredCellSize, available);
    this.stowEverything();
  }

  resize(available: { width: number; height: number }, preferredCellSize = this.preferredCellSize): void {
    this.available = available;
    this.preferredCellSize = preferredCellSize;
    this.layout = computeLayout(this.inventory.grids, preferredCellSize, available);
  }

  reset(sizes: GridSizes = this.sizes, placements?: readonly Placement[]): void {
    this.sizes = sizes;
    this.inventory = createInventory(gridsFor(sizes), catalog);
    this.layout = computeLayout(this.inventory.grids, this.preferredCellSize, this.available);
    this.pointer = null;
    if (placements) {
      this.inventory = { ...this.inventory, placements };
    } else {
      this.stowEverything();
    }
  }

  private stowEverything(): void {
    for (const item of catalog) {
      this.inventory = stow({ ...this.inventory, hand: { itemId: item.id, rotation: 0 } }).inventory;
    }
    this.inventory = { ...this.inventory, hand: null };
  }

  heldFootprint(): Footprint | null {
    const { hand } = this.inventory;
    if (!hand) return null;
    return rotateFootprint(catalogItem(hand.itemId).footprint, hand.rotation);
  }

  heldCorner(): Point | null {
    if (!this.pointer || !this.inventory.hand) return null;
    return { x: this.pointer.x - this.grabOffset.x, y: this.pointer.y - this.grabOffset.y };
  }

  private centerGrab(): void {
    const footprint = this.heldFootprint();
    this.grabIndex = footprint ? centerIndex(footprint) : 0;
    this.grabOffset = { x: this.layout.cellSize / 2, y: this.layout.cellSize / 2 };
  }

  target(): Target | null {
    const footprint = this.heldFootprint();
    const corner = this.heldCorner();
    if (!footprint || !corner) return null;
    const anchor = { x: corner.x + this.layout.cellSize / 2, y: corner.y + this.layout.cellSize / 2 };
    const frame = frameNear(this.layout, anchor);
    const grabbed = footprint[this.grabIndex];
    if (!frame || !grabbed) return null;
    const cell = cellUnder(this.layout, frame, anchor);
    const origin = { x: cell.x - grabbed.x, y: cell.y - grabbed.y };
    return { frame, origin, outcome: previewDrop(this.inventory, frame.grid.id, origin) };
  }

  press(point: Point): void {
    this.pointer = point;
    if (this.inventory.hand) return;
    const frame = this.layout.frames.find((candidate) => insideFrame(candidate, point));
    if (!frame) return;
    const cell = cellUnder(this.layout, frame, point);
    const itemId = itemAt(this.inventory, frame.grid.id, cell);
    if (!itemId) return;
    const placement = this.inventory.placements.find((candidate) => candidate.itemId === itemId);
    if (!placement) return;
    const result = popOut(this.inventory, itemId);
    if (result.outcome.kind !== "popped") return;
    const footprint = rotateFootprint(catalogItem(itemId).footprint, placement.rotation);
    this.grabIndex = Math.max(
      0,
      footprint.findIndex((c) => c.x === cell.x - placement.origin.x && c.y === cell.y - placement.origin.y),
    );
    const corner = cellOrigin(this.layout, frame, cell);
    this.grabOffset = { x: point.x - corner.x, y: point.y - corner.y };
    this.inventory = result.inventory;
    this.message = `Picked up the ${itemId}`;
  }

  move(point: Point): void {
    this.pointer = point;
  }

  release(point: Point): void {
    this.pointer = point;
    if (!this.inventory.hand) return;
    const target = this.target();
    if (!target) {
      this.message = "Hold it over a grid to drop it. Esc stows it.";
      return;
    }
    const result = drop(this.inventory, target.frame.grid.id, target.origin);
    this.inventory = result.inventory;
    this.message = describeDrop(result.outcome);
    if (result.outcome.kind === "swapped") this.centerGrab();
  }

  rotate(): void {
    if (!this.inventory.hand) return;
    this.inventory = rotateHand(this.inventory);
    this.grabOffset = { x: this.layout.cellSize - this.grabOffset.y, y: this.grabOffset.x };
    this.message = "Rotated";
  }

  stowHeld(): void {
    if (!this.inventory.hand) return;
    const result = stow(this.inventory);
    this.inventory = result.inventory;
    this.message = result.outcome.kind === "placed" ? "Stowed in the first free spot" : "No space to stow it";
  }
}

export function describeDrop(outcome: DropOutcome): string {
  switch (outcome.kind) {
    case "placed":
      return "Placed";
    case "swapped":
      return `Swapped: the ${outcome.poppedItemId} popped out`;
    case "rejected":
      if (outcome.reason === "covers-several") return "Rejected: it would cover two items";
      if (outcome.reason === "out-of-bounds") return "Rejected: off the edge of the grid";
      return "Nothing in hand";
  }
}
