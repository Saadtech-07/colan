import { ObjectId } from "mongodb";
import { resolveDefaultCompanyId } from "@/lib/companies";
import { listEmployees } from "@/lib/data-service";
import { getChatActorByEmail } from "@/lib/chat-data";
import { getRoleFromRegistry } from "@/lib/role-registry";
import { hasPermission, normalizeAppRole } from "@/lib/permissions";
import { isProjectManagerAppRole } from "@/lib/project-managers";
import type { AppRole, Employee, Task, TeamName } from "@/types";
import type { SessionAccess } from "@/lib/session-access";

export type TaskActor = {
  appUserId: string;
  employeeId?: string;
  name: string;
  email: string;
  appRole: AppRole;
  team?: TeamName;
  companyRole?: Employee["role"];
};

const LEAD_ROLE_HINTS = new Set(["team lead", "lead", "team-lead", "team_lead"]);

export function isLeadAppRole(roleKey: AppRole): boolean {
  const key = normalizeAppRole(roleKey).toLowerCase();
  if (LEAD_ROLE_HINTS.has(key)) return true;
  const role = getRoleFromRegistry(roleKey);
  const name = role?.name.toLowerCase() ?? "";
  return name.includes("lead") && !name.includes("co-lead");
}

export function canCreateTasks(actor: TaskActor): boolean {
  const role = normalizeAppRole(actor.appRole);
  if (role === "admin" || role === "manager") return true;
  if (isProjectManagerAppRole(role)) return true;
  if (isLeadAppRole(role)) return true;
  if (actor.companyRole === "Admin" || actor.companyRole === "Manager") return true;
  if (actor.companyRole === "Team Lead") return true;
  return hasPermission(role, "projects:manage") || hasPermission(role, "projects:manage_team");
}

export function canManageAnyTask(actor: TaskActor): boolean {
  return canCreateTasks(actor);
}

export function canEditTask(actor: TaskActor, task: Pick<Task, "assigneeId" | "createdById">): boolean {
  if (canManageAnyTask(actor)) return true;
  if (!actor.employeeId) return false;
  return task.assigneeId === actor.employeeId;
}

export function canDeleteTask(actor: TaskActor): boolean {
  return canManageAnyTask(actor);
}

export async function resolveTaskActor(email: string): Promise<TaskActor | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const chatActor = await getChatActorByEmail(normalized);
  const companyId = await resolveDefaultCompanyId();
  const employees = await listEmployees({ companyId });
  const employee = employees.find((row) => {
    const workEmail = row.directory?.workEmail?.trim().toLowerCase();
    const loginEmail = row.email?.trim().toLowerCase();
    return loginEmail === normalized || workEmail === normalized;
  });

  if (!chatActor) {
    if (!employee) return null;
    return {
      appUserId: employee.id,
      employeeId: employee.id,
      name: employee.name,
      email: normalized,
      appRole: "employee",
      team: employee.team,
      companyRole: employee.role,
    };
  }

  if (!employee) {
    const byCode = employees.find(
      (row) => chatActor.email && row.employeeId.toLowerCase() === chatActor.email.toLowerCase(),
    );
    return {
      appUserId: chatActor.id,
      employeeId: byCode?.id,
      name: chatActor.name,
      email: chatActor.email,
      appRole: chatActor.appRole,
      team: chatActor.team,
      companyRole: byCode?.role,
    };
  }

  return {
    appUserId: chatActor.id,
    employeeId: employee.id,
    name: employee.name,
    email: chatActor.email,
    appRole: chatActor.appRole,
    team: chatActor.team ?? employee.team,
    companyRole: employee.role,
  };
}

export function filterTasksForAccess(
  tasks: Task[],
  access: SessionAccess,
  actor: TaskActor | null,
  visibleProjectIds: Set<string>,
): Task[] {
  if (canManageAnyTask(actor ?? { appUserId: "", name: "", email: access.email, appRole: access.role })) {
    return tasks.filter((task) => visibleProjectIds.has(task.projectId));
  }
  const employeeId = actor?.employeeId;
  if (!employeeId) return [];
  return tasks.filter(
    (task) =>
      visibleProjectIds.has(task.projectId) &&
      (task.assigneeId === employeeId || task.createdById === employeeId),
  );
}

export async function getProjectByIdOrSlug(idOrSlug: string) {
  const { getProjectBySlug } = await import("@/lib/data-service");
  if (ObjectId.isValid(idOrSlug)) {
    const { getProjectById } = await import("@/lib/data-service");
    const byId = await getProjectById(idOrSlug);
    if (byId) return byId;
  }
  return getProjectBySlug(idOrSlug);
}
