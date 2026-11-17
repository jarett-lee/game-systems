# Grid Placement

A Game System for placing items on cell grids by dragging, dropping, and rotating them, in the style of a grid inventory.

## Language

**Grid**:
A rectangle of Cells that holds Items. There can be several Grids, such as a backpack and a stash, and Items move between them.
_Avoid_: Inventory, board, container

**Cell**:
One square of a Grid. A Cell is either empty or covered by exactly one Item.
_Avoid_: Slot, tile, square

**Item**:
A Game Object that takes up one or more Cells of a Grid.
_Avoid_: Object, piece, entity

**Footprint**:
The shape an Item covers, as a set of Cells. Any shape made of Cells, not only rectangles.
_Avoid_: Shape, size, bounds

**Rotation**:
Turning an Item's Footprint in 90° steps. Items are never mirrored.
_Avoid_: Flip, orientation (when meaning the act)

**Placement**:
Where an Item sits: which Grid, the Cell its Footprint starts from, and its Rotation.
_Avoid_: Position, slot, location

**Hand**:
Where an Item is while it's being dragged and isn't on any Grid.
_Avoid_: Cursor, held slot, drag buffer

**Pop out**:
Moving an Item from a Grid into the Hand, either by picking it up or by being swapped out.
_Avoid_: Remove, eject, take

**Swap**:
Dropping the Item in Hand where its Footprint covers exactly one other Item: the dropped Item is placed and the covered Item pops out into the Hand. Covering two or more Items is a Push instead. With always-nudge, both happen only when no Nudge onto free Cells is possible.
_Avoid_: Replace, exchange, bump

**Push**:
Dropping the Item in Hand where its Footprint covers two or more Items: those Items move to the nearest free spots in the same Grid, turning if needed, so the dropped Item fits. If they can't all be moved, the drop is rejected.
_Avoid_: Shove, bump, displace

**Nudge**:
Moving the Item in Hand a short distance so it lands cleanly: fully inside a Grid when part of its Footprint hangs off the edge, or, with always-nudge, onto free Cells within reach instead of swapping or pushing.
_Avoid_: Clamp, snap, fit

**Return**:
Putting the Item in Hand back at the Placement it was popped out from, with its old Rotation. Only possible while that spot is still free.
_Avoid_: Undo, cancel, snap back

**Stow**:
Putting the Item in Hand into the first free spot that fits, turning it if needed, without swapping anything out.
_Avoid_: Auto-place, auto-sort, quick-add
