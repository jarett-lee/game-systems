import { describe, expect, test } from "vitest";
import { footprintBounds, rotateFootprint, type Footprint } from "./footprint";

const lShape: Footprint = [
  { x: 0, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: 2 },
  { x: 1, y: 2 },
];

describe("rotateFootprint", () => {
  test("rotation 0 leaves the footprint unchanged", () => {
    expect(rotateFootprint(lShape, 0)).toEqual(lShape);
  });

  test("one turn rotates clockwise and keeps the shape at the top-left", () => {
    expect(rotateFootprint(lShape, 1)).toEqual([
      { x: 2, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ]);
  });

  test("four turns bring the footprint back to where it started", () => {
    const fourTurns = [1, 1, 1, 1].reduce<Footprint>((shape) => rotateFootprint(shape, 1), lShape);
    expect(fourTurns).toEqual(lShape);
  });

  test("two turns equal two single turns", () => {
    expect(rotateFootprint(lShape, 2)).toEqual(rotateFootprint(rotateFootprint(lShape, 1), 1));
  });

  test("a 1x3 bar turns into a 3x1 bar", () => {
    const bar: Footprint = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ];
    expect(footprintBounds(rotateFootprint(bar, 1))).toEqual({ width: 3, height: 1 });
  });
});
