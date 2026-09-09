import type { ObjectId } from "mongodb";
import { COLLECTIONS } from "./collections";
import type { SeatingVersionActor } from "./seating-version.model";

export const SEATING_SEAT_HISTORY_COLLECTION = COLLECTIONS.seatingSeatHistory;

export const SEAT_HISTORY_ACTIONS = [
  "assigned",
  "removed",
  "moved-in",
  "moved-out",
  "swapped-in",
  "swapped-out",
] as const;

export type SeatHistoryAction = (typeof SEAT_HISTORY_ACTIONS)[number];

export type SeatHistoryDocument = {
  _id: ObjectId;
  companyId: ObjectId;
  officeSlug: string;
  seatId: string;
  action: SeatHistoryAction;
  employeeName: string;
  employeeId?: string;
  employeeCode?: string;
  previousSeat: string | null;
  newSeat: string | null;
  createdAt: Date;
  createdBy: SeatingVersionActor;
};

export type SeatHistoryEntry = {
  id: string;
  officeSlug: string;
  seatId: string;
  action: SeatHistoryAction;
  actionLabel: string;
  employeeName: string;
  employeeId?: string;
  employeeCode?: string;
  previousSeat: string | null;
  newSeat: string | null;
  createdAt: string;
  createdBy: SeatingVersionActor;
};
