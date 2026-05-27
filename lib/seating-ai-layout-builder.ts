import { parseTargetSeatCount } from "@/lib/seating-ai-layout-hints";
import { ALL_SEAT_IDS, isValidSeatId } from "@/lib/seating-layout";
import type { SeatingAiSuggestion, SeatingAiZone } from "@/lib/seating-ai-types";

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

function uniqueSeats(seats: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const seatId of seats) {
    const normalized = seatId.trim().toUpperCase();
    if (!isValidSeatId(normalized) || seen.has(normalized)) continue;
    seen.add(normalized);
    next.push(normalized);
  }
  return next;
}

function padToTarget(layoutSeats: string[], target: number): string[] {
  const next = uniqueSeats(layoutSeats);
  for (const seatId of ALL_SEAT_IDS) {
    if (next.length >= target) break;
    if (!next.includes(seatId)) next.push(seatId);
  }
  return next.slice(0, target);
}

export function buildLayoutFromPrompt(prompt: string): Pick<
  SeatingAiSuggestion,
  "summary" | "strategy" | "layoutSeats" | "zones"
> {
  const lower = prompt.toLowerCase();
  const target = parseTargetSeatCount(prompt) ?? 40;
  const fiveByEight = /\b5\s*rows?\s+of\s+8\s+desks?\b/i.test(prompt);
  const perRow = fiveByEight
    ? 8
    : target % 5 === 0
      ? target / 5
      : target % 4 === 0
        ? target / 4
        : 8;

  const zones: SeatingAiZone[] = [];

  const addZone = (id: string, label: string, row: string, count = perRow) => {
    const seatIds = takeRowSeats(row, count);
    if (!seatIds.length) return;
    zones.push({ id, label, seatIds });
  };

  if (fiveByEight) {
    addZone("engineering", "Engineering (left)", "A");
    addZone("marketing", "Marketing (center-left)", "B");
    addZone("sales", "Sales (center-right)", "C");
    addZone("support", "Support (right)", "D");
    addZone("row-f", "Row F", "F");
  } else {
    if (/engineering|development|dev\b|left/i.test(lower)) {
      addZone("engineering", "Engineering", "A");
    }
    if (/marketing|center-left|centre-left/i.test(lower)) {
      addZone("marketing", "Marketing", "B");
    }
    if (/sales|center-right|centre-right/i.test(lower)) {
      addZone("sales", "Sales", "C");
    }
    if (/support|customer|right\b/i.test(lower)) {
      addZone("support", "Support", "F");
      if (!/engineering|marketing|sales/i.test(lower)) {
        addZone("support-d", "Support", "D");
      }
    }
  }

  if (!zones.length) {
    const rows = ["A", "B", "C", "D", "F"];
    const seatsPerRow = Math.max(1, Math.ceil(target / rows.length));
    for (const row of rows) {
      addZone(`row-${row.toLowerCase()}`, `${row}-ROW`, row, seatsPerRow);
    }
  }

  const layoutSeats = padToTarget(zones.flatMap((zone) => zone.seatIds), target);

  const zoneLabels = zones.map((zone) => `${zone.label} (${zone.seatIds.length} desks)`);

  return {
    summary: `${layoutSeats.length}-seat blank layout is ready. Assign employees manually on the floor plan.`,
    strategy: [
      "No employees were auto-assigned.",
      ...zoneLabels,
      'Use "Back to Colan arrangement" to restore the saved office layout view.',
    ],
    layoutSeats,
    zones: zones.map((zone) => ({
      ...zone,
      seatIds: zone.seatIds.filter((id) => layoutSeats.includes(id)),
    })),
  };
}

export function layoutSeatSet(suggestion: SeatingAiSuggestion | null): Set<string> | null {
  if (!suggestion?.layoutSeats.length) return null;
  return new Set(suggestion.layoutSeats);
}

export function zoneLabelBySeat(suggestion: SeatingAiSuggestion | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!suggestion) return map;
  for (const zone of suggestion.zones) {
    for (const seatId of zone.seatIds) {
      map.set(seatId, zone.label);
    }
  }
  return map;
}
