export type Cell = { readonly x: number; readonly y: number };

export type Footprint = readonly Cell[];

export type Rotation = 0 | 1 | 2 | 3;

export type Bounds = { readonly width: number; readonly height: number };

export function footprintBounds(footprint: Footprint): Bounds {
  return {
    width: Math.max(...footprint.map((cell) => cell.x)) + 1,
    height: Math.max(...footprint.map((cell) => cell.y)) + 1,
  };
}

function turnClockwise(footprint: Footprint): Footprint {
  const { height } = footprintBounds(footprint);
  return footprint.map((cell) => ({ x: height - 1 - cell.y, y: cell.x }));
}

export function rotateFootprint(footprint: Footprint, rotation: Rotation): Footprint {
  let turned = footprint;
  for (let turn = 0; turn < rotation; turn++) {
    turned = turnClockwise(turned);
  }
  return turned;
}

export function nextRotation(rotation: Rotation): Rotation {
  return ((rotation + 1) % 4) as Rotation;
}

export function previousRotation(rotation: Rotation): Rotation {
  return ((rotation + 3) % 4) as Rotation;
}
