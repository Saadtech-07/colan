import type { ObjectId } from "mongodb";
import { COLLECTIONS } from "./collections";

export const SEATING_VERSION_COLLECTION = COLLECTIONS.seatingVersions;

export const SEATING_CHANGE_KINDS = [
  "assign-seat",
  "clear-seat",
  "move-seat",
  "swap-seats",
  "assign-cabin",
  "clear-cabin",
  "set-cabin-members",
  "swap-cabins",
] as const;

export type SeatingChangeKind = (typeof SEATING_CHANGE_KINDS)[number];

export type SeatingChangeRecord = {
  id: string;
  kind: SeatingChangeKind;
  officeSlug: string;
  summary: string;
  seatId?: string;
  fromSeatId?: string;
  toSeatId?: string;
  cabinId?: string;
  fromCabinId?: string;
  toCabinId?: string;
  fromCabinLabel?: string;
  toCabinLabel?: string;
  employeeId?: string | null;
  employeeIds?: string[];
  employeeName?: string;
  fromEmployeeName?: string;
  toEmployeeName?: string;
};

export type SeatingSnapshotPerson = {
  employeeId: string;
  name: string;
  code: string;
  team: string;
};

export type SeatingVersionSnapshot = {
  seats: Record<string, SeatingSnapshotPerson | null>;
  cabins: Record<string, SeatingSnapshotPerson[]>;
};

export type SeatingVersionActor = {
  userId: string;
  name: string;
  email: string;
};

export type SeatingVersionDocument = {
  _id: ObjectId;
  officeSlug: string;
  version: number;
  createdAt: Date;
  createdBy: SeatingVersionActor;
  changes: SeatingChangeRecord[];
  snapshot: SeatingVersionSnapshot;
};

export type SeatingVersionSummary = {
  id: string;
  officeSlug: string;
  version: number;
  createdAt: string;
  createdBy: SeatingVersionActor;
  changeCount: number;
  changes: SeatingChangeRecord[];
};

export type SeatingVersionDTO = SeatingVersionSummary & {
  snapshot: SeatingVersionSnapshot;
};
