import type { ItemSpec, Placement } from "../../systems/grid-placement/src";

export type Swatch = "coral" | "slate" | "pale";

export type CatalogItem = ItemSpec & { readonly swatch: Swatch; readonly marked?: true };

export const catalog: readonly CatalogItem[] = [
  {
    id: "shield",
    swatch: "coral",
    footprint: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
  },
  {
    id: "sword",
    swatch: "slate",
    footprint: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ],
  },
  { id: "potion", swatch: "pale", footprint: [{ x: 0, y: 0 }] },
  { id: "gem", swatch: "slate", marked: true, footprint: [{ x: 0, y: 0 }] },
  {
    id: "relic",
    swatch: "pale",
    footprint: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: 1 },
    ],
  },
  {
    id: "scroll",
    swatch: "slate",
    footprint: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
  },
  {
    id: "key",
    swatch: "coral",
    footprint: [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
  },
  { id: "tonic", swatch: "pale", footprint: [{ x: 0, y: 0 }] },
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
  { itemId: "shield", gridId: "backpack", origin: { x: 0, y: 0 }, rotation: 0 },
  { itemId: "sword", gridId: "backpack", origin: { x: 2, y: 0 }, rotation: 0 },
  { itemId: "potion", gridId: "backpack", origin: { x: 3, y: 0 }, rotation: 0 },
  { itemId: "gem", gridId: "backpack", origin: { x: 3, y: 1 }, rotation: 0 },
  { itemId: "relic", gridId: "backpack", origin: { x: 3, y: 2 }, rotation: 0 },
  { itemId: "scroll", gridId: "backpack", origin: { x: 0, y: 3 }, rotation: 0 },
  { itemId: "key", gridId: "stash", origin: { x: 0, y: 0 }, rotation: 0 },
  { itemId: "tonic", gridId: "stash", origin: { x: 3, y: 3 }, rotation: 0 },
];
