import type { AILayoutSchema } from "@/lib/seating-layout-types";

const SEAT_SIZE = 60;
const SEAT_STRIDE_X = 80;
const SEAT_STRIDE_Y = 90;
const AISLE_WIDTH = 80;
const ROOM_PADDING = 60;
const STAGE_HEIGHT = 50;

export type ParsedLayoutDescription = {
  layoutType: "auditorium" | "office" | "unknown";
  totalSeats: number;
  rows: number;
  leftCols: number;
  rightCols: number;
  hasCentralAisle: boolean;
  hasStage: boolean;
};

function parseNumber(value: string | undefined): number {
  if (!value) return 0;
  const wordMap: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };
  const lower = value.trim().toLowerCase();
  if (wordMap[lower] !== undefined) return wordMap[lower];
  const parsed = Number.parseInt(lower, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Parse structured or free-text vision description into layout parameters. */
export function parseLayoutDescription(description: string): ParsedLayoutDescription {
  const lower = description.toLowerCase();

  const structuredType = description.match(/LAYOUT_TYPE:\s*(\w+)/i)?.[1]?.toLowerCase();
  const structuredTotal = parseNumber(description.match(/TOTAL_SEATS:\s*(\w+)/i)?.[1]);
  const structuredRows = parseNumber(description.match(/ROWS:\s*(\w+)/i)?.[1]);
  const structuredLeft = parseNumber(description.match(/LEFT_COLS:\s*(\w+)/i)?.[1]);
  const structuredRight = parseNumber(description.match(/RIGHT_COLS:\s*(\w+)/i)?.[1]);
  const structuredAisle = /CENTRAL_AISLE:\s*yes/i.test(description);
  const structuredStage = /STAGE:\s*yes/i.test(description);

  const isAuditorium =
    (structuredType === "auditorium" ||
      /auditorium|theater|theatre|lecture hall/i.test(lower)) &&
    !/office_grid|office\s+(?:floor|grid|plan)|labeled\s+rows?|[a-g]\s*[- ]?row\s*\(\d+\)|\bpillars?\b|\bentrance\b/i.test(
      lower,
    ) &&
    (structuredType !== "office" && structuredType !== "office_grid");

  let totalSeats = structuredTotal;
  if (!totalSeats) {
    const totalMatch =
      lower.match(/total\s+seat\s+count[:\s]+(\d+)/i) ??
      lower.match(/(\d+)\s+seats?\s+total/i) ??
      lower.match(/total[:\s]+(\d+)\s+seats?/i);
    totalSeats = parseNumber(totalMatch?.[1]);
  }

  let rows = structuredRows;
  let leftCols = structuredLeft;
  let rightCols = structuredRight;

  const blockMatch =
    lower.match(/(\d+)\s+rows?\s*(?:x|by|\*)\s*(\d+)\s+seats?/i) ??
    lower.match(/(\d+)\s+rows?\s*(?:with|of)\s*(\d+)\s+seats?\s*(?:per\s+row|each)/i) ??
    lower.match(/(\d+)\s+rows?\s*[,/]\s*(\d+)\s+seats?\s*per\s+row/i);

  if (blockMatch) {
    rows = rows || parseNumber(blockMatch[1]);
    const colsPerBlock = parseNumber(blockMatch[2]);
    if (!leftCols) leftCols = colsPerBlock;
    if (!rightCols) rightCols = colsPerBlock;
  }

  const perRowMatch = lower.match(/(\d+)\s+seats?\s+per\s+row/i);
  if (perRowMatch && isAuditorium) {
    const perRow = parseNumber(perRowMatch[1]);
    if (perRow % 2 === 0 && !leftCols && !rightCols) {
      leftCols = perRow / 2;
      rightCols = perRow / 2;
    }
  }

  const rowCountMatch = lower.match(/(\d+)\s+rows?/i);
  if (!rows) rows = parseNumber(rowCountMatch?.[1]);

  if (isAuditorium && totalSeats > 0 && rows > 0 && !leftCols && !rightCols) {
    const perRow = Math.round(totalSeats / rows);
    if (perRow % 2 === 0) {
      leftCols = perRow / 2;
      rightCols = perRow / 2;
    } else {
      leftCols = Math.floor(perRow / 2);
      rightCols = perRow - leftCols;
    }
  }

  if (isAuditorium && rows > 0 && leftCols > 0 && !rightCols) {
    rightCols = leftCols;
  }

  const hasCentralAisle =
    structuredAisle ||
    /central\s+aisle|center\s+aisle|middle\s+aisle|aisle\s+between\s+(?:the\s+)?blocks/i.test(
      lower,
    );

  const hasStage =
    structuredStage ||
    /stage|podium|screen|presenter|front\s+desk|instructor/i.test(lower);

  const computedTotal =
    rows > 0 && leftCols > 0
      ? rows * (leftCols + (hasCentralAisle && rightCols > 0 ? rightCols : rightCols || leftCols))
      : totalSeats;

  return {
    layoutType: isAuditorium && rows > 0 && leftCols > 0 ? "auditorium" : "unknown",
    totalSeats: totalSeats || computedTotal,
    rows,
    leftCols,
    rightCols: rightCols || leftCols,
    hasCentralAisle: hasCentralAisle || (leftCols > 0 && rightCols > 0),
    hasStage: hasStage,
  };
}

/** Build a two-block auditorium layout with optional stage and central aisle. */
export function buildAuditoriumLayout(parsed: ParsedLayoutDescription): AILayoutSchema | null {
  const { rows, leftCols, rightCols, hasCentralAisle, hasStage } = parsed;
  if (rows <= 0 || leftCols <= 0) return null;

  const rightBlockCols = hasCentralAisle ? rightCols : 0;
  const startX = ROOM_PADDING;
  const startY = ROOM_PADDING + (hasStage ? STAGE_HEIGHT + 30 : 0);

  const seats: AILayoutSchema["seats"] = [];
  const walls: AILayoutSchema["walls"] = [];
  let seatIndex = 1;

  for (let row = 0; row < rows; row += 1) {
    const rowLabel = String.fromCharCode("A".charCodeAt(0) + row);

    for (let col = 0; col < leftCols; col += 1) {
      const x = startX + col * SEAT_STRIDE_X;
      const y = startY + row * SEAT_STRIDE_Y;
      seats.push({
        id: `seat_${seatIndex}`,
        label: `${rowLabel}${col + 1}`,
        row,
        col,
        x,
        y,
      });
      seatIndex += 1;
    }

    for (let col = 0; col < rightBlockCols; col += 1) {
      const x = startX + leftCols * SEAT_STRIDE_X + AISLE_WIDTH + col * SEAT_STRIDE_X;
      const y = startY + row * SEAT_STRIDE_Y;
      seats.push({
        id: `seat_${seatIndex}`,
        label: `${rowLabel}${leftCols + col + 1}`,
        row,
        col: leftCols + col,
        x,
        y,
      });
      seatIndex += 1;
    }
  }

  const pillars: AILayoutSchema["pillars"] = [];
  if (hasStage) {
    const totalWidth =
      leftCols * SEAT_STRIDE_X -
      (SEAT_STRIDE_X - SEAT_SIZE) +
      (hasCentralAisle ? AISLE_WIDTH + rightBlockCols * SEAT_STRIDE_X : 0);
    const stageWidth = Math.min(
      totalWidth,
      leftCols * SEAT_STRIDE_X + AISLE_WIDTH + rightBlockCols * SEAT_STRIDE_X - 20,
    );
    const stageX = startX + Math.max(0, (totalWidth - stageWidth) / 2);
    pillars.push({
      id: "stage_1",
      x: stageX,
      y: ROOM_PADDING + 10,
      width: stageWidth,
      height: STAGE_HEIGHT,
      label: "STAGE",
    });
  }

  const contentWidth =
    leftCols * SEAT_STRIDE_X -
    (SEAT_STRIDE_X - SEAT_SIZE) +
    (hasCentralAisle ? AISLE_WIDTH + rightBlockCols * SEAT_STRIDE_X : 0);
  const contentHeight = rows * SEAT_STRIDE_Y - (SEAT_STRIDE_Y - SEAT_SIZE);

  return {
    name: "Auditorium layout",
    description: `${seats.length} seats in ${rows} rows with ${hasCentralAisle ? "a central aisle" : "no aisle"}.`,
    room: {
      width: Math.ceil(contentWidth + ROOM_PADDING * 2),
      height: Math.ceil(
        contentHeight + ROOM_PADDING * 2 + (hasStage ? STAGE_HEIGHT + 30 : 0),
      ),
    },
    seats,
    pillars,
    walls,
    groups: [
      {
        id: "group_left",
        name: "Left block",
        seatIds: seats.filter((seat) => seat.col < leftCols).map((seat) => seat.id),
        color: "#6366f1",
      },
      ...(rightBlockCols > 0
        ? [
            {
              id: "group_right",
              name: "Right block",
              seatIds: seats.filter((seat) => seat.col >= leftCols).map((seat) => seat.id),
              color: "#06b6d4",
            },
          ]
        : []),
    ],
  };
}
