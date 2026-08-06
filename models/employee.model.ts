import type { ObjectId } from "mongodb";
import type { CompanyRole, Employee, Gender, TeamName } from "@/types";
import { COLLECTIONS } from "./collections";

export const EMPLOYEE_COLLECTION = COLLECTIONS.employees;

/** Stored shape in MongoDB (API uses string `id` from `_id`). */
export type EmployeeDocument = {
  _id: ObjectId;
  employeeId: string;
  name: string;
  team: TeamName;
  role: CompanyRole;
  gender?: Gender;
  bayNumber: string;
  /** Office floor plan slug (chennai | pernambut | bangalore). */
  officeSlug?: string | null;
  /** Cabin assignment on that office (e.g. cabin-cfo). */
  cabinId?: string | null;
  imageUrl: string;
  email?: string;
  directory?: {
    workEmail?: string;
    personalEmail?: string;
    phone?: string;
    location?: string;
    fullAddress?: string;
    currentAddress?: string;
    permanentAddress?: string;
    joinedDate?: string;
    notes?: string;
    resumeUrl?: string;
    resumeFileName?: string;
    resumeMimeType?: string;
    resumeUploadedAt?: string;
    department?: string;
    designation?: string;
    status?: string;
    reportsToEmployeeId?: string;
  };
  createdAt?: Date;
  updatedAt?: Date;
};

export function employeeDocToDTO(doc: EmployeeDocument): Employee {
  return {
    id: doc._id.toHexString(),
    employeeId: doc.employeeId,
    name: doc.name,
    team: doc.team,
    role: doc.role,
    gender: doc.gender ?? "male",
    bayNumber: doc.bayNumber,
    officeSlug: doc.officeSlug ?? undefined,
    cabinId: doc.cabinId ?? undefined,
    imageUrl: doc.imageUrl,
    email: doc.email?.trim() || undefined,
  };
}

export function employeeInputToDocFields(
  input: Omit<Employee, "id">,
): Omit<EmployeeDocument, "_id"> {
  return {
    employeeId: input.employeeId,
    name: input.name,
    team: input.team,
    role: input.role,
    gender: input.gender ?? "male",
    bayNumber: input.bayNumber,
    officeSlug: input.officeSlug ?? null,
    cabinId: input.cabinId ?? null,
    imageUrl: input.imageUrl,
  };
}
