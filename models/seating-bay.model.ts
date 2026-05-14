import type { ObjectId } from "mongodb";
import { COLLECTIONS } from "./collections";

export const SEATING_BAY_COLLECTION = COLLECTIONS.seatingBays;

/**
 * Desk / bay metadata (floor plan). Current UI still resolves occupant via
 * `EmployeeDocument.bayNumber`; you can sync or migrate to this collection later.
 */
export type SeatingBayDocument = {
  _id: ObjectId;
  bayId: string;
  label?: string;
  zone?: string;
  capacity: number;
  createdAt?: Date;
  updatedAt?: Date;
};
