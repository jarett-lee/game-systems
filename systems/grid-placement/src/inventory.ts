import {
  footprintBounds,
  nextRotation,
  previousRotation,
  rotateFootprint,
  type Cell,
  type Footprint,
  type Rotation,
} from "./footprint";

export type GridSpec = { readonly id: string; readonly width: number; readonly height: number };

export type ItemSpec = { readonly id: string; readonly footprint: Footprint };

export type Placement = {
  readonly itemId: string;
  readonly gridId: string;
  readonly origin: Cell;
  readonly rotation: Rotation;
};

export type Held = { readonly itemId: string; readonly rotation: Rotation; readonly from: Placement | null };

export type RotationDirection = "clockwise" | "counter-clockwise";

export type Inventory = {
  readonly grids: readonly GridSpec[];
  readonly items: readonly ItemSpec[];
  readonly placements: readonly Placement[];
  readonly hand: Held | null;
};

export type DropOutcome =
  | { readonly kind: "placed" }
  | { readonly kind: "swapped"; readonly poppedItemId: string }
  | { readonly kind: "pushed"; readonly pushed: readonly Placement[] }
  | { readonly kind: "rejected"; readonly reason: "empty-hand" | "out-of-bounds" | "no-room-to-push" };

export type PopOutcome = { readonly kind: "popped" } | { readonly kind: "refused"; readonly reason: "hand-full" | "not-placed" };

export type StowOutcome = { readonly kind: "placed" } | { readonly kind: "rejected"; readonly reason: "empty-hand" | "no-space" };

export type ReturnOutcome =
  | { readonly kind: "returned" }
  | { readonly kind: "rejected"; readonly reason: "empty-hand" | "no-origin" | "spot-taken" };

export type Result<Outcome> = { readonly inventory: Inventory; readonly outcome: Outcome };

export function createInventory(grids: readonly GridSpec[], items: readonly ItemSpec[]): Inventory {
  return { grids, items, placements: [], hand: null };
}

function findItem(inventory: Inventory, itemId: string): ItemSpec {
  const item = inventory.items.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error(`Unknown item "${itemId}"`);
  return item;
}

function findGrid(inventory: Inventory, gridId: string): GridSpec {
  const grid = inventory.grids.find((candidate) => candidate.id === gridId);
  if (!grid) throw new Error(`Unknown grid "${gridId}"`);
  return grid;
}

export function cellsCovered(inventory: Inventory, itemId: string, origin: Cell, rotation: Rotation): Cell[] {
  return rotateFootprint(findItem(inventory, itemId).footprint, rotation).map((cell) => ({
    x: origin.x + cell.x,
    y: origin.y + cell.y,
  }));
}

export function placementCells(inventory: Inventory, placement: Placement): Cell[] {
  return cellsCovered(inventory, placement.itemId, placement.origin, placement.rotation);
}

export function itemAt(inventory: Inventory, gridId: string, cell: Cell): string | null {
  const placement = inventory.placements.find(
    (candidate) =>
      candidate.gridId === gridId &&
      placementCells(inventory, candidate).some((covered) => covered.x === cell.x && covered.y === cell.y),
  );
  return placement?.itemId ?? null;
}

function insideGrid(grid: GridSpec, cells: readonly Cell[]): boolean {
  return cells.every((cell) => cell.x >= 0 && cell.y >= 0 && cell.x < grid.width && cell.y < grid.height);
}

function itemsUnder(inventory: Inventory, gridId: string, cells: readonly Cell[]): string[] {
  const found = new Set<string>();
  for (const cell of cells) {
    const itemId = itemAt(inventory, gridId, cell);
    if (itemId !== null) found.add(itemId);
  }
  return [...found];
}

export function nudgeInside(inventory: Inventory, gridId: string, origin: Cell): Cell | null {
  const { hand } = inventory;
  if (!hand) return null;
  const grid = findGrid(inventory, gridId);
  const cells = cellsCovered(inventory, hand.itemId, origin, hand.rotation);
  if (!cells.some((cell) => insideGrid(grid, [cell]))) return null;

  const { width, height } = footprintBounds(rotateFootprint(findItem(inventory, hand.itemId).footprint, hand.rotation));
  const clamp = (value: number, room: number) => Math.max(0, Math.min(value, room));
  return { x: clamp(origin.x, grid.width - width), y: clamp(origin.y, grid.height - height) };
}

