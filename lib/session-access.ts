import type { Session } from "next-auth";
import {
  canAssignEmployeeToBay,
  canManageProjectForTeam,
  canWriteEmployees,
  canWriteGallery,
  filterEmployeesForUser,
  filterProjectsForUser,
  hasPermission,
  normalizeAppRole,
} from "@/lib/permissions";
import type { AppRole, Employee, TeamName } from "@/types";

export type SessionAccess = {
  role: AppRole;
  team?: TeamName;
  email: string;
};

export function sessionAccess(session: Session | null): SessionAccess | null {
  if (!session?.user?.email) return null;
  return {
    role: normalizeAppRole(session.user.appRole),
    team: session.user.team,
    email: session.user.email,
  };
}

export function requirePermission(
  access: SessionAccess | null,
  permission: Parameters<typeof hasPermission>[1],
): access is SessionAccess {
  return !!access && hasPermission(access.role, permission);
}

export { filterEmployeesForUser, filterProjectsForUser };

export function assertCanCreateProject(
  access: SessionAccess,
  team: TeamName,
): string | null {
  if (!canManageProjectForTeam(access.role, team, access.team)) {
    return "You cannot create or update projects for this team.";
  }
  return null;
}

export function assertCanWriteEmployees(access: SessionAccess): string | null {
  if (!canWriteEmployees(access.role)) {
    return "Only admins can modify the employee directory.";
  }
  return null;
}

export function assertCanWriteGallery(access: SessionAccess): string | null {
  if (!canWriteGallery(access.role)) {
    return "You do not have permission to publish gallery items.";
  }
  return null;
}

export function assertCanAssignBay(
  access: SessionAccess,
  employee: Employee | undefined,
): string | null {
  if (!canAssignEmployeeToBay(access.role, employee, access.team)) {
    return "You cannot assign seating for this employee.";
  }
  return null;
}

export function assertCanModifyBay(
  access: SessionAccess,
  occupant: Employee | undefined,
): string | null {
  if (hasPermission(access.role, "seating:assign")) return null;
  if (hasPermission(access.role, "seating:assign_team")) {
    if (!occupant) return null;
    if (access.team && occupant.team === access.team) return null;
    return "You can only change seating for your team's bays.";
  }
  return "You do not have permission to assign seating.";
}
