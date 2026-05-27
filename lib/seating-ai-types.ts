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

export type SeatingAiSuggestion = {
  summary: string;
  strategy: string[];
  /** Seats included in the proposed blank layout (all shown vacant for manual assignment). */
  layoutSeats: string[];
  zones: SeatingAiZone[];
  assignments: SeatingAiAssignment[];
  warnings: string[];
  modelUsed: string;
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