export function nudgeToFree(
  inventory: Inventory,
  gridId: string,
  origin: Cell,
  reach: number,
  toward: Cell = { x: 0, y: 0 },
): Cell | null {
  const candidates: Cell[] = [];
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) candidates.push({ x: dx, y: dy });
  }
  const steps = (shift: Cell) => Math.abs(shift.x) + Math.abs(shift.y);
  const lean = (shift: Cell) => shift.x * toward.x + shift.y * toward.y;
  candidates.sort((a, b) => steps(a) - steps(b) || lean(b) - lean(a) || a.y - b.y || a.x - b.x);

  for (const shift of candidates) {
    const nudged = { x: origin.x + shift.x, y: origin.y + shift.y };
    if (previewDrop(inventory, gridId, nudged).kind === "placed") return nudged;
  }
  return null;
}

function fits(inventory: Inventory, placement: Placement): boolean {
  const cells = placementCells(inventory, placement);
  const grid = findGrid(inventory, placement.gridId);
  return insideGrid(grid, cells) && itemsUnder(inventory, placement.gridId, cells).length === 0;
}

type Spot = { readonly placement: Placement; readonly cost: number };

function nearestSpot(inventory: Inventory, from: Placement): Spot | null {
  const grid = findGrid(inventory, from.gridId);
  let best: Spot | null = null;
  for (const rotation of rotationsFrom(from.rotation)) {
    const turnCost = rotation === from.rotation ? 0 : 0.5;
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const placement: Placement = { ...from, origin: { x, y }, rotation };
        if (!fits(inventory, placement)) continue;
        const cost = Math.abs(x - from.origin.x) + Math.abs(y - from.origin.y) + turnCost;
        if (!best || cost < best.cost) best = { placement, cost };
      }
    }
  }
  return best;
}

function orderings<Value>(values: readonly Value[]): Value[][] {
  if (values.length > 5) return [[...values]];
  if (values.length <= 1) return [[...values]];
  return values.flatMap((value, index) =>
    orderings([...values.slice(0, index), ...values.slice(index + 1)]).map((rest) => [value, ...rest]),
  );
}

function planPush(inventory: Inventory, placed: Placement, blockerIds: readonly string[]): Placement[] | null {
  const blockers = inventory.placements.filter((placement) => blockerIds.includes(placement.itemId));
  const base = [...inventory.placements.filter((placement) => !blockerIds.includes(placement.itemId)), placed];
  let best: { moved: Placement[]; cost: number } | null = null;

  for (const order of orderings(blockers)) {
    let placements = base;
    const moved: Placement[] = [];
    let cost = 0;
    for (const blocker of order) {
      const spot = nearestSpot({ ...inventory, placements }, blocker);
      if (!spot) break;
      placements = [...placements, spot.placement];
      moved.push(spot.placement);
      cost += spot.cost;
    }
    if (moved.length === order.length && (!best || cost < best.cost)) best = { moved, cost };
  }
  return best?.moved ?? null;
}

export function previewDrop(inventory: Inventory, gridId: string, origin: Cell): DropOutcome {
  const { hand } = inventory;
  if (!hand) return { kind: "rejected", reason: "empty-hand" };

  const cells = cellsCovered(inventory, hand.itemId, origin, hand.rotation);
  if (!insideGrid(findGrid(inventory, gridId), cells)) return { kind: "rejected", reason: "out-of-bounds" };

  const covered = itemsUnder(inventory, gridId, cells);
  const [only, ...more] = covered;
  if (more.length > 0) {
    const placed: Placement = { itemId: hand.itemId, gridId, origin, rotation: hand.rotation };
    const pushed = planPush(inventory, placed, covered);
    return pushed ? { kind: "pushed", pushed } : { kind: "rejected", reason: "no-room-to-push" };
  }
  if (only !== undefined) return { kind: "swapped", poppedItemId: only };
  return { kind: "placed" };
}

