import type {
  BoundingBox,
  LayoutAnalysisResult,
  LayoutObject,
} from "@/lib/opencv-types/layout";
import type { AILayoutSchema } from "@/lib/seating-layout-types";
import {
  CANVAS_BAND_HEIGHT,
  CANVAS_SEAT_HEIGHT,
  CANVAS_SEAT_WIDTH,
} from "@/lib/seating-layout-metrics";
import { normalizeAiLayoutGeometry } from "@/lib/seating-layout-normalize";

const ROW_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function overlapRatio(a: BoundingBox, b: BoundingBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x2 <= x1 || y2 <= y1) return 0;
  const intersection = (x2 - x1) * (y2 - y1);
  const minArea = Math.min(a.width * a.height, b.width * b.height);
  return minArea > 0 ? intersection / minArea : 0;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

function dedupeDeskCandidates(objects: LayoutObject[]): LayoutObject[] {
  const sorted = [...objects].sort((a, b) => b.confidence - a.confidence);
  const kept: LayoutObject[] = [];

  for (const obj of sorted) {
    if (obj.type !== "table" && obj.type !== "seat") continue;
    if (kept.some((existing) => overlapRatio(existing.bbox, obj.bbox) > 0.55)) continue;
    kept.push(obj);
  }

  return kept;
}

function splitSeatsAndPillars(
  desks: LayoutObject[],
  decorations: LayoutObject[],
): { seats: LayoutObject[]; pillars: LayoutObject[] } {
  const widths = desks.map((desk) => desk.bbox.width);
  const heights = desks.map((desk) => desk.bbox.height);
  const medW = median(widths) || 40;
  const medH = median(heights) || 40;
  const medArea = medW * medH;

  const seats: LayoutObject[] = [];
  const pillars: LayoutObject[] = [];

  for (const desk of desks) {
    const area = desk.bbox.width * desk.bbox.height;
    const isWide = desk.bbox.width > medW * 1.55 || desk.bbox.height > medH * 1.55;
    const isLarge = area > medArea * 2;
    if (isWide && isLarge) {
      pillars.push(desk);
    } else {
      seats.push(desk);
    }
  }

  for (const decoration of decorations) {
    const area = decoration.bbox.width * decoration.bbox.height;
    if (area >= medArea * 1.4) {
      pillars.push(decoration);
    }
  }

  return { seats, pillars };
}

type ScaledSeat = {
  obj: LayoutObject;
  cx: number;
  cy: number;
  x: number;
  y: number;
};

function computeRowTolerance(scaledSeats: ScaledSeat[]): number {
  if (scaledSeats.length < 2) return CANVAS_BAND_HEIGHT * 0.55;

  const ys = scaledSeats.map((seat) => seat.cy).sort((a, b) => a - b);
  const gaps = ys.slice(1).map((y, index) => y - ys[index]!).filter((gap) => gap > 4);
  const medGap = median(gaps) || CANVAS_BAND_HEIGHT;

  return Math.max(
    CANVAS_BAND_HEIGHT * 0.55,
    Math.min(medGap * 1.35, CANVAS_BAND_HEIGHT * 1.6),
  );
}

function clusterRows(scaledSeats: ScaledSeat[]): ScaledSeat[][] {
  const rowTolerance = computeRowTolerance(scaledSeats);
  const rows: ScaledSeat[][] = [];

  const sorted = [...scaledSeats].sort((a, b) => a.cy - b.cy || a.cx - b.cx);

  for (const seat of sorted) {
    const row = rows.find((group) => Math.abs(group[0]!.cy - seat.cy) < rowTolerance);
    if (row) row.push(seat);
    else rows.push([seat]);
  }

  for (const row of rows) {
    row.sort((a, b) => a.cx - b.cx);
  }

  return rows;
}

