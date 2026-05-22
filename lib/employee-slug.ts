import type { Employee } from "@/types";

/** URL slug from employee ID, e.g. `COL-1001` → `col-1001`. */
export function employeeSlugFromId(employeeId: string): string {
  return employeeId
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function employeeProfilePath(employee: Pick<Employee, "employeeId">): string {
  return `/team-members/${employeeSlugFromId(employee.employeeId)}`;
}

export function findEmployeeBySlugOrId(
  employees: Employee[],
  slugOrId: string,
): Employee | undefined {
  const key = slugOrId.toLowerCase().trim();
  return (
    employees.find((e) => employeeSlugFromId(e.employeeId) === key) ??
    employees.find((e) => e.id === slugOrId)
  );
}