function heldFrom(placement: Placement): Held {
  return { itemId: placement.itemId, rotation: placement.rotation, from: placement };
}

export function drop(inventory: Inventory, gridId: string, origin: Cell): Result<DropOutcome> {
  const outcome = previewDrop(inventory, gridId, origin);
  const { hand } = inventory;
  if (outcome.kind === "rejected" || !hand) return { inventory, outcome };

  const placed: Placement = { itemId: hand.itemId, gridId, origin, rotation: hand.rotation };

  if (outcome.kind === "placed") {
    return { inventory: { ...inventory, placements: [...inventory.placements, placed], hand: null }, outcome };
  }

  if (outcome.kind === "pushed") {
    const movedIds = outcome.pushed.map((placement) => placement.itemId);
    const staying = inventory.placements.filter((placement) => !movedIds.includes(placement.itemId));
    return { inventory: { ...inventory, placements: [...staying, placed, ...outcome.pushed], hand: null }, outcome };
  }

  const popped = inventory.placements.find((placement) => placement.itemId === outcome.poppedItemId);
  if (!popped) throw new Error(`Item "${outcome.poppedItemId}" is not placed`);
  const remaining = inventory.placements.filter((placement) => placement !== popped);
  return { inventory: { ...inventory, placements: [...remaining, placed], hand: heldFrom(popped) }, outcome };
}

export function popOut(inventory: Inventory, itemId: string): Result<PopOutcome> {
  if (inventory.hand) return { inventory, outcome: { kind: "refused", reason: "hand-full" } };

  const placement = inventory.placements.find((candidate) => candidate.itemId === itemId);
  if (!placement) return { inventory, outcome: { kind: "refused", reason: "not-placed" } };

  return {
    inventory: {
      ...inventory,
      placements: inventory.placements.filter((candidate) => candidate !== placement),
      hand: heldFrom(placement),
    },
    outcome: { kind: "popped" },
  };
}

export function rotateHand(inventory: Inventory, direction: RotationDirection = "clockwise"): Inventory {
  const { hand } = inventory;
  if (!hand) return inventory;
  const rotation = direction === "clockwise" ? nextRotation(hand.rotation) : previousRotation(hand.rotation);
  return { ...inventory, hand: { ...hand, rotation } };
}

export function returnHeld(inventory: Inventory): Result<ReturnOutcome> {
  const { hand } = inventory;
  if (!hand) return { inventory, outcome: { kind: "rejected", reason: "empty-hand" } };
  const { from } = hand;
  if (!from) return { inventory, outcome: { kind: "rejected", reason: "no-origin" } };

  const turnedBack = { ...inventory, hand: { ...hand, rotation: from.rotation } };
  if (previewDrop(turnedBack, from.gridId, from.origin).kind !== "placed") {
    return { inventory, outcome: { kind: "rejected", reason: "spot-taken" } };
  }
  return { inventory: drop(turnedBack, from.gridId, from.origin).inventory, outcome: { kind: "returned" } };
}

function rotationsFrom(start: Rotation): Rotation[] {
  const rotations: Rotation[] = [start];
  while (rotations.length < 4) rotations.push(nextRotation(rotations[rotations.length - 1] ?? start));
  return rotations;
}

export function stow(inventory: Inventory): Result<StowOutcome> {
  const { hand } = inventory;
  if (!hand) return { inventory, outcome: { kind: "rejected", reason: "empty-hand" } };

  const footprint = findItem(inventory, hand.itemId).footprint;
  for (const grid of inventory.grids) {
    for (const rotation of rotationsFrom(hand.rotation)) {
      const { width, height } = footprintBounds(rotateFootprint(footprint, rotation));
      for (let y = 0; y + height <= grid.height; y++) {
        for (let x = 0; x + width <= grid.width; x++) {
          const turned = { ...inventory, hand: { ...hand, rotation } };
          const result = drop(turned, grid.id, { x, y });
          if (result.outcome.kind === "placed") return { inventory: result.inventory, outcome: { kind: "placed" } };
        }
      }
    }
  }
  return { inventory, outcome: { kind: "rejected", reason: "no-space" } };
}
