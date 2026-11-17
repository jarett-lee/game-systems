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
  type DropRules,
  type Footprint,
  type Inventory,
  type Placement,
  type RotationDirection,
} from "../../systems/grid-placement/src";
import { catalog, catalogItem, type GridSizes } from "./catalog";
import { motionAt, spinAt, type Motion, type MotionFrame, type NudgeAnimation, type Spin } from "./motion";
import {
  cellOrigin,
  cellUnder,
  computeLayout,
  insideFrame,
  type GridFrame,
  type Layout,
  type Point,
} from "./layout";

export type Target = {
  readonly frame: GridFrame;
  readonly aimed: Cell;
  readonly origin: Cell;
  readonly nudged: boolean;
  readonly outcome: DropOutcome;
};

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
  holdBy: HoldBy = "item center";
  pickUpBy: PickUpBy = "press and drag";
  oneCovered: DropRules["oneCovered"] = "swap";
  nudgeAnimation: NudgeAnimation = "slide";
  motions: Motion[] = [];
  spin: Spin | null = null;
  private previews = new Map<string, { key: string; to: Point; motion: Motion }>();
  clock: () => number = () => performance.now();
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
      const raw = { x: cell.x - grabbed.x, y: cell.y - grabbed.y };
      const inside = nudgeInside(this.inventory, frame.grid.id, raw);
      if (!inside) continue;
      const outcome = previewDrop(this.inventory, frame.grid.id, inside, { oneCovered: this.oneCovered });
      const nudged = inside.x !== raw.x || inside.y !== raw.y;
      return { frame, aimed: raw, origin: inside, nudged, outcome };
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
    const name = catalogItem(itemId).name;
    this.message =
      this.pickUpBy === "click" ? `Picked up the ${name}. Click again to drop it` : `Picked up the ${name}`;
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
    const before = this.inventory;
    const letGoAt = this.heldOriginPoint();
    const result = drop(this.inventory, target.frame.grid.id, target.origin, { oneCovered: this.oneCovered });
    this.inventory = result.inventory;
    this.animateDrop(before, target, letGoAt, result.outcome);
    this.previews.clear();
    this.message = describeDrop(result.outcome);
    if (result.outcome.kind === "swapped") {
      this.grabIndex = 0;
      this.holdByCenter();
    }
  }

  private heldOriginPoint(): Point | null {
    const corner = this.heldCorner();
    const grabbed = this.heldFootprint()?.[this.grabIndex];
    if (!corner || !grabbed) return null;
    return { x: corner.x - grabbed.x * this.layout.pitch, y: corner.y - grabbed.y * this.layout.pitch };
  }

  private animateDrop(before: Inventory, target: Target, letGoAt: Point | null, outcome: DropOutcome): void {
    const animation = this.nudgeAnimation;
    if (animation === "none") return;
    const start = this.clock();
    const { hand } = before;
    if (target.nudged && hand && letGoAt) {
      const landed = cellOrigin(this.layout, target.frame, target.origin);
      this.motions.push({
        itemId: hand.itemId,
        offset: { x: letGoAt.x - landed.x, y: letGoAt.y - landed.y },
        start,
        animation,
      });
    }
    if (outcome.kind !== "pushed") return;
    for (const moved of outcome.pushed) {
      const previewed = this.previews.get(moved.itemId);
      if (previewed) {
        const frame = motionAt(previewed.motion, start);
        if (frame) this.motions.push({ ...previewed.motion, offset: frame.offset, start, animation });
        continue;
      }
      const was = before.placements.find((placement) => placement.itemId === moved.itemId);
      if (!was) continue;
      const from = cellOrigin(this.layout, target.frame, was.origin);
      const to = cellOrigin(this.layout, target.frame, moved.origin);
      this.motions.push({ itemId: moved.itemId, offset: { x: from.x - to.x, y: from.y - to.y }, start, animation });
    }
  }

  previewMotions(target: Target | null, now: number): Map<string, MotionFrame> {
    const frames = new Map<string, MotionFrame>();
    const seen = new Set<string>();
    const animation = this.nudgeAnimation;
    const hand = this.inventory.hand;
    const track = (id: string, key: string, from: Point, to: Point) => {
      if (animation === "none") return;
      seen.add(id);
      let entry = this.previews.get(id);
      if (!entry || entry.key !== key) {
        const shown = entry && motionAt(entry.motion, now);
        const start = entry
          ? { x: entry.to.x + (shown?.offset.x ?? 0), y: entry.to.y + (shown?.offset.y ?? 0) }
          : from;
        entry = { key, to, motion: { itemId: id, offset: { x: start.x - to.x, y: start.y - to.y }, start: now, animation } };
        this.previews.set(id, entry);
      }
      const frame = motionAt(entry.motion, now);
      if (frame) frames.set(id, frame);
    };
    if (target && hand && target.nudged) {
      const key = [target.frame.grid.id, hand.rotation, target.origin.x, target.origin.y].join();
      track(
        hand.itemId,
        key,
        cellOrigin(this.layout, target.frame, target.aimed),
        cellOrigin(this.layout, target.frame, target.origin),
      );
    }
    if (target?.outcome.kind === "pushed") {
      for (const moved of target.outcome.pushed) {
        const was = this.inventory.placements.find((placement) => placement.itemId === moved.itemId);
        if (!was) continue;
        const key = [was.origin.x, was.origin.y, moved.origin.x, moved.origin.y].join();
        track(
          moved.itemId,
          key,
          cellOrigin(this.layout, target.frame, was.origin),
          cellOrigin(this.layout, target.frame, moved.origin),
        );
      }
    }
    for (const [id, entry] of this.previews) {
      if (seen.has(id)) continue;
      this.previews.delete(id);
      this.slideBack(id, entry, now);
    }
    return frames;
  }

  private slideBack(id: string, entry: { to: Point; motion: Motion }, now: number): void {
    const placement = this.inventory.placements.find((candidate) => candidate.itemId === id);
    const frame = placement && this.layout.frames.find((candidate) => candidate.grid.id === placement.gridId);
    if (!placement || !frame || this.nudgeAnimation === "none") return;
    const shown = motionAt(entry.motion, now);
    const home = cellOrigin(this.layout, frame, placement.origin);
    const offset = {
      x: entry.to.x + (shown?.offset.x ?? 0) - home.x,
      y: entry.to.y + (shown?.offset.y ?? 0) - home.y,
    };
    this.motions = this.motions.filter((motion) => motion.itemId !== id);
    this.motions.push({ itemId: id, offset, start: now, animation: this.nudgeAnimation });
  }

  motionFor(itemId: string, now: number): MotionFrame | null {
    this.motions = this.motions.filter((motion) => motionAt(motion, now) !== null);
    const motion = this.motions.find((candidate) => candidate.itemId === itemId);
    return motion ? motionAt(motion, now) : null;
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
    this.startSpin(direction === "clockwise" ? -Math.PI / 2 : Math.PI / 2);
    const { x, y } = this.grabOffset;
    const size = this.layout.cellSize;
    this.grabOffset = direction === "clockwise" ? { x: size - y, y: x } : { x: y, y: size - x };
    this.message = direction === "clockwise" ? "Rotated clockwise" : "Rotated counter-clockwise";
  }

  private startSpin(turn: number): void {
    const now = this.clock();
    const shown = this.spinFor(now)?.angle ?? 0;
    this.spin = this.nudgeAnimation === "none" ? null : { angle: shown + turn, start: now, animation: this.nudgeAnimation };
  }

  turnPivot(target: Target): Point | null {
    const grabbed = this.heldFootprint()?.[this.grabIndex];
    if (!grabbed) return null;
    const cell = { x: target.origin.x + grabbed.x, y: target.origin.y + grabbed.y };
    const corner = cellOrigin(this.layout, target.frame, cell);
    return { x: corner.x + this.grabOffset.x, y: corner.y + this.grabOffset.y };
  }

  spinFor(now: number): { angle: number; scale: number } | null {
    const frame = this.spin && spinAt(this.spin, now);
    if (!frame) this.spin = null;
    return frame;
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
      return `Swapped: the ${catalogItem(outcome.poppedItemId).name} popped out`;
    case "pushed":
      return `Pushed the ${outcome.pushed.map((placement) => catalogItem(placement.itemId).name).join(" and the ")} aside`;
    case "rejected":
      if (outcome.reason === "no-room-to-push") return "Rejected: no room to push those items aside";
      if (outcome.reason === "out-of-bounds") return "Rejected: off the edge of the grid";
      return "Nothing in hand";
  }
}
