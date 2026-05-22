/**
 * Office floor plan — matches the Colan seating reference layout.
 * Rows: A, B, C, D, F, E, G (F before E as on the plan).
 */

export type FloorCell =
  | { kind: "label"; text: string }
  | { kind: "seat"; id: string }
  | { kind: "pillar" }
  | { kind: "entrance"; text: string }
  | { kind: "gap" };

export type SeatingRowConfig = {
  key: string;
  label: string;
  seatCount: number;
  top: FloorCell[];
  bottom: FloorCell[];
};

function seatIds(prefix: string, from: number, to: number, step = 1): FloorCell[] {
  const cells: FloorCell[] = [];
  if (step > 0) {
    for (let i = from; i <= to; i++) cells.push({ kind: "seat", id: `${prefix}${i}` });
  } else {
    for (let i = from; i >= to; i += step) cells.push({ kind: "seat", id: `${prefix}${i}` });
  }
  return cells;
}

function rowLabel(text: string): FloorCell {
  return { kind: "label", text };
}

const pillar = (): FloorCell => ({ kind: "pillar" });
const gap = (): FloorCell => ({ kind: "gap" });

export const SEATING_ROWS: SeatingRowConfig[] = [
  {
    key: "A",
    label: "A-ROW",
    seatCount: 32,
    top: [rowLabel("A-ROW (32)"), ...seatIds("A", 1, 16)],
    bottom: [rowLabel(""), ...seatIds("A", 17, 32)],
  },
  {
    key: "B",
    label: "B-ROW",
    seatCount: 24,
    top: [
      rowLabel("B-ROW (24)"),
      ...seatIds("B", 1, 3),
      pillar(),
      ...seatIds("B", 4, 8),
      pillar(),
      ...seatIds("B", 9, 12),
    ],
    bottom: [
      rowLabel(""),
      ...seatIds("B", 24, 22, -1),
      pillar(),
      ...seatIds("B", 21, 17, -1),
      pillar(),
      ...seatIds("B", 16, 13, -1),
    ],
  },
  {
    key: "C",
    label: "C-ROW",
    seatCount: 32,
    top: [rowLabel("C-ROW (32)"), ...seatIds("C", 1, 16)],
    bottom: [rowLabel(""), ...seatIds("C", 17, 32)],
  },
  {
    key: "D",
    label: "D-ROW",
    seatCount: 18,
    top: [
      rowLabel("D-ROW (18)"),
      { kind: "entrance", text: "*** ENTRANCE OPPOSITE ***" },
      pillar(),
      ...seatIds("D", 1, 5),
      pillar(),
      ...seatIds("D", 6, 9),
    ],
    bottom: [
      rowLabel(""),
      gap(),
      pillar(),
      ...seatIds("D", 18, 14, -1),
      pillar(),
      ...seatIds("D", 13, 10, -1),
    ],
  },
  {
    key: "F",
    label: "F-ROW",
    seatCount: 32,
    top: [rowLabel("F-ROW (32)"), ...seatIds("F", 1, 16)],
    bottom: [rowLabel(""), ...seatIds("F", 32, 17, -1)],
  },
  {
    key: "E",
    label: "E-ROW",
    seatCount: 24,
    top: [
      rowLabel("E-ROW (24)"),
      ...seatIds("E", 1, 3),
      pillar(),
      ...seatIds("E", 4, 8),
      pillar(),
      ...seatIds("E", 9, 12),
    ],
    bottom: [
      rowLabel(""),
      ...seatIds("E", 24, 22, -1),
      pillar(),
      ...seatIds("E", 21, 17, -1),
      pillar(),
      ...seatIds("E", 16, 13, -1),
    ],
  },
  {
    key: "G",
    label: "G-ROW",
    seatCount: 32,
    top: [rowLabel("G-ROW (32)"), ...seatIds("G", 1, 16)],
    bottom: [rowLabel(""), ...seatIds("G", 32, 17, -1)],
  },
];

export const ALL_SEAT_IDS: string[] = SEATING_ROWS.flatMap((row) =>
  [...row.top, ...row.bottom]
    .filter((c): c is Extract<FloorCell, { kind: "seat" }> => c.kind === "seat")
    .map((c) => c.id),
);

const SEAT_SET = new Set(ALL_SEAT_IDS);

export function isValidSeatId(id: string): boolean {
  return SEAT_SET.has(id);
}

/** @deprecated Use ALL_SEAT_IDS — legacy alias for bay id lists */
export const ALL_BAY_IDS = ALL_SEAT_IDS;
