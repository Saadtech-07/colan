import type { AppUserPublicDTO } from "@/models/app-user.model";
import type { Employee } from "@/types";

export function appUserEditHref(employeeId: string): string {
  const id = employeeId.trim();
  if (!id) return "/app-users";
  return `/app-users?employeeId=${encodeURIComponent(id)}`;
}

export function resolveAppUserForEmployee(
  users: AppUserPublicDTO[],
  employee: Pick<Employee, "employeeId" | "email" | "directory">,
): AppUserPublicDTO | undefined {
  const employeeIdLower = employee.employeeId.trim().toLowerCase();
  const loginEmail = employee.email?.trim().toLowerCase();
  const workEmail = employee.directory?.workEmail?.trim().toLowerCase();

  return users.find((user) => {
    if (user.employeeId?.trim().toLowerCase() === employeeIdLower) return true;
    const userEmail = user.email.toLowerCase();
    if (loginEmail && userEmail === loginEmail) return true;
    if (workEmail && userEmail === workEmail) return true;
    if (user.workEmail?.trim().toLowerCase() === workEmail) return true;
    return false;
  });
}

export function resolveAppUserFromQuery(
  users: AppUserPublicDTO[],
  employees: Employee[],
  params: { editId?: string | null; employeeId?: string | null },
): AppUserPublicDTO | undefined {
  const { editId, employeeId } = params;

  if (editId) {
    const byId = users.find((user) => user.id === editId);
    if (byId) return byId;
  }

  if (!employeeId?.trim()) return undefined;

  const employeeIdLower = employeeId.trim().toLowerCase();
  const byEmployeeId = users.find(
    (user) => user.employeeId?.trim().toLowerCase() === employeeIdLower,
  );
  if (byEmployeeId) return byEmployeeId;

  const employee = employees.find(
    (member) => member.employeeId.trim().toLowerCase() === employeeIdLower,
  );
  if (employee) {
    return resolveAppUserForEmployee(users, employee);
  }

  return undefined;
}
