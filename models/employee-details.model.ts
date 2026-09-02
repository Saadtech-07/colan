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
  personalEmail?: string;
  workEmail?: string;
  phone?: string;
  currentAddress?: string;
  permanentAddress?: string;
  /** @deprecated Legacy field; no longer written. */
  location?: string;
  /** @deprecated Legacy field; no longer written. */
  fullAddress?: string;
  /** ISO date string YYYY-MM-DD */
  joinedDate?: string;
  reportsToEmployeeRef?: ObjectId;
  department?: string;
  designation?: string;
  status?: string;
  notes?: string;
  resumeUrl?: string;
  resumeFileName?: string;
  resumeMimeType?: string;
  resumeUploadedAt?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type EmployeeDetailsDTO = {
  id: string;
  /** Hex id of linked `employees` document. */
  employeeRefId: string;
  personalEmail?: string;
  workEmail?: string;
  phone?: string;
  currentAddress?: string;
  permanentAddress?: string;
  joinedDate?: string;
  reportsToEmployeeId?: string;
  department?: string;
  designation?: string;
  status?: string;
  notes?: string;
  resumeUrl?: string;
  resumeFileName?: string;
  resumeMimeType?: string;
  resumeUploadedAt?: string;
};

export function employeeDetailsDocToDTO(
  doc: EmployeeDetailsDocument,
): EmployeeDetailsDTO {
  return {
    id: doc._id.toHexString(),
    employeeRefId: doc.employeeRef.toHexString(),
    personalEmail: doc.personalEmail,
    workEmail: doc.workEmail,
    phone: doc.phone,
    currentAddress: doc.currentAddress,
    permanentAddress: doc.permanentAddress,
    joinedDate: doc.joinedDate,
    reportsToEmployeeId: doc.reportsToEmployeeRef?.toHexString(),
    department: doc.department,
    designation: doc.designation,
    status: doc.status,
    notes: doc.notes,
    resumeUrl: doc.resumeUrl,
    resumeFileName: doc.resumeFileName,
    resumeMimeType: doc.resumeMimeType,
    resumeUploadedAt: doc.resumeUploadedAt,
  };
}
