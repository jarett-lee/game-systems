import { describe, expect, test } from "vitest";
import {
  createInventory,
  drop,
  itemAt,
  nudgeInside,
  nudgeToFree,
  popOut,
  previewDrop,
  returnHeld,
  rotateHand,
  stow,
  type Inventory,
} from "./inventory";

const backpack = { id: "backpack", width: 4, height: 3 };
const stash = { id: "stash", width: 3, height: 3 };

const potion = { id: "potion", footprint: [{ x: 0, y: 0 }] };
const sword = {
  id: "sword",
  footprint: [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
  ],
};
const gem = { id: "gem", footprint: [{ x: 0, y: 0 }] };

function emptyInventory(): Inventory {
  return createInventory([backpack, stash], [potion, sword, gem]);
}

function holding(inventory: Inventory, itemId: string): Inventory {
  return { ...inventory, hand: { itemId, rotation: 0, from: null } };
}

function placedAt(inventory: Inventory, itemId: string, gridId: string, x: number, y: number): Inventory {
  const result = drop(holding(inventory, itemId), gridId, { x, y });
  expect(result.outcome.kind).toBe("placed");
  return result.inventory;
}

describe("dropping onto free cells", () => {
  test("places the Item and empties the Hand", () => {
    const { inventory, outcome } = drop(holding(emptyInventory(), "sword"), "backpack", { x: 1, y: 0 });

    expect(outcome).toEqual({ kind: "placed" });
    expect(inventory.hand).toBeNull();
    expect(itemAt(inventory, "backpack", { x: 1, y: 2 })).toBe("sword");
    expect(itemAt(inventory, "backpack", { x: 2, y: 0 })).toBeNull();
  });

  test("uses the Hand's rotation", () => {
    const rotated = rotateHand(holding(emptyInventory(), "sword"));
    const { inventory } = drop(rotated, "backpack", { x: 0, y: 0 });

    expect(itemAt(inventory, "backpack", { x: 2, y: 0 })).toBe("sword");
    expect(itemAt(inventory, "backpack", { x: 0, y: 1 })).toBeNull();
  });
});

describe("rejected drops", () => {
  test("off the edge of the Grid", () => {
    const start = holding(emptyInventory(), "sword");
    const { inventory, outcome } = drop(start, "backpack", { x: 0, y: 1 });

    expect(outcome).toEqual({ kind: "rejected", reason: "out-of-bounds" });
    expect(inventory).toBe(start);
  });

  test("covering two or more Items with no room to push them aside", () => {
    const full = createInventory([{ id: "tray", width: 1, height: 3 }, stash], [potion, sword, gem]);
    let inventory = placedAt(full, "potion", "tray", 0, 0);
    inventory = placedAt(inventory, "gem", "tray", 0, 2);
    const start = holding(inventory, "sword");

    const result = drop(start, "tray", { x: 0, y: 0 });

    expect(result.outcome).toEqual({ kind: "rejected", reason: "no-room-to-push" });
    expect(result.inventory).toBe(start);
  });

  test("with nothing in the Hand", () => {
    const start = emptyInventory();
    expect(drop(start, "backpack", { x: 0, y: 0 }).outcome).toEqual({ kind: "rejected", reason: "empty-hand" });
  });
});

describe("swapping", () => {
  test("covering exactly one Item places the held Item and pops the covered one into the Hand", () => {
    const inventory = placedAt(emptyInventory(), "potion", "backpack", 0, 1);

    const result = drop(holding(inventory, "sword"), "backpack", { x: 0, y: 0 });

    expect(result.outcome).toEqual({ kind: "swapped", poppedItemId: "potion" });
    expect(result.inventory.hand).toMatchObject({ itemId: "potion", rotation: 0 });
    expect(itemAt(result.inventory, "backpack", { x: 0, y: 1 })).toBe("sword");
  });

  test("the popped Item keeps its rotation", () => {
    const rotatedSword = rotateHand(holding(emptyInventory(), "sword"));
    const inventory = drop(rotatedSword, "backpack", { x: 0, y: 0 }).inventory;

    const result = drop(holding(inventory, "potion"), "backpack", { x: 1, y: 0 });

    expect(result.inventory.hand).toMatchObject({ itemId: "sword", rotation: 1 });
  });
});

