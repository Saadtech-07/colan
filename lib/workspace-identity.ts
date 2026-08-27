import { normalizeAppRole, roleNeedsTeam } from "@/lib/permissions";
import { isProjectManagerAppRole } from "@/lib/project-managers";
import { getRoleFromRegistry } from "@/lib/role-registry";
import type { AppRole, Employee } from "@/types";

const PORTFOLIO_ROLE_KEYS = new Set([
  "admin",
  "manager",
  "ceo",
  "cfo",
  "superadmin",
  "super-admin",
  "super_admin",
]);

const TEAM_DIRECTORY_ROLE_ALLOWLIST = [
  /^employee$/i,
  /^intern$/i,
  /^trainee$/i,
  /^team lead$/i,
  /^project lead$/i,
  /^co-?lead$/i,
  /^pc$/i,
  /^project coordinator$/i,
];

/** Squad / small roles that are never treated as executive portfolio. */
function isSquadOrContributorRoleName(roleName: string): boolean {
  const lower = roleName.trim().toLowerCase();
  if (!lower) return false;
  return (
    /project lead|team lead|co-?lead/.test(lower) ||
    /project coordinator|^pc$/.test(lower) ||
    /^(employee|intern|trainee)$/.test(lower)
  );
}

function roleNameIsPortfolio(roleName: string): boolean {
  const lower = roleName.trim().toLowerCase();
  if (!lower) return false;
  // Keep lead / PC / coordinator on the floor — never treat as executives.
  if (isSquadOrContributorRoleName(lower)) return false;
  if (/^(admin|manager|ceo|cfo|super\s*admin|superadmin)$/i.test(lower)) {
    return true;
  }
  return lower.includes("project manager");
}

/** Squad members who belong to a team. */
export function roleShowsTeamOnProfile(appRole?: AppRole | string | null): boolean {
  if (!appRole) return false;
  return roleNeedsTeam(appRole as AppRole);
}

/** Office seat on profile / create form — everyone except executives. */
export function roleEligibleForOfficeSeat(appRole?: AppRole | string | null): boolean {
  if (!appRole) return false;
  return !roleIsPortfolioLevel(appRole);
}

/** Admin, manager, project manager, CEO, CFO, and other non-squad roles. */
export function roleIsPortfolioLevel(appRole?: AppRole | string | null): boolean {
  if (!appRole) return false;
  if (roleShowsTeamOnProfile(appRole)) return false;
  const key = normalizeAppRole(appRole).toLowerCase();
  if (PORTFOLIO_ROLE_KEYS.has(key)) return true;
  if (isProjectManagerAppRole(appRole as AppRole)) return true;
  const name = getRoleFromRegistry(appRole as AppRole)?.name ?? "";
  return roleNameIsPortfolio(name);
}

export function isMeaningfulTeamName(team?: string | null): boolean {
  const value = team?.trim();
  if (!value) return false;
  return value.toLowerCase() !== "unassigned";
}

export function employeeShowsInTeamMembersDirectory(
  employee: Pick<Employee, "role">,
): boolean {
  const role = employee.role?.trim() ?? "";
  if (!role) return false;
  return TEAM_DIRECTORY_ROLE_ALLOWLIST.some((pattern) => pattern.test(role));
}

export function resolveProfileRoleLabel(
  appRole?: AppRole | string | null,
  workspaceRole?: string | null,
): string {
  if (appRole) {
    const fromRegistry = getRoleFromRegistry(appRole as AppRole)?.name;
    if (fromRegistry) return fromRegistry;
    const key = normalizeAppRole(appRole).toLowerCase();
    const labels: Record<string, string> = {
      admin: "Admin",
      manager: "Manager",
      lead: "Team Lead",
      employee: "Employee",
      intern: "Intern",
      trainee: "Trainee",
    };
    if (labels[key]) return labels[key];
  }
  const workspace = workspaceRole?.trim();
  if (workspace) return workspace;
  return "—";
}

/**
 * Whether an employee record may appear on the seating floor plan or be assigned a bay.
 * Admin can seat lead, employee, trainee, PC, and other small roles —
 * not manager, project manager, CEO, or other executives.
 */
export function employeeEligibleForSeating(employee: Pick<Employee, "role">): boolean {
  const role = employee.role?.trim() ?? "";
  if (!role) return true;
  return !roleNameIsPortfolio(role);
}

export function filterEmployeesEligibleForSeating(employees: Employee[]): Employee[] {
  return employees.filter(employeeEligibleForSeating);
}
