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
  imageUrl: string;
  email?: string;
  directory?: {
    workEmail?: string;
    phone?: string;
    location?: string;
    fullAddress?: string;
    currentAddress?: string;
    permanentAddress?: string;
    joinedDate?: string;
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
    imageUrl: input.imageUrl,
  };
}
