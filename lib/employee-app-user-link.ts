import type { AppUserDocument, EmployeeDetailsDocument, EmployeeDocument } from "@/models";
import type { Employee } from "@/types";

function normalizeEmail(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function employeeEmails(
  employee: Pick<EmployeeDocument, "email" | "directory">,
  detail?: EmployeeDetailsDocument | null,
): Set<string> {
  const emails = new Set<string>();
  for (const value of [
    employee.email,
    employee.directory?.workEmail,
    employee.directory?.personalEmail,
    detail?.workEmail,
  ]) {
    const normalized = normalizeEmail(value);
    if (normalized) emails.add(normalized);
  }
  return emails;
}

export function employeeDocMatchesAppUser(
  employee: Pick<EmployeeDocument, "email" | "employeeId" | "directory">,
  appUser: AppUserDocument,
  detail?: EmployeeDetailsDocument | null,
): boolean {
  const userEmail = normalizeEmail(appUser.email);
  if (userEmail && employeeEmails(employee, detail).has(userEmail)) {
    return true;
  }

  const userEmployeeId = appUser.employeeId?.trim();
  const employeeId = employee.employeeId?.trim();
  return Boolean(userEmployeeId && employeeId && userEmployeeId === employeeId);
}

export function employeeDtoMatchesAppUser(
  employee: Pick<Employee, "email" | "employeeId" | "directory">,
  appUser: AppUserDocument,
): boolean {
  const userEmail = normalizeEmail(appUser.email);
  const emails = new Set<string>();
  for (const value of [
    employee.email,
    employee.directory?.workEmail,
    employee.directory?.personalEmail,
  ]) {
    const normalized = normalizeEmail(value);
    if (normalized) emails.add(normalized);
  }
  if (userEmail && emails.has(userEmail)) return true;

  const userEmployeeId = appUser.employeeId?.trim();
  const employeeId = employee.employeeId?.trim();
  return Boolean(userEmployeeId && employeeId && userEmployeeId === employeeId);
}

export function collectLinkedEmployeeIds(
  employees: EmployeeDocument[],
  appUsers: AppUserDocument[],
  detailsByRef: Map<string, EmployeeDetailsDocument>,
): Set<string> {
  const linked = new Set<string>();
  for (const employee of employees) {
    const detail = detailsByRef.get(employee._id.toHexString());
    for (const appUser of appUsers) {
      if (employeeDocMatchesAppUser(employee, appUser, detail)) {
        linked.add(employee._id.toHexString());
        break;
      }
    }
  }
  return linked;
}

export function filterEmployeesLinkedToAppUsers<T extends Employee>(
  employees: T[],
  appUsers: AppUserDocument[],
): T[] {
  if (appUsers.length === 0) return [];
  return employees.filter((employee) =>
    appUsers.some((appUser) => employeeDtoMatchesAppUser(employee, appUser)),
  );
}