describe("popping out", () => {
  test("moves a placed Item into the empty Hand and frees its Cells", () => {
    const inventory = placedAt(emptyInventory(), "sword", "backpack", 2, 0);

    const result = popOut(inventory, "sword");

    expect(result.outcome).toEqual({ kind: "popped" });
    expect(result.inventory.hand).toMatchObject({ itemId: "sword", rotation: 0 });
    expect(itemAt(result.inventory, "backpack", { x: 2, y: 1 })).toBeNull();
  });

  test("is refused while the Hand already holds something", () => {
    const inventory = holding(placedAt(emptyInventory(), "sword", "backpack", 2, 0), "potion");

    const result = popOut(inventory, "sword");

    expect(result.outcome).toEqual({ kind: "refused", reason: "hand-full" });
    expect(result.inventory).toBe(inventory);
  });
});

describe("several Grids", () => {
  test("an Item moves from one Grid to another", () => {
    const inventory = placedAt(emptyInventory(), "sword", "backpack", 0, 0);

    const moved = drop(popOut(inventory, "sword").inventory, "stash", { x: 2, y: 0 }).inventory;

    expect(itemAt(moved, "backpack", { x: 0, y: 0 })).toBeNull();
    expect(itemAt(moved, "stash", { x: 2, y: 2 })).toBe("sword");
  });

  test("an Item in one Grid never blocks the same Cells in another", () => {
    const inventory = placedAt(emptyInventory(), "potion", "backpack", 0, 0);

    expect(previewDrop(holding(inventory, "gem"), "stash", { x: 0, y: 0 })).toEqual({ kind: "placed" });
  });
});

describe("previewDrop", () => {
  test("reports the outcome without changing anything", () => {
    const inventory = holding(placedAt(emptyInventory(), "potion", "backpack", 0, 1), "sword");

    expect(previewDrop(inventory, "backpack", { x: 0, y: 0 })).toEqual({ kind: "swapped", poppedItemId: "potion" });
    expect(inventory.hand).toMatchObject({ itemId: "sword", rotation: 0 });
  });
});

describe("stow", () => {
  test("puts the held Item in the first free spot, trying Grids in order", () => {
    const inventory = placedAt(emptyInventory(), "potion", "backpack", 0, 0);

    const result = stow(holding(inventory, "sword"));

    expect(result.outcome).toEqual({ kind: "placed" });
    expect(itemAt(result.inventory, "backpack", { x: 1, y: 0 })).toBe("sword");
  });

  test("turns the Item when that is the only way it fits", () => {
    const tiny = createInventory([{ id: "tray", width: 3, height: 1 }], [sword]);

    const result = stow(holding(tiny, "sword"));

    expect(result.outcome).toEqual({ kind: "placed" });
    expect(itemAt(result.inventory, "tray", { x: 2, y: 0 })).toBe("sword");
  });

  test("leaves the Item in the Hand when nothing fits", () => {
    const tiny = createInventory([{ id: "tray", width: 2, height: 1 }], [sword]);
    const start = holding(tiny, "sword");

    const result = stow(start);

    expect(result.outcome).toEqual({ kind: "rejected", reason: "no-space" });
    expect(result.inventory).toBe(start);
  });
});

describe("rotating the Hand", () => {
  test("turns clockwise by default", () => {
    expect(rotateHand(holding(emptyInventory(), "sword")).hand?.rotation).toBe(1);
  });

  test("turns counter-clockwise when asked", () => {
    expect(rotateHand(holding(emptyInventory(), "sword"), "counter-clockwise").hand?.rotation).toBe(3);
  });

  test("one turn each way cancels out", () => {
    const start = holding(emptyInventory(), "sword");
    expect(rotateHand(rotateHand(start, "clockwise"), "counter-clockwise").hand?.rotation).toBe(0);
  });
});

