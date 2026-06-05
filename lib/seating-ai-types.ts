export type SeatingAiZone = {
  id: string;
  label: string;
  seatIds: string[];
};

/** @deprecated Layout mode does not auto-assign; kept for typing compatibility. */
export type SeatingAiAssignment = {
  employeeId: string;
  employeeName: string;
  seatId: string;
  reason?: string;
};

import type { GeneratedSeatingLayout } from "@/lib/seating-layout-types";

export type SeatingAiSuggestion = {
  summary: string;
  description?: string;
  strategy: string[];
  /** Seats included in the proposed blank layout (all shown vacant for manual assignment). */
  layoutSeats: string[];
  zones: SeatingAiZone[];
  /** Coordinate-based layout from the AI generator (canvas mode). */
  layout?: GeneratedSeatingLayout;
  assignments: SeatingAiAssignment[];
  warnings: string[];
  modelUsed: string;
  /** @deprecated Image upload mode removed. */
  imageAnalysis?: string;
};

export type SeatingAiEmployeeContext = {
  id: string;
  employeeId: string;
  name: string;
  team: string;
  role: string;
  currentSeat: string | null;
};
