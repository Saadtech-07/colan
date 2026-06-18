/** Shared floor-plan dimensions — keep in sync with row/cabin components. */

export const SEAT_WIDTH = 108;
export const SEAT_HEIGHT = 140;
export const SEAT_DEPTH = 12;
export const LABEL_WIDTH = 128;
export const CELL_GAP = 10;

/** Single seat band (e.g. A1–A16 or A17–A32). */
export const SEAT_BAND_HEIGHT = SEAT_HEIGHT + SEAT_DEPTH + 12;

/** Gap between top and bottom bands inside one row block. */
export const ROW_BAND_GAP = 8;

/** Full row block height (A1→A17 span, B1→B24 span). */
export const ROW_BLOCK_HEIGHT = SEAT_BAND_HEIGHT * 2 + ROW_BAND_GAP;

/** Margin between row blocks (mb-6). */
export const ROW_AISLE_MARGIN = 24;

export const SIDE_CABIN_WIDTH = 88;
export const HORIZONTAL_CABIN_HEIGHT = 88;

/** Top offset before row A (horizontal cabin row + margin). */
export const SIDE_CABIN_TOP_OFFSET =
  HORIZONTAL_CABIN_HEIGHT + SEAT_DEPTH + 12 + ROW_AISLE_MARGIN;