describe("returning the held Item", () => {
  test("puts it back at the Placement it was popped out from, with its old rotation", () => {
    const rotatedSword = rotateHand(holding(emptyInventory(), "sword"));
    const placed = drop(rotatedSword, "backpack", { x: 1, y: 0 }).inventory;
    const turnedAgain = rotateHand(rotateHand(popOut(placed, "sword").inventory));

    const result = returnHeld(turnedAgain);

    expect(result.outcome).toEqual({ kind: "returned" });
    expect(result.inventory.hand).toBeNull();
    expect(result.inventory.placements).toContainEqual({
      itemId: "sword",
      gridId: "backpack",
      origin: { x: 1, y: 0 },
      rotation: 1,
    });
  });

  test("is refused when the old spot has been taken", () => {
    const inventory = placedAt(emptyInventory(), "potion", "backpack", 0, 1);
    const swapped = drop(holding(inventory, "sword"), "backpack", { x: 0, y: 0 }).inventory;

    const result = returnHeld(swapped);

    expect(result.outcome).toEqual({ kind: "rejected", reason: "spot-taken" });
    expect(result.inventory).toBe(swapped);
  });

  test("is refused when the Item never had a Placement", () => {
    const start = holding(emptyInventory(), "gem");
    expect(returnHeld(start).outcome).toEqual({ kind: "rejected", reason: "no-origin" });
  });

  test("is refused with nothing in the Hand", () => {
    expect(returnHeld(emptyInventory()).outcome).toEqual({ kind: "rejected", reason: "empty-hand" });
  });
});

describe("pushing", () => {
  function potionAndGemUnderSword(): Inventory {
    const inventory = placedAt(emptyInventory(), "potion", "backpack", 0, 0);
    return holding(placedAt(inventory, "gem", "backpack", 0, 2), "sword");
  }

  test("covering two or more Items moves them to the nearest free spots so the held Item fits", () => {
    const result = drop(potionAndGemUnderSword(), "backpack", { x: 0, y: 0 });

    expect(result.outcome).toEqual({
      kind: "pushed",
      pushed: [
        { itemId: "potion", gridId: "backpack", origin: { x: 1, y: 0 }, rotation: 0 },
        { itemId: "gem", gridId: "backpack", origin: { x: 1, y: 2 }, rotation: 0 },
      ],
    });
    expect(result.inventory.hand).toBeNull();
    expect(itemAt(result.inventory, "backpack", { x: 0, y: 1 })).toBe("sword");
    expect(itemAt(result.inventory, "backpack", { x: 1, y: 0 })).toBe("potion");
    expect(itemAt(result.inventory, "backpack", { x: 1, y: 2 })).toBe("gem");
  });

  test("pushed Items stay in the same Grid, even when another Grid has room", () => {
    const tray = createInventory([{ id: "tray", width: 1, height: 3 }, stash], [potion, sword, gem]);
    let inventory = placedAt(tray, "potion", "tray", 0, 0);
    inventory = placedAt(inventory, "gem", "tray", 0, 1);

    expect(previewDrop(holding(inventory, "sword"), "tray", { x: 0, y: 0 })).toEqual({
      kind: "rejected",
      reason: "no-room-to-push",
    });
  });

  test("previewDrop shows the push without changing anything", () => {
    const start = potionAndGemUnderSword();
    expect(previewDrop(start, "backpack", { x: 0, y: 0 }).kind).toBe("pushed");
    expect(itemAt(start, "backpack", { x: 0, y: 0 })).toBe("potion");
  });
});

describe("nudging inside a Grid", () => {
  test("leaves an origin alone when the whole Footprint is already inside", () => {
    expect(nudgeInside(holding(emptyInventory(), "sword"), "backpack", { x: 1, y: 0 })).toEqual({ x: 1, y: 0 });
  });

  test("moves the held Item fully inside when part of it hangs off an edge", () => {
    const start = holding(emptyInventory(), "sword");
    expect(nudgeInside(start, "backpack", { x: 3, y: 1 })).toEqual({ x: 3, y: 0 });
    expect(nudgeInside(start, "backpack", { x: -1, y: -2 })).toBeNull();
    expect(nudgeInside(start, "backpack", { x: 0, y: -2 })).toEqual({ x: 0, y: 0 });
  });

  test("gives up when no Cell of the held Item is over the Grid", () => {
    expect(nudgeInside(holding(emptyInventory(), "sword"), "backpack", { x: 5, y: 0 })).toBeNull();
  });

  test("still lets the drop reject an Item too big for the Grid", () => {
    const small = createInventory([{ id: "pouch", width: 2, height: 2 }], [sword]);
    const start = holding(small, "sword");
    const origin = nudgeInside(start, "pouch", { x: 0, y: 0 });

    expect(origin).toEqual({ x: 0, y: 0 });
    expect(origin && previewDrop(start, "pouch", origin)).toEqual({ kind: "rejected", reason: "out-of-bounds" });
  });
});

