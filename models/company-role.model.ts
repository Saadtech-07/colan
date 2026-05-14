import type { ObjectId } from "mongodb";
import type { CompanyRole } from "@/types";
import { COLLECTIONS } from "./collections";

export const COMPANY_ROLE_COLLECTION = COLLECTIONS.companyRoles;

/**
 * Company directory role catalog (Manager, Team Lead, …) for RBAC / UI.
 * Distinct from `AppUserDocument.appRole` (admin | employee gate).
 */
export type CompanyRoleDocument = {
  _id: ObjectId;
  key: CompanyRole;
  description: string;
  /** High-level permission labels for future API guards. */
  scopes: string[];
  displayOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type CompanyRoleDTO = {
  id: string;
  key: CompanyRole;
  description: string;
  scopes: string[];
  displayOrder: number;
};

export function companyRoleDocToDTO(doc: CompanyRoleDocument): CompanyRoleDTO {
  return {
    id: doc._id.toHexString(),
    key: doc.key,
    description: doc.description,
    scopes: doc.scopes,
    displayOrder: doc.displayOrder,
  };
}
