import { listEmployees, listProjects } from "@/lib/data-service";
import { listDailyUpdates } from "@/lib/daily-updates-data";
import type { DailyUpdate, Employee, Project } from "@/types";

export type DailyUpdateAttendanceRow = {
  employeeId: string;
  employeeName: string;
  team: string;
  role: string;
};

export type DailyUpdateSubmittedRow = DailyUpdateAttendanceRow & {
  projects: string[];
  updates: DailyUpdate[];
};

export type DailyUpdateAttendance = {
  date: string;
  submitted: DailyUpdateSubmittedRow[];
  missing: DailyUpdateAttendanceRow[];
  totalExpected: number;
};

const OVERSIGHT_ROLES = new Set(["Manager", "Admin"]);

function expectedSubmitters(employees: Employee[], projects: Project[]): Employee[] {
  const memberIds = new Set(projects.flatMap((project) => project.memberIds));
  const fromProjects =
    memberIds.size > 0 ? employees.filter((employee) => memberIds.has(employee.id)) : employees;
  return fromProjects.filter((employee) => !OVERSIGHT_ROLES.has(employee.role));
}

function matchesEmployeeSearch(employee: Employee, search?: string): boolean {
  if (!search?.trim()) return true;
  const needle = search.trim().toLowerCase();
  return (
    employee.name.toLowerCase().includes(needle) ||
    employee.employeeId.toLowerCase().includes(needle) ||
    (employee.directory?.workEmail?.toLowerCase().includes(needle) ?? false) ||
    (employee.email?.toLowerCase().includes(needle) ?? false)
  );
}

function toAttendanceRow(employee: Employee): DailyUpdateAttendanceRow {
  return {
    employeeId: employee.id,
    employeeName: employee.name,
    team: employee.team,
    role: employee.role,
  };
}

export async function getDailyUpdateAttendance(input: {
  date: string;
  search?: string;
  employees: Employee[];
  projects: Project[];
}): Promise<DailyUpdateAttendance> {
  const { date, search, employees, projects } = input;
  const roster = expectedSubmitters(employees, projects).filter((employee) =>
    matchesEmployeeSearch(employee, search),
  );

  const updates = await listDailyUpdates({ dateFrom: date, dateTo: date, search });
  const visibleProjectIds = new Set(projects.map((project) => project.id));
  const dayUpdates = updates.filter((update) => visibleProjectIds.has(update.projectId));

  const byEmployee = new Map<string, DailyUpdate[]>();
  for (const update of dayUpdates) {
    const bucket = byEmployee.get(update.employeeId) ?? [];
    bucket.push(update);
    byEmployee.set(update.employeeId, bucket);
  }

  const submitted: DailyUpdateSubmittedRow[] = [];
  const missing: DailyUpdateAttendanceRow[] = [];

  for (const employee of roster) {
    const employeeUpdates = byEmployee.get(employee.id);
    if (employeeUpdates?.length) {
      submitted.push({
        ...toAttendanceRow(employee),
        projects: [...new Set(employeeUpdates.map((update) => update.projectName ?? "Project"))],
        updates: employeeUpdates,
      });
    } else {
      missing.push(toAttendanceRow(employee));
    }
  }

  submitted.sort((a, b) => a.employeeName.localeCompare(b.employeeName));
  missing.sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  return {
    date,
    submitted,
    missing,
    totalExpected: roster.length,
  };
}