describe("nudging to free Cells", () => {
  test("finds the nearest spot within reach where the held Item lands without covering anything", () => {
    const inventory = holding(placedAt(emptyInventory(), "potion", "backpack", 1, 0), "gem");

    expect(nudgeToFree(inventory, "backpack", { x: 1, y: 0 }, 1)).toEqual({ x: 0, y: 0 });
  });

  test("breaks ties toward the side it leans to", () => {
    const inventory = holding(placedAt(emptyInventory(), "potion", "backpack", 1, 0), "gem");

    expect(nudgeToFree(inventory, "backpack", { x: 1, y: 0 }, 1, { x: 0.3, y: 0 })).toEqual({ x: 2, y: 0 });
    expect(nudgeToFree(inventory, "backpack", { x: 1, y: 0 }, 1, { x: 0, y: 0.3 })).toEqual({ x: 1, y: 1 });
  });

  test("leaves a free spot where it is", () => {
    expect(nudgeToFree(holding(emptyInventory(), "gem"), "backpack", { x: 1, y: 1 }, 1)).toEqual({ x: 1, y: 1 });
  });

  test("looks diagonally when the sides are taken", () => {
    const dots = ["a", "b", "c", "d", "e", "held"].map((id) => ({ id, footprint: [{ x: 0, y: 0 }] }));
    let inventory = createInventory([{ id: "board", width: 3, height: 3 }], dots);
    for (const [id, x, y] of [["a", 1, 1], ["b", 0, 1], ["c", 2, 1], ["d", 1, 0], ["e", 1, 2]] as const) {
      inventory = placedAt(inventory, id, "board", x, y);
    }

    expect(nudgeToFree(holding(inventory, "held"), "board", { x: 1, y: 1 }, 1)).toEqual({ x: 0, y: 0 });
  });

  test("gives up when nothing within reach is free", () => {
    const tray = createInventory([{ id: "tray", width: 2, height: 1 }], [potion, sword, gem]);
    let inventory = placedAt(tray, "potion", "tray", 0, 0);
    inventory = placedAt(inventory, "gem", "tray", 1, 0);
    const dot = { id: "dot", footprint: [{ x: 0, y: 0 }] };

    expect(nudgeToFree(holding({ ...inventory, items: [...inventory.items, dot] }, "dot"), "tray", { x: 0, y: 0 }, 1)).toBeNull();
  });

  test("reaches farther when allowed", () => {
    const dots = ["a", "b", "held"].map((id) => ({ id, footprint: [{ x: 0, y: 0 }] }));
    let inventory = createInventory([{ id: "tray", width: 4, height: 1 }], dots);
    inventory = placedAt(inventory, "a", "tray", 0, 0);
    inventory = placedAt(inventory, "b", "tray", 1, 0);
    const start = holding(inventory, "held");

    expect(nudgeToFree(start, "tray", { x: 0, y: 0 }, 1)).toBeNull();
    expect(nudgeToFree(start, "tray", { x: 0, y: 0 }, 2)).toEqual({ x: 2, y: 0 });
  });

  test("with unlimited reach, finds the nearest free spot anywhere in the Grid", () => {
    const dots = ["a", "b", "c", "held"].map((id) => ({ id, footprint: [{ x: 0, y: 0 }] }));
    let inventory = createInventory([{ id: "tray", width: 6, height: 1 }], dots);
    inventory = placedAt(inventory, "a", "tray", 0, 0);
    inventory = placedAt(inventory, "b", "tray", 1, 0);
    inventory = placedAt(inventory, "c", "tray", 2, 0);
    const start = holding(inventory, "held");

    expect(nudgeToFree(start, "tray", { x: 0, y: 0 }, Infinity)).toEqual({ x: 3, y: 0 });
    expect(nudgeToFree({ ...start, grids: [{ id: "tray", width: 3, height: 1 }] }, "tray", { x: 0, y: 0 }, Infinity)).toBeNull();
  });
});
