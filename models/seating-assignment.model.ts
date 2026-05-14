import type { ObjectId } from "mongodb";
import { COLLECTIONS } from "./collections";

export const SEATING_ASSIGNMENT_COLLECTION = COLLECTIONS.seatingAssignments;

/**
 * Optional assignment history or parallel mapping: bay ↔ employee.
 * Fields suit audit trails (`unassignedAt`) or current slot (`employeeRef` only).
 */
export type SeatingAssignmentDocument = {
  _id: ObjectId;
  bayId: string;
  employeeRef: ObjectId | null;
  assignedAt: Date;
  unassignedAt?: Date;
  createdByAppUserRef?: ObjectId;
};
