import type { ObjectId } from "mongodb";
import type { ModulePermissionsMap } from "@/lib/rbac-modules";
import { normalizeModulePermissions, resolveLegacyAccess } from "@/lib/rbac-modules";
import { COLLECTIONS } from "./collections";

export const COMPANY_ROLE_COLLECTION = COLLECTIONS.companyRoles;

export type CompanyRoleDocument = {
  _id: ObjectId;
  /** Stable slug for app_users.appRole and session. */
  key: string;
  name: string;
  description: string;
  color: string;
  permissions: ModulePermissionsMap;
  responsibilities: string[];
  scopes: string[];
  teamScopedProjects?: boolean;
  teamScopedSeating?: boolean;
  isSystem: boolean;
  displayOrder: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type WorkspaceRole = {
  id: string;
  key: string;
  name: string;
  description: string;
  color: string;
  permissions: ModulePermissionsMap;
  responsibilities: string[];
  scopes: string[];
  teamScopedProjects: boolean;
  teamScopedSeating: boolean;
  isSystem: boolean;
  displayOrder: number;
  resolvedPermissions: string[];
};

export function companyRoleDocToDTO(
  doc: CompanyRoleDocument,
  fallbackPermissions?: ModulePermissionsMap,
): WorkspaceRole {
  const permissions = normalizeModulePermissions(
    doc.permissions ?? fallbackPermissions,
  );
  const { permissions: resolvedPermissions } = resolveLegacyAccess(permissions, {
    teamScopedProjects: doc.teamScopedProjects,
    teamScopedSeating: doc.teamScopedSeating,
  });

  return {
    id: doc._id.toHexString(),
    key: doc.key,
    name: doc.name,
    description: doc.description,
    color: doc.color,
    permissions,
    responsibilities: doc.responsibilities ?? [],
    scopes: doc.scopes ?? [],
    teamScopedProjects: !!doc.teamScopedProjects,
    teamScopedSeating: !!doc.teamScopedSeating,
    isSystem: !!doc.isSystem,
    displayOrder: doc.displayOrder ?? 0,
    resolvedPermissions,
  };
}
