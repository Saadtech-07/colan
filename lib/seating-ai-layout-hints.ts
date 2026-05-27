import { ALL_SEAT_IDS } from "@/lib/seating-layout";

export function parseTargetSeatCount(prompt: string): number | null {
  const patterns = [
    /\b(\d{1,3})\s*[-\s]?\s*seats?\b/i,
    /\b(\d{1,3})\s*[-\s]?\s*desks?\b/i,
    /\b(\d{1,3})\s*[-\s]?\s*employees?\b/i,
    /\b(\d{1,3})\s*[-\s]?\s*workspaces?\b/i,
  ];

  for (const pattern of patterns) {
    const match = prompt.match(pattern);
    if (match?.[1]) {
      const count = Number.parseInt(match[1], 10);
      if (Number.isFinite(count) && count > 0) {
        return Math.min(count, ALL_SEAT_IDS.length);
      }
    }
  }

  const rowsMatch = prompt.match(/\b(\d)\s*rows?\s+of\s+(\d{1,2})\s+desks?\b/i);
  if (rowsMatch) {
    const total = Number.parseInt(rowsMatch[1]!, 10) * Number.parseInt(rowsMatch[2]!, 10);
    if (total > 0) return Math.min(total, ALL_SEAT_IDS.length);
  }

  return null;
}

function seatsByRow(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const seatId of ALL_SEAT_IDS) {
    const row = seatId.charAt(0);
    const list = map.get(row) ?? [];
    list.push(seatId);
    map.set(row, list);
  }
  return map;
}

function takeRowSeats(row: string, count: number): string[] {
  return (seatsByRow().get(row) ?? []).slice(0, count);
}

/** Maps common department labels to seat zones on the Colan floor plan. */
export function buildLayoutSeatZones(prompt: string, targetSeatCount: number | null): string {
  const lower = prompt.toLowerCase();
  const perRow =
    targetSeatCount && targetSeatCount % 5 === 0
      ? targetSeatCount / 5
      : targetSeatCount && targetSeatCount % 4 === 0
        ? targetSeatCount / 4
        : 8;

  const zones: string[] = [];

  if (/engineering|development|dev\b|left/i.test(lower)) {
    zones.push(`Engineering (left): ${takeRowSeats("A", perRow).join(", ") || "A1–A8"}`);
  }
  if (/marketing|center-left|centre-left/i.test(lower)) {
    zones.push(`Marketing (center-left): ${takeRowSeats("B", perRow).join(", ") || "B1–B8"}`);
  }
  if (/sales|center-right|centre-right/i.test(lower)) {
    zones.push(`Sales (center-right): ${takeRowSeats("C", perRow).join(", ") || "C1–C8"}`);
  }
  if (/support|customer|right\b/i.test(lower)) {
    zones.push(`Support (right): ${takeRowSeats("F", perRow).join(", ") || "F1–F8"}`);
  }

  if (!zones.length && targetSeatCount) {
    const rows = ["A", "B", "C", "D", "F"];
    const seatsPerRow = Math.max(1, Math.floor(targetSeatCount / rows.length));
    for (const row of rows) {
      const seats = takeRowSeats(row, seatsPerRow);
      if (seats.length) zones.push(`${row}-ROW block: ${seats.join(", ")}`);
    }
  }

  return zones.length ? zones.join("\n") : "";
}

export function buildTargetSeatInstruction(prompt: string): string | null {
  const target = parseTargetSeatCount(prompt);
  if (!target) return null;

  const zones = buildLayoutSeatZones(prompt, target);

  const lines = [
    `REQUIRED: layoutSeats must contain exactly ${target} valid seat IDs (blank desks only).`,
    "Do not assign employees.",
  ];

  if (zones) {
    lines.push("Suggested seat zones for this layout:");
    lines.push(zones);
  }

  lines.push("Keep JSON compact. No markdown.");

  return lines.join("\n");
}

export function estimateMaxTokensForSeatTarget(targetSeatCount: number | null): number {
  if (!targetSeatCount) return 1800;
  return Math.min(4096, 500 + targetSeatCount * 35);
}
