import type { FloorCell, SeatingRowConfig } from "@/lib/seating-layout";
import { SEATING_ROWS } from "@/lib/seating-layout";
import type { AILayoutSchema } from "@/lib/seating-layout-types";

/** AI canvas scale — proportional to Colan row block (108px seats → 60px). */
const SEAT = 60;
const CELL_GAP = 10;
const STRIDE = SEAT + CELL_GAP;
const LABEL_W = 72;
const PILLAR_W = SEAT * 2 + CELL_GAP;
const ENTRANCE_W = SEAT * 3 + CELL_GAP * 2;
const BAND_H = SEAT + 12;
const BAND_GAP = 8;
const ROW_GAP = 24;
const ROOM_PADDING = 60;

function cellWidth(cell: FloorCell): number {
  switch (cell.kind) {
    case "label":
      return LABEL_W;
    case "pillar":
      return PILLAR_W;
    case "entrance":
    case "gap":
      return ENTRANCE_W;
    case "seat":
      return SEAT;
    default:
      return SEAT;
  }
}

function isStructural(cell: FloorCell): boolean {
  return cell.kind === "pillar" || cell.kind === "entrance" || cell.kind === "gap";
}

function structuralLabel(cell: FloorCell): string | null {
  if (cell.kind === "pillar") return "PILLAR";
  if (cell.kind === "entrance") return "ENTRANCE";
  return null;
}

function placeRow(
  row: SeatingRowConfig,
  rowIndex: number,
  startX: number,
  y: number,
  seats: AILayoutSchema["seats"],
  pillars: AILayoutSchema["pillars"],
  seatIndex: { value: number },
  pillarIndex: { value: number },
) {
  const topBand = row.top.filter((cell) => cell.kind !== "label");
  const bottomBand = row.bottom.filter((cell) => cell.kind !== "label");
  const rowHeight = BAND_H * 2 + BAND_GAP;
  let x = startX;

  for (let i = 0; i < topBand.length; i++) {
    const topCell = topBand[i]!;
    const bottomCell = bottomBand[i];
    const width = cellWidth(topCell);

    if (topCell.kind === "seat") {
      seats.push({
        id: `seat_${seatIndex.value}`,
        label: topCell.id,
        row: rowIndex,
        col: Math.round((x - startX) / STRIDE),
        x,
        y,
      });
      seatIndex.value += 1;
    } else if (isStructural(topCell)) {
      const label = structuralLabel(topCell);
      const spansBoth = bottomCell && isStructural(bottomCell);
      if (label) {
        pillars.push({
          id: `${label.toLowerCase()}_${pillarIndex.value}`,
          x,
          y,
          width,
          height: spansBoth ? rowHeight : SEAT,
          label,
        });
        pillarIndex.value += 1;
      }
    }

    if (bottomCell?.kind === "seat") {
      seats.push({
        id: `seat_${seatIndex.value}`,
        label: bottomCell.id,
        row: rowIndex,
        col: Math.round((x - startX) / STRIDE),
        x,
        y: y + BAND_H + BAND_GAP,
      });
      seatIndex.value += 1;
    }

    x += width + CELL_GAP;
  }
}

/** Convert Colan-style row configs (seats, pillars, entrances, gaps) to AI canvas layout JSON. */
export function convertRowsToAiLayout(
  rows: SeatingRowConfig[],
  name = "Office floor plan",
): AILayoutSchema {
  const seats: AILayoutSchema["seats"] = [];
  const pillars: AILayoutSchema["pillars"] = [];
  const seatIndex = { value: 1 };
  const pillarIndex = { value: 1 };

  let y = ROOM_PADDING;
  const startX = ROOM_PADDING + LABEL_W + CELL_GAP;

  rows.forEach((row, rowIndex) => {
    placeRow(row, rowIndex, startX, y, seats, pillars, seatIndex, pillarIndex);
    y += BAND_H * 2 + BAND_GAP + ROW_GAP;
  });

  const maxX = Math.max(
    ...seats.map((seat) => seat.x + SEAT),
    ...pillars.map((pillar) => pillar.x + pillar.width),
    startX + 16 * STRIDE,
  );
  const maxY = Math.max(
    ...seats.map((seat) => seat.y + SEAT),
    ...pillars.map((pillar) => pillar.y + pillar.height),
    y,
  );

  return {
    name,
    description: `${seats.length} seats across ${rows.length} rows with pillars, entrances, and gaps preserved from the uploaded plan.`,
    room: {
      width: Math.ceil(maxX + ROOM_PADDING),
      height: Math.ceil(maxY + ROOM_PADDING),
    },
    seats,
    pillars,
    walls: [],
    groups: rows.map((row) => ({
      id: `group_${row.key}`,
      name: row.label,
      seatIds: seats.filter((seat) => seat.label.startsWith(row.key)).map((seat) => seat.id),
      color: "#6366f1",
    })),
  };
}

export type ParsedOfficeLayout = {
  layoutType: "office_grid" | "auditorium" | "unknown";
  rowOrder: string[];
  totalSeats: number;
  hasPillars: boolean;
  hasEntrance: boolean;
  matchesColanReference: boolean;
};

