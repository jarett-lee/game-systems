import type { ItemSpec, Placement } from "../../systems/grid-placement/src";

export type Swatch = "coral" | "slate" | "pale";

export type CatalogItem = ItemSpec & { readonly name: string; readonly swatch: Swatch; readonly marked?: true };

export const catalog: readonly CatalogItem[] = [
  {
    id: "O",
    name: "O tetromino",
    swatch: "coral",
    footprint: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
  },
  {
    id: "I3",
    name: "I tromino",
    swatch: "slate",
    footprint: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ],
  },
  { id: "dot-1", name: "monomino", swatch: "pale", footprint: [{ x: 0, y: 0 }] },
  { id: "dot-2", name: "monomino", swatch: "slate", marked: true, footprint: [{ x: 0, y: 0 }] },
  {
    id: "T",
    name: "T tetromino",
    swatch: "pale",
    footprint: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 1 },
    ],
  },
  {
    id: "domino",
    name: "domino",
    swatch: "slate",
    footprint: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
  },
  {
    id: "L3",
    name: "L tromino",
    swatch: "coral",
    footprint: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
  },
  { id: "dot-3", name: "monomino", swatch: "pale", footprint: [{ x: 0, y: 0 }] },
];

export function catalogItem(itemId: string): CatalogItem {
  const item = catalog.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error(`Unknown item "${itemId}"`);
  return item;
}

export type GridSizes = {
  backpackWidth: number;
  backpackHeight: number;
  stashWidth: number;
  stashHeight: number;
};

export const defaultSizes: GridSizes = { backpackWidth: 6, backpackHeight: 4, stashWidth: 4, stashHeight: 4 };

export const showreelLayout: readonly Placement[] = [
  { itemId: "O", gridId: "backpack", origin: { x: 0, y: 0 }, rotation: 0 },
  { itemId: "I3", gridId: "backpack", origin: { x: 2, y: 0 }, rotation: 0 },
  { itemId: "dot-1", gridId: "backpack", origin: { x: 3, y: 0 }, rotation: 0 },
  { itemId: "dot-2", gridId: "backpack", origin: { x: 3, y: 1 }, rotation: 0 },
  { itemId: "T", gridId: "backpack", origin: { x: 3, y: 2 }, rotation: 0 },
  { itemId: "domino", gridId: "backpack", origin: { x: 0, y: 3 }, rotation: 0 },
  { itemId: "L3", gridId: "stash", origin: { x: 0, y: 0 }, rotation: 0 },
  { itemId: "dot-3", gridId: "stash", origin: { x: 3, y: 3 }, rotation: 0 },
];
