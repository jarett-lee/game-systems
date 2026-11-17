# Grid Placement

The first Game System: placing items on cell grids by dragging, dropping, rotating, and popping them in and out, in the style of a grid inventory.

Its words (Grid, Cell, Item, Footprint, Rotation, Hand, Pop out, Swap) are defined in [GLOSSARY.md](GLOSSARY.md).

## Scope for version 1

- **Any shape**: an Item's Footprint can be any shape made of Cells, not only rectangles.
- **Rotation** in 90° steps. Items are never mirrored.
- **Several Grids**, such as a backpack and a stash. Items move between them.
- **Swap**: dropping an Item where it covers exactly one other Item places it and pops the covered Item out into the Hand. A drop that would cover two or more Items is rejected.
- **Pop out**: picking an Item up moves it from its Grid into the Hand.

## Not in version 1

- Stacking identical Items in one Cell. A natural reason for a later Post.

## Demo

Two Grids side by side, with Tweakpane controls. The Showreel drags, rotates, swaps, and moves Items between the Grids.

## Status

Not started. Built on its own branch; it's **built** once code, tests, Demo, and Showreel are merged to `main`.
