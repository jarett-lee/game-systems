import {
  createInventory,
  drop,
  footprintBounds,
  itemAt,
  nudgeInside,
  popOut,
  previewDrop,
  returnHeld,
  rotateFootprint,
  rotateHand,
  stow,
  type Cell,
  type DropOutcome,
  type Footprint,
  type Inventory,
  type Placement,
  type RotationDirection,
} from "../../systems/grid-placement/src";
import { catalog, catalogItem, type GridSizes } from "./catalog";
import {
  cellOrigin,
  cellUnder,
  computeLayout,
  insideFrame,
  type GridFrame,
  type Layout,
  type Point,
} from "./layout";

export type Target = { readonly frame: GridFrame; readonly origin: Cell; readonly outcome: DropOutcome };

export type HoldBy = "where grabbed" | "item center";

export type PickUpBy = "press and drag" | "click";

function gridsFor(sizes: GridSizes) {
  return [
    { id: "backpack", width: sizes.backpackWidth, height: sizes.backpackHeight },
    { id: "stash", width: sizes.stashWidth, height: sizes.stashHeight },
  ];
}

export class Demo {
  inventory: Inventory;
  layout: Layout;
  pointer: Point | null = null;
  grabIndex = 0;
  grabOffset: Point = { x: 0, y: 0 };
  holdBy: HoldBy = "where grabbed";
  pickUpBy: PickUpBy = "press and drag";
  private pickedUpThisPress = false;
  message = "Drag an item. R or right-click rotates it, E rotates it back.";

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
      this.inventory = stow({ ...this.inventory, hand: { itemId: item.id, rotation: 0, from: null } }).inventory;
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

  private holdByCenter(): void {
    const footprint = this.heldFootprint();
    const grabbed = footprint?.[this.grabIndex];
    if (!footprint || !grabbed) return;
    const { width, height } = footprintBounds(footprint);
    const { pitch, gap } = this.layout;
    this.grabOffset = {
      x: (width * pitch - gap) / 2 - grabbed.x * pitch,
      y: (height * pitch - gap) / 2 - grabbed.y * pitch,
    };
  }

  target(): Target | null {
    const footprint = this.heldFootprint();
    const corner = this.heldCorner();
    if (!footprint || !corner) return null;
    const grabbed = footprint[this.grabIndex];
    if (!grabbed) return null;
    const anchor = { x: corner.x + this.layout.cellSize / 2, y: corner.y + this.layout.cellSize / 2 };
    const frames = [...this.layout.frames].sort(
      (a, b) => Number(insideFrame(b, anchor)) - Number(insideFrame(a, anchor)),
    );
    for (const frame of frames) {
      const cell = cellUnder(this.layout, frame, anchor);
      const origin = nudgeInside(this.inventory, frame.grid.id, { x: cell.x - grabbed.x, y: cell.y - grabbed.y });
      if (origin) return { frame, origin, outcome: previewDrop(this.inventory, frame.grid.id, origin) };
    }
    return null;
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
    if (this.holdBy === "item center") this.holdByCenter();
    this.pickedUpThisPress = true;
    this.message =
      this.pickUpBy === "click" ? `Picked up the ${itemId}. Click again to drop it` : `Picked up the ${itemId}`;
  }

  move(point: Point): void {
    this.pointer = point;
  }

  release(point: Point): void {
    this.pointer = point;
    const justPickedUp = this.pickedUpThisPress;
    this.pickedUpThisPress = false;
    if (!this.inventory.hand) return;
    if (justPickedUp && this.pickUpBy === "click") return;
    const target = this.target();
    if (!target || target.outcome.kind === "rejected") {
      this.sendBack(target ? describeDrop(target.outcome) : "Dropped outside the grids");
      return;
    }
    const result = drop(this.inventory, target.frame.grid.id, target.origin);
    this.inventory = result.inventory;
    this.message = describeDrop(result.outcome);
    if (result.outcome.kind === "swapped") {
      this.grabIndex = 0;
      this.holdByCenter();
    }
  }

  private sendBack(reason: string): void {
    const returned = returnHeld(this.inventory);
    if (returned.outcome.kind === "returned") {
      this.inventory = returned.inventory;
      this.message = `${reason}, so it went back to its spot`;
      return;
    }
    const stowed = stow(this.inventory);
    this.inventory = stowed.inventory;
    this.message =
      stowed.outcome.kind === "placed"
        ? `${reason}. Its old spot is taken, so it was stowed`
        : `${reason}. There's nowhere to put it, so you're still holding it`;
  }

  rotate(direction: RotationDirection = "clockwise"): void {
    if (!this.inventory.hand) return;
    this.inventory = rotateHand(this.inventory, direction);
    const { x, y } = this.grabOffset;
    const size = this.layout.cellSize;
    this.grabOffset = direction === "clockwise" ? { x: size - y, y: x } : { x: y, y: size - x };
    this.message = direction === "clockwise" ? "Rotated clockwise" : "Rotated counter-clockwise";
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
    case "pushed":
      return `Pushed the ${outcome.pushed.map((placement) => placement.itemId).join(" and the ")} aside`;
    case "rejected":
      if (outcome.reason === "no-room-to-push") return "Rejected: no room to push those items aside";
      if (outcome.reason === "out-of-bounds") return "Rejected: off the edge of the grid";
      return "Nothing in hand";
  }
}
