import {
  createInventory,
  drop,
  footprintBounds,
  itemAt,
  nudgeInside,
  placementCells,
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
import { motionAt, pushDuration, spinAt, type Motion, type MotionFrame, type NudgeAnimation, type Spin } from "./motion";
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

type Pose = { readonly at: Point; readonly angle: number };

type Preview = { readonly key: string; readonly to: Pose; readonly motion: Motion };

function shortestTurn(angle: number): number {
  const turn = Math.PI * 2;
  const wrapped = ((angle % turn) + turn) % turn;
  return wrapped > Math.PI ? wrapped - turn : wrapped;
}

function shownPose(preview: Preview, now: number): Pose {
  const shown = motionAt(preview.motion, now);
  return {
    at: { x: preview.to.at.x + (shown?.offset.x ?? 0), y: preview.to.at.y + (shown?.offset.y ?? 0) },
    angle: preview.to.angle + (shown?.angle ?? 0),
  };
}

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
  oneCovered: DropRules["oneCovered"] = "push";
  nudgeAnimation: NudgeAnimation = "slide";
  pushDwell = 0;
  private raised: string[] = [];
  private pushSeen: { key: string; since: number } | null = null;
  motions: Motion[] = [];
  spin: Spin | null = null;
  private previews = new Map<string, Preview>();
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
    this.raised = [];
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
        this.raise(moved.itemId);
        const frame = motionAt(previewed.motion, start);
        if (frame) this.motions.push({ ...previewed.motion, offset: frame.offset, angle: frame.angle, start, animation });
        continue;
      }
      const was = before.placements.find((placement) => placement.itemId === moved.itemId);
      if (!was) continue;
      this.motions.push(this.motionBetween(moved.itemId, this.poseOf(before, was), this.poseOf(before, moved), start, true));
    }
  }

  private poseOf(inventory: Inventory, placement: Placement): Pose {
    const frame = this.layout.frames.find((candidate) => candidate.grid.id === placement.gridId);
    const corners = placementCells(inventory, placement).map((cell) => (frame ? cellOrigin(this.layout, frame, cell) : cell));
    const size = this.layout.cellSize;
    const left = Math.min(...corners.map((corner) => corner.x));
    const top = Math.min(...corners.map((corner) => corner.y));
    const right = Math.max(...corners.map((corner) => corner.x)) + size;
    const bottom = Math.max(...corners.map((corner) => corner.y)) + size;
    return { at: { x: (left + right) / 2, y: (top + bottom) / 2 }, angle: (placement.rotation * Math.PI) / 2 };
  }

  private raise(itemId: string): void {
    this.raised = [...this.raised.filter((id) => id !== itemId), itemId];
  }

  drawOrder(): Placement[] {
    const rank = (placement: Placement) => this.raised.indexOf(placement.itemId);
    return [...this.inventory.placements].sort((a, b) => rank(a) - rank(b));
  }

  private motionBetween(itemId: string, from: Pose, to: Pose, start: number, push = false): Motion {
    if (push) this.raise(itemId);
    const offset = { x: from.at.x - to.at.x, y: from.at.y - to.at.y };
    const cells = Math.hypot(offset.x, offset.y) / this.layout.pitch;
    return {
      itemId,
      offset,
      ...(push ? { duration: pushDuration(cells) } : {}),
      angle: shortestTurn(from.angle - to.angle),
      start,
      animation: this.nudgeAnimation === "none" ? "slide" : this.nudgeAnimation,
    };
  }

  pushReady(target: Target | null, now: number): boolean {
    if (target?.outcome.kind !== "pushed") {
      this.pushSeen = null;
      return false;
    }
    const key = [
      target.frame.grid.id,
      ...target.outcome.pushed.map((moved) => [moved.itemId, moved.origin.x, moved.origin.y, moved.rotation].join(":")),
    ].join();
    if (this.pushSeen?.key !== key) this.pushSeen = { key, since: now };
    return now - this.pushSeen.since >= this.pushDwell;
  }

  previewMotions(target: Target | null, now: number): Map<string, MotionFrame> {
    const frames = new Map<string, MotionFrame>();
    const seen = new Set<string>();
    const hand = this.inventory.hand;
    const track = (id: string, key: string, from: Pose, to: Pose, push = false) => {
      if (this.nudgeAnimation === "none") return;
      seen.add(id);
      let entry = this.previews.get(id);
      if (!entry || entry.key !== key) {
        entry = { key, to, motion: this.motionBetween(id, entry ? shownPose(entry, now) : from, to, now, push) };
        this.previews.set(id, entry);
      }
      const frame = motionAt(entry.motion, now);
      if (frame) frames.set(id, frame);
    };
    if (target && hand && target.nudged) {
      const key = [target.frame.grid.id, hand.rotation, target.origin.x, target.origin.y].join();
      const angle = (hand.rotation * Math.PI) / 2;
      track(
        hand.itemId,
        key,
        { at: cellOrigin(this.layout, target.frame, target.aimed), angle },
        { at: cellOrigin(this.layout, target.frame, target.origin), angle },
      );
    }
    if (target?.outcome.kind === "pushed" && this.pushReady(target, now)) {
      for (const moved of target.outcome.pushed) {
        const was = this.inventory.placements.find((placement) => placement.itemId === moved.itemId);
        if (!was) continue;
        const key = [moved.origin.x, moved.origin.y, moved.rotation].join();
        track(moved.itemId, key, this.poseOf(this.inventory, was), this.poseOf(this.inventory, moved), true);
      }
    }
    for (const [id, entry] of this.previews) {
      if (seen.has(id)) continue;
      this.previews.delete(id);
      this.slideBack(id, entry, now);
    }
    return frames;
  }

  private slideBack(id: string, entry: Preview, now: number): void {
    const placement = this.inventory.placements.find((candidate) => candidate.itemId === id);
    if (!placement || this.nudgeAnimation === "none") return;
    this.motions = this.motions.filter((motion) => motion.itemId !== id);
    this.motions.push(this.motionBetween(id, shownPose(entry, now), this.poseOf(this.inventory, placement), now, true));
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
