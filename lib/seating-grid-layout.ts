import type { AILayoutSchema } from "@/lib/seating-layout-types";
import {
  CANVAS_ROOM_PADDING,
  CANVAS_ROW_STRIDE,
  CANVAS_SEAT_HEIGHT,
  CANVAS_SEAT_STRIDE,
  CANVAS_SEAT_WIDTH,
} from "@/lib/seating-layout-metrics";
import { normalizeAiLayoutGeometry } from "@/lib/seating-layout-normalize";

const ROW_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export type GridLayoutSpec = {
  rows: number;
  cols: number;
  totalSeats: number;
};

/** Parse simple grid prompts like "40 seats with 5 columns and 8 rows". */
export function parseGridLayoutSpec(prompt: string): GridLayoutSpec | null {
  const lower = prompt.toLowerCase();

  const seatsWithDims = lower.match(
    /\b(\d+)\s*seats?\s+with\s+(\d+)\s*columns?\s+and\s+(\d+)\s*rows?\b/,
  );
  if (seatsWithDims) {
    const total = Number.parseInt(seatsWithDims[1]!, 10);
    const cols = Number.parseInt(seatsWithDims[2]!, 10);
    const rows = Number.parseInt(seatsWithDims[3]!, 10);
    if (rows > 0 && cols > 0 && rows * cols === total) {
      return { rows, cols, totalSeats: total };
    }
  }

  const colsAndRows = lower.match(/\b(\d+)\s*columns?\s+and\s+(\d+)\s*rows?\b/);
  if (colsAndRows) {
    const cols = Number.parseInt(colsAndRows[1]!, 10);
    const rows = Number.parseInt(colsAndRows[2]!, 10);
    if (rows > 0 && cols > 0) {
      return { rows, cols, totalSeats: rows * cols };
    }
  }

  const rowsAndCols = lower.match(/\b(\d+)\s*rows?\s+and\s+(\d+)\s*columns?\b/);
  if (rowsAndCols) {
    const rows = Number.parseInt(rowsAndCols[1]!, 10);
    const cols = Number.parseInt(rowsAndCols[2]!, 10);
    if (rows > 0 && cols > 0) {
      return { rows, cols, totalSeats: rows * cols };
    }
  }

  const matrix =
    lower.match(/\b(\d+)\s*rows?\s*(?:x|by|\*)\s*(\d+)\s*(?:columns?|seats?|cols?)?\b/) ??
    lower.match(/\b(\d+)\s*columns?\s*(?:x|by|\*)\s*(\d+)\s*rows?\b/);
  if (matrix) {
    const first = Number.parseInt(matrix[1]!, 10);
    const second = Number.parseInt(matrix[2]!, 10);
    if (first > 0 && second > 0) {
      const isRowsFirst = /rows?\s*(?:x|by|\*)/.test(matrix[0]!);
      const rows = isRowsFirst ? first : second;
      const cols = isRowsFirst ? second : first;
      return { rows, cols, totalSeats: rows * cols };
    }
  }

  const rowsOf = lower.match(/\b(\d+)\s*rows?\s+of\s+(\d{1,2})\s*(?:seats?|desks?|columns?|bays?)?\b/);
  if (rowsOf) {
    const rows = Number.parseInt(rowsOf[1]!, 10);
    const cols = Number.parseInt(rowsOf[2]!, 10);
    if (rows > 0 && cols > 0) {
      return { rows, cols, totalSeats: rows * cols };
    }
  }

  return null;
}

/** Build a blank grid layout with Colan seat size and spacing between bays. */
export function buildGridAiLayout(
  spec: GridLayoutSpec,
  name = "Blank grid layout",
): AILayoutSchema {
  const startX = CANVAS_ROOM_PADDING;
  const startY = CANVAS_ROOM_PADDING;
  const seats: AILayoutSchema["seats"] = [];
  let seatCounter = 1;

  for (let row = 0; row < spec.rows; row += 1) {
    const rowLetter = ROW_LETTERS[row] ?? `R${row + 1}`;
    for (let col = 0; col < spec.cols; col += 1) {
      seats.push({
        id: `seat_${seatCounter}`,
        label: `${rowLetter}${col + 1}`,
        row,
        col,
        x: startX + col * CANVAS_SEAT_STRIDE,
        y: startY + row * CANVAS_ROW_STRIDE,
      });
      seatCounter += 1;
    }
  }

  const contentWidth = (spec.cols - 1) * CANVAS_SEAT_STRIDE + CANVAS_SEAT_WIDTH;
  const contentHeight = (spec.rows - 1) * CANVAS_ROW_STRIDE + CANVAS_SEAT_HEIGHT;

  return normalizeAiLayoutGeometry({
    name,
    description: `${spec.totalSeats} seats in ${spec.rows} rows × ${spec.cols} columns with Colan bay spacing.`,
    room: {
      width: contentWidth + CANVAS_ROOM_PADDING * 2,
      height: contentHeight + CANVAS_ROOM_PADDING * 2,
    },
    seats,
    pillars: [],
    walls: [],
    groups: Array.from({ length: spec.rows }, (_, rowIndex) => {
      const rowLetter = ROW_LETTERS[rowIndex] ?? `R${rowIndex + 1}`;
      return {
        id: `group_${rowLetter}`,
        name: `${rowLetter}-ROW`,
        seatIds: seats.filter((seat) => seat.row === rowIndex).map((seat) => seat.id),
        color: "#6366f1",
      };
    }),
  });
}