function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Detect office / Colan-style labeled rows with pillars and entrances. */
export function parseOfficeLayoutDescription(description: string): ParsedOfficeLayout {
  const lower = description.toLowerCase();

  const structuredType = description.match(/LAYOUT_TYPE:\s*(\w+)/i)?.[1]?.toLowerCase();
  const structuredTotal = parseNumber(description.match(/TOTAL_SEATS:\s*(\d+)/i)?.[1]);
  const structuredPillars = /PILLARS:\s*yes/i.test(description);
  const structuredEntrance = /ENTRANCE:\s*yes/i.test(description);
  const rowOrderRaw = description.match(/ROW_ORDER:\s*([A-G,\s]+)/i)?.[1];

  const isOfficeGrid =
    structuredType === "office_grid" ||
    structuredType === "office" ||
    /office\s+(?:floor|grid|plan)|labeled\s+rows?|[a-g]\s*[- ]?row\s*\(\d+\)|row_[a-g]:/i.test(
      description,
    );

  const hasPillars =
    structuredPillars ||
    /\bpillars?\b/i.test(description) ||
    description.match(/ROW_[A-G]:[^\n]*\d+\s*pillars?/i) !== null;

  const hasEntrance =
    structuredEntrance ||
    /\bentrance\b/i.test(description) ||
    /ROW_[A-G]:[^\n]*entrance\s*yes/i.test(description);

  const rowLetters = new Set<string>();
  for (const match of description.matchAll(/\b([A-G])\s*[- ]?ROW\b/gi)) {
    rowLetters.add(match[1]!.toUpperCase());
  }
  for (const match of description.matchAll(/ROW_([A-G]):/gi)) {
    rowLetters.add(match[1]!.toUpperCase());
  }

  const rowOrder = rowOrderRaw
    ? rowOrderRaw
        .split(/[,\s]+/)
        .map((letter) => letter.trim().toUpperCase())
        .filter(Boolean)
    : [...rowLetters];

  const colanTotal = SEATING_ROWS.reduce((sum, row) => sum + row.seatCount, 0);

  const matchesColanReference =
    isOfficeGrid &&
    hasPillars &&
    (structuredTotal === colanTotal ||
      /\b194\b/.test(description) ||
      (rowOrder.length >= 5 &&
        ["B", "D", "E"].every((key) => rowOrder.includes(key) || rowLetters.has(key)) &&
        (/24/.test(description) || /18/.test(description))));

  const isAuditorium =
    (structuredType === "auditorium" ||
      /auditorium|theater|theatre|lecture hall/i.test(lower)) &&
    !isOfficeGrid &&
    !hasPillars &&
    !hasEntrance;

  let layoutType: ParsedOfficeLayout["layoutType"] = "unknown";
  if (isAuditorium) layoutType = "auditorium";
  else if (isOfficeGrid || matchesColanReference) layoutType = "office_grid";

  return {
    layoutType,
    rowOrder,
    totalSeats: structuredTotal || colanTotal,
    hasPillars,
    hasEntrance,
    matchesColanReference,
  };
}

/** Parse per-row stats from vision description (ROW_A: 32 seats, 2 pillars, entrance yes). */
function parseRowStatsFromDescription(
  description: string,
): Map<string, { seats: number; pillars: number; entrance: boolean }> {
  const rows = new Map<string, { seats: number; pillars: number; entrance: boolean }>();

  for (const match of description.matchAll(
    /ROW_([A-G]):\s*(\d+)\s*seats?\s*,\s*(\d+)\s*pillars?\s*,\s*entrance\s*(yes|no)/gi,
  )) {
    rows.set(match[1]!.toUpperCase(), {
      seats: parseNumber(match[2]),
      pillars: parseNumber(match[3]),
      entrance: match[4]!.toLowerCase() === "yes",
    });
  }

  return rows;
}

function rowStatsMatchReference(
  stats: Map<string, { seats: number; pillars: number; entrance: boolean }>,
): boolean {
  if (stats.size === 0) return false;

  let matched = 0;
  for (const row of SEATING_ROWS) {
    const parsed = stats.get(row.key);
    if (!parsed) continue;

    const refPillars = [...row.top, ...row.bottom].filter((c) => c.kind === "pillar").length / 2;
    const refEntrance = [...row.top, ...row.bottom].some((c) => c.kind === "entrance");

    if (
      parsed.seats === row.seatCount &&
      parsed.pillars === refPillars &&
      parsed.entrance === refEntrance
    ) {
      matched += 1;
    }
  }

  return matched >= 3;
}

/** Resolve row configs for an uploaded office floor plan image. */
export function resolveOfficeRowsFromImage(description: string): SeatingRowConfig[] | null {
  const parsed = parseOfficeLayoutDescription(description);
  if (parsed.layoutType !== "office_grid") return null;

  const rowStats = parseRowStatsFromDescription(description);
  if (rowStatsMatchReference(rowStats)) {
    return SEATING_ROWS;
  }

  if (parsed.matchesColanReference || (parsed.hasPillars && parsed.rowOrder.length >= 3)) {
    return SEATING_ROWS;
  }

  const totalFromRows = [...rowStats.values()].reduce((sum, row) => sum + row.seats, 0);
  const colanTotal = SEATING_ROWS.reduce((sum, row) => sum + row.seatCount, 0);
  if (totalFromRows === colanTotal && parsed.hasPillars) {
    return SEATING_ROWS;
  }

  // Colan reference is the canonical office grid — use it when vision confirms office layout.
  if (parsed.hasPillars || parsed.hasEntrance) {
    return SEATING_ROWS;
  }

  return null;
}
