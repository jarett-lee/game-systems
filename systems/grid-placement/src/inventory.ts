import { footprintBounds, nextRotation, rotateFootprint, type Cell, type Footprint, type Rotation } from "./footprint";

export type GridSpec = { readonly id: string; readonly width: number; readonly height: number };

export type ItemSpec = { readonly id: string; readonly footprint: Footprint };

export type Placement = {
  readonly itemId: string;
  readonly gridId: string;
  readonly origin: Cell;
  readonly rotation: Rotation;
};

export type Held = { readonly itemId: string; readonly rotation: Rotation };

export type Inventory = {
  readonly grids: readonly GridSpec[];
  readonly items: readonly ItemSpec[];
  readonly placements: readonly Placement[];
  readonly hand: Held | null;
};

export type DropOutcome =
  | { readonly kind: "placed" }
  | { readonly kind: "swapped"; readonly poppedItemId: string }
  | { readonly kind: "rejected"; readonly reason: "empty-hand" | "out-of-bounds" | "covers-several" };

export type PopOutcome = { readonly kind: "popped" } | { readonly kind: "refused"; readonly reason: "hand-full" | "not-placed" };

export type StowOutcome = { readonly kind: "placed" } | { readonly kind: "rejected"; readonly reason: "empty-hand" | "no-space" };

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

export function previewDrop(inventory: Inventory, gridId: string, origin: Cell): DropOutcome {
  const { hand } = inventory;
  if (!hand) return { kind: "rejected", reason: "empty-hand" };

  const cells = cellsCovered(inventory, hand.itemId, origin, hand.rotation);
  if (!insideGrid(findGrid(inventory, gridId), cells)) return { kind: "rejected", reason: "out-of-bounds" };

  const [covered, ...more] = itemsUnder(inventory, gridId, cells);
  if (more.length > 0) return { kind: "rejected", reason: "covers-several" };
  if (covered !== undefined) return { kind: "swapped", poppedItemId: covered };
  return { kind: "placed" };
}

function heldFrom(placement: Placement): Held {
  return { itemId: placement.itemId, rotation: placement.rotation };
}

export function drop(inventory: Inventory, gridId: string, origin: Cell): Result<DropOutcome> {
  const outcome = previewDrop(inventory, gridId, origin);
  const { hand } = inventory;
  if (outcome.kind === "rejected" || !hand) return { inventory, outcome };

  const placed: Placement = { itemId: hand.itemId, gridId, origin, rotation: hand.rotation };

  if (outcome.kind === "placed") {
    return { inventory: { ...inventory, placements: [...inventory.placements, placed], hand: null }, outcome };
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

export function rotateHand(inventory: Inventory): Inventory {
  const { hand } = inventory;
  if (!hand) return inventory;
  return { ...inventory, hand: { ...hand, rotation: nextRotation(hand.rotation) } };
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
