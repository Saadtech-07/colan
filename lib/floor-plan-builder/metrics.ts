import { BUILDER_CELL_GAP, BUILDER_CELL_PX } from "./types";

/** Pixel size of an element footprint on the builder grid. */
export function elementPixelSize(width: number, height: number): { width: number; height: number } {
  return {
    width: width * BUILDER_CELL_PX + (width - 1) * BUILDER_CELL_GAP,
    height: height * BUILDER_CELL_PX + (height - 1) * BUILDER_CELL_GAP,
  };
}
