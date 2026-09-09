/** Shared floor-plan dimensions — keep in sync with row/cabin components. */

export const SEAT_WIDTH = 108;
export const SEAT_HEIGHT = 140;
export const SEAT_DEPTH = 12;
export const LABEL_WIDTH = 128;
export const CELL_GAP = 14;

/** AI / OpenCV generated layout canvas — matches Colan seat proportions. */
export const CANVAS_SEAT_WIDTH = SEAT_WIDTH;
export const CANVAS_SEAT_HEIGHT = SEAT_HEIGHT;
export const CANVAS_CELL_GAP = CELL_GAP;
export const CANVAS_SEAT_STRIDE = CANVAS_SEAT_WIDTH + CANVAS_CELL_GAP;
export const CANVAS_BAND_HEIGHT = SEAT_HEIGHT + 12;
export const CANVAS_ROW_BAND_GAP = 8;
export const CANVAS_ROW_GAP = 24;
export const CANVAS_ROOM_PADDING = 60;
export const CANVAS_PILLAR_WIDTH = SEAT_WIDTH * 2 + CELL_GAP;
export const CANVAS_ENTRANCE_WIDTH = SEAT_WIDTH * 3 + CELL_GAP * 2;
export const CANVAS_LABEL_WIDTH = 72;
export const CANVAS_ROW_STRIDE = CANVAS_SEAT_HEIGHT + CANVAS_ROW_GAP;

/** Single seat band height (matches seat cell: SEAT_HEIGHT + SEAT_DEPTH). */
export const SEAT_BAND_HEIGHT = SEAT_HEIGHT + SEAT_DEPTH;

/** Gap between top and bottom bands inside one row block (mt-2). */
export const ROW_BAND_GAP = 8;

/**
 * Full seating row block height — A1↔A17 (A-ROW) or B1↔B24 (B-ROW).
 * Side cabins sized to one row use this value.
 */
export const ROW_BLOCK_HEIGHT = SEAT_BAND_HEIGHT * 2 + ROW_BAND_GAP;

/** Margin between row blocks (mb-6). */
export const ROW_AISLE_MARGIN = 24;

export const SIDE_CABIN_WIDTH = 88;
export const HORIZONTAL_CABIN_HEIGHT = 88;

/** Top offset before row A (top cabin strip + mb-6). */
export const SIDE_CABIN_TOP_OFFSET =
  HORIZONTAL_CABIN_HEIGHT + ROW_AISLE_MARGIN;
