import type { SeatingAiSuggestion } from "@/lib/seating-ai-types";
import { isValidSeatId } from "@/lib/seating-layout";
import type { Employee } from "@/types";

/** True when a blank AI layout canvas is active. */
export function isAiLayoutMode(suggestion: SeatingAiSuggestion | null | undefined): boolean {
  return Boolean(suggestion?.layoutSeats?.length);
}

export function cloneOccupancyMap(source: Map<string, Employee>): Map<string, Employee> {
  return new Map(source);
}

/** Live DB occupancy limited to seats in the generated layout canvas. */
export function buildLayoutCanvasOccupancy(
  employees: Employee[],
  layoutSeats: Set<string>,
): Map<string, Employee> {
  const next = new Map<string, Employee>();
  for (const emp of employees) {
    if (emp.bayNumber && isValidSeatId(emp.bayNumber) && layoutSeats.has(emp.bayNumber)) {
      next.set(emp.bayNumber, emp);
    }
  }
  return next;
}
