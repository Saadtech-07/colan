import type { FloorCell, SeatingRowConfig } from "@/lib/seating-layout";

function seatRange(prefix: string, from: number, to: number, step = 1): FloorCell[] {
  const cells: FloorCell[] = [];
  if (step > 0) {
    for (let i = from; i <= to; i += 1) cells.push({ kind: "seat", id: `${prefix}${i}` });
  } else {
    for (let i = from; i >= to; i += step) cells.push({ kind: "seat", id: `${prefix}${i}` });
  }
  return cells;
}

/**
 * Build a simple dual-bank seating row from a letter key + seat count.
 * Seats are split evenly across top/bottom (odd count puts the extra on top).
 */
export function buildSimpleSeatingRow(input: {
  key: string;
  label?: string;
  seatCount: number;
  floorKey?: string;
}): SeatingRowConfig {
  const key = input.key.trim().toUpperCase();
  const seatCount = Math.max(0, Math.floor(input.seatCount));
  const label = (input.label?.trim() || `${key}-ROW`).toUpperCase();
  const topCount = Math.ceil(seatCount / 2);
  const bottomCount = seatCount - topCount;

  const top: FloorCell[] = [
    { kind: "label", text: `${label} (${seatCount})` },
    ...(topCount > 0 ? seatRange(key, 1, topCount) : []),
  ];
  const bottom: FloorCell[] = [
    { kind: "label", text: "" },
    ...(bottomCount > 0
      ? seatRange(key, seatCount, topCount + 1, -1)
      : []),
  ];

  return {
    key,
    label,
    seatCount,
    ...(input.floorKey ? { floorKey: input.floorKey } : {}),
    top,
    bottom,
  };
}

export function slugifyFloorPlanSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
