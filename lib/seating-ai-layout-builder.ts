import type { SeatingAiSuggestion } from "@/lib/seating-ai-types";

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
