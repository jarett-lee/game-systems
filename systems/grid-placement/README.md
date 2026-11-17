# Grid Placement

The first Game System: placing items on cell grids by dragging, dropping, rotating, and popping them in and out, in the style of a grid inventory.

Its words (Grid, Cell, Item, Footprint, Rotation, Placement, Hand, Pop out, Swap, Push, Nudge, Return, Stow) are defined in [GLOSSARY.md](GLOSSARY.md).

## Scope for version 1

- **Any shape**: an Item's Footprint can be any shape made of Cells, not only rectangles.
- **Rotation** in 90° steps, either direction. Items are never mirrored.
- **Several Grids**, such as a backpack and a stash. Items move between them.
- **Swap**: dropping an Item where it covers exactly one other Item places it and pops the covered Item out into the Hand.
- **Push**: dropping an Item where it covers two or more Items moves them to the nearest free spots in the same Grid. If they can't all move, the drop is rejected. An option pushes a single covered Item aside instead of swapping it (the Demo's default); if it has nowhere to go, it's swapped.
- **Nudge**: if any Cell of the held Item is over a Grid, the Item is moved fully inside that Grid before it drops.
- **Return**: letting go where the Item can't land puts it back where it came from, or stows it if a swap took that spot.
- **Pop out**: picking an Item up moves it from its Grid into the Hand.

## Not in version 1

- Stacking identical Items in one Cell. A natural reason for a later Post.

## Demo

Two Grids side by side, with Tweakpane controls. The Showreel drags, rotates, swaps, and moves Items between the Grids.

## Code

- [src/footprint.ts](src/footprint.ts): Footprints and Rotation.
- [src/inventory.ts](src/inventory.ts): Grids, Placements, the Hand, and every move: drop (place, swap, or reject), pop out, rotate, stow. Every function takes an inventory and returns a new one, so nothing is mutated.
- The Demo lives in [site/grid-placement](../../site/grid-placement/). Open it with `?showreel` to play the Showreel full-screen for recording.

## Status

**Built.** Code, tests, Demo, and Showreel are merged to `main`. Its Posts haven't been made yet.
