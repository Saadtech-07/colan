import type { AILayoutSchema } from "@/lib/seating-layout-types";

const ROOM_PADDING = 60;
const SEAT_SIZE = 60;

function updateBounds(
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  return {
    minX: Math.min(minX, x),
    minY: Math.min(minY, y),
    maxX: Math.max(maxX, x + width),
    maxY: Math.max(maxY, y + height),
  };
}

/** Fit room to content and translate so nothing is clipped or floating in empty space. */
export function normalizeAiLayoutGeometry(aiData: AILayoutSchema): AILayoutSchema {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const seat of aiData.seats) {
    ({ minX, minY, maxX, maxY } = updateBounds(
      minX,
      minY,
      maxX,
      maxY,
      seat.x,
      seat.y,
      SEAT_SIZE,
      SEAT_SIZE,
    ));
  }

  for (const pillar of aiData.pillars ?? []) {
    ({ minX, minY, maxX, maxY } = updateBounds(
      minX,
      minY,
      maxX,
      maxY,
      pillar.x,
      pillar.y,
      pillar.width,
      pillar.height,
    ));
  }

  for (const wall of aiData.walls ?? []) {
    ({ minX, minY, maxX, maxY } = updateBounds(
      minX,
      minY,
      maxX,
      maxY,
      Math.min(wall.x1, wall.x2),
      Math.min(wall.y1, wall.y2),
      Math.abs(wall.x2 - wall.x1) || 1,
      Math.abs(wall.y2 - wall.y1) || 1,
    ));
  }

  if (!Number.isFinite(minX)) {
    return aiData;
  }

  const offsetX = ROOM_PADDING - minX;
  const offsetY = ROOM_PADDING - minY;
  const roomWidth = Math.max(maxX - minX + ROOM_PADDING * 2, 320);
  const roomHeight = Math.max(maxY - minY + ROOM_PADDING * 2, 240);

  return {
    ...aiData,
    room: { width: Math.ceil(roomWidth), height: Math.ceil(roomHeight) },
    seats: aiData.seats.map((seat) => ({
      ...seat,
      x: seat.x + offsetX,
      y: seat.y + offsetY,
    })),
    pillars: (aiData.pillars ?? []).map((pillar) => ({
      ...pillar,
      x: pillar.x + offsetX,
      y: pillar.y + offsetY,
    })),
    walls: (aiData.walls ?? []).map((wall) => ({
      ...wall,
      x1: wall.x1 + offsetX,
      y1: wall.y1 + offsetY,
      x2: wall.x2 + offsetX,
      y2: wall.y2 + offsetY,
    })),
  };
}