/** Convert OpenCV floor-plan analysis into the app's AI layout schema. */
export function convertAnalysisToAiLayout(
  analysis: LayoutAnalysisResult,
  options?: { name?: string },
): AILayoutSchema {
  const deskCandidates = dedupeDeskCandidates(
    analysis.objects.filter((obj) => obj.type === "table" || obj.type === "seat"),
  );
  const doors = analysis.objects.filter((obj) => obj.type === "door");
  const decorations = analysis.objects.filter(
    (obj) => obj.type === "decoration" || obj.type === "logo",
  );
  const walls = analysis.objects.filter((obj) => obj.type === "wall");

  const { seats: seatObjects, pillars: pillarObjects } = splitSeatsAndPillars(
    deskCandidates,
    decorations,
  );

  const medW = median(seatObjects.map((seat) => seat.bbox.width)) || 40;
  const medH = median(seatObjects.map((seat) => seat.bbox.height)) || 40;
  const scale = CANVAS_SEAT_WIDTH / Math.max(medW, 1);
  const seatHeightScale = CANVAS_SEAT_HEIGHT / Math.max(medH, 1);

  const scaledSeats: ScaledSeat[] = seatObjects.map((obj) => ({
    obj,
    cx: (obj.bbox.x + obj.bbox.width / 2) * scale,
    cy: (obj.bbox.y + obj.bbox.height / 2) * seatHeightScale,
    x: obj.bbox.x * scale,
    y: obj.bbox.y * seatHeightScale,
  }));

  const rows = clusterRows(scaledSeats);
  const seats: AILayoutSchema["seats"] = [];
  let seatCounter = 1;

  rows.forEach((row, rowIndex) => {
    const rowLetter = ROW_LETTERS[rowIndex] ?? `R${rowIndex + 1}`;
    row.forEach((seat, colIndex) => {
      seats.push({
        id: `seat_${seatCounter++}`,
        label: `${rowLetter}${colIndex + 1}`,
        row: rowIndex,
        col: colIndex,
        x: Math.round(seat.x),
        y: Math.round(seat.y),
      });
    });
  });

  let pillarCounter = 1;
  const pillars: AILayoutSchema["pillars"] = [
    ...pillarObjects.map((obj) => ({
      id: `pillar_${pillarCounter++}`,
      x: Math.round(obj.bbox.x * scale),
      y: Math.round(obj.bbox.y * seatHeightScale),
      width: Math.round(obj.bbox.width * scale),
      height: Math.round(obj.bbox.height * seatHeightScale),
      label: "PILLAR",
    })),
    ...doors.map((obj) => ({
      id: `entrance_${pillarCounter++}`,
      x: Math.round(obj.bbox.x * scale),
      y: Math.round(obj.bbox.y * seatHeightScale),
      width: Math.round(obj.bbox.width * scale),
      height: Math.round(obj.bbox.height * seatHeightScale),
      label: "ENTRANCE",
    })),
  ];

  const wallObjects: AILayoutSchema["walls"] = walls.map((obj, index) => {
    const start = obj.polygon?.[0] ?? { x: obj.bbox.x, y: obj.bbox.y };
    const end =
      obj.polygon?.[1] ?? {
        x: obj.bbox.x + obj.bbox.width,
        y: obj.bbox.y + obj.bbox.height,
      };

    return {
      id: `wall_${index + 1}`,
      x1: Math.round(start.x * scale),
      y1: Math.round(start.y * seatHeightScale),
      x2: Math.round(end.x * scale),
      y2: Math.round(end.y * seatHeightScale),
    };
  });

  const groups = rows.map((row, rowIndex) => {
    const rowLetter = ROW_LETTERS[rowIndex] ?? `R${rowIndex + 1}`;
    const rowSeatIds = seats.filter((seat) => seat.row === rowIndex).map((seat) => seat.id);
    return {
      id: `group_${rowLetter}`,
      name: `${rowLetter}-ROW`,
      seatIds: rowSeatIds,
      color: "#6366f1",
    };
  });

  const name =
    options?.name ??
    analysis.image.filename?.replace(/\.[^.]+$/, "") ??
    "Uploaded floor plan";

  return normalizeAiLayoutGeometry({
    name,
    description: `${seats.length} seats detected with ${pillars.length} structural blocks (OpenCV).`,
    room: {
      width: Math.ceil(analysis.image.width * scale),
      height: Math.ceil(analysis.image.height * seatHeightScale),
    },
    seats,
    pillars,
    walls: wallObjects,
    groups,
  });
}
