import { isValidSeatId } from "@/lib/seating-layout";

export type SeatAllocationDetails = {
  building: string;
  floor: string;
  bay: string;
  seatNumber: string;
  isAssigned: boolean;
};

const FLOOR_BY_ROW: Record<string, string> = {
  A: "Floor 2",
  B: "Floor 2",
  C: "Floor 2",
  D: "Floor 1",
  E: "Floor 1",
  F: "Floor 1",
  G: "Floor 3",
};

export function parseSeatAllocation(bayNumber?: string): SeatAllocationDetails {
  const seat = bayNumber?.trim() ?? "";
  if (!seat || !isValidSeatId(seat)) {
    return {
      building: "Colan HQ",
      floor: "—",
      bay: "—",
      seatNumber: "Unassigned",
      isAssigned: false,
    };
  }

  const row = seat.charAt(0).toUpperCase();
  return {
    building: "Building A",
    floor: FLOOR_BY_ROW[row] ?? "Floor 1",
    bay: `${row}-Bay`,
    seatNumber: seat,
    isAssigned: true,
  };
}

export function formatWorkspaceDate(value?: string): string {
  if (!value?.trim()) return "—";
  const parsed = new Date(`${value.trim()}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value.trim();
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
