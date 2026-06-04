import type { ObjectId } from "mongodb";
import { COLLECTIONS } from "./collections";

export const EMPLOYEE_DETAILS_COLLECTION = COLLECTIONS.employeeDetails;

/**
 * Extended HR / directory fields linked to an employee row.
 * Optional: populate via admin UI or import later.
 */
export type EmployeeDetailsDocument = {
  _id: ObjectId;
  /** References `employees._id`. */
  employeeRef: ObjectId;
  workEmail?: string;
  phone?: string;
  location?: string;
  fullAddress?: string;
  currentAddress?: string;
  permanentAddress?: string;
  /** ISO date string YYYY-MM-DD */
  joinedDate?: string;
  reportsToEmployeeRef?: ObjectId;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type EmployeeDetailsDTO = {
  id: string;
  /** Hex id of linked `employees` document. */
  employeeRefId: string;
  workEmail?: string;
  phone?: string;
  location?: string;
  fullAddress?: string;
  currentAddress?: string;
  permanentAddress?: string;
  joinedDate?: string;
  reportsToEmployeeId?: string;
  notes?: string;
};

export function employeeDetailsDocToDTO(
  doc: EmployeeDetailsDocument,
): EmployeeDetailsDTO {
  return {
    id: doc._id.toHexString(),
    employeeRefId: doc.employeeRef.toHexString(),
    workEmail: doc.workEmail,
    phone: doc.phone,
    location: doc.location,
    fullAddress: doc.fullAddress,
    currentAddress: doc.currentAddress,
    permanentAddress: doc.permanentAddress,
    joinedDate: doc.joinedDate,
    reportsToEmployeeId: doc.reportsToEmployeeRef?.toHexString(),
    notes: doc.notes,
  };
}
