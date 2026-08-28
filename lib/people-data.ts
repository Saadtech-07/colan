import {
  createEmployee,
  deleteEmployee,
  getEmployeeDetailBySlugOrId,
  listEmployees,
  updateEmployee,
} from "@/lib/data-service";
import { employeeSlugFromId } from "@/lib/employee-slug";
import { listProjects } from "@/lib/data-service";
import { listTasks } from "@/lib/tasks-data";
import type { Employee, Person, PersonDetail, PersonStatus } from "@/types";

export type PersonListFilters = {
  search?: string;
  department?: string;
  role?: string;
  location?: string;
  reportingManagerId?: string;
  status?: PersonStatus;
};

export type PersonCreateInput = Omit<Employee, "id"> & {
  department?: string;
  designation?: string;
  status?: PersonStatus;
  reportingManagerId?: string;
};

export type PersonUpdateInput = Partial<PersonCreateInput>;

function normalizeStatus(value: unknown): PersonStatus {
  if (value === "On Leave" || value === "Inactive") return value;
  return "Active";
}

export function employeeToPerson(employee: Employee, managerName?: string): Person {
  return {
    ...employee,
    slug: employeeSlugFromId(employee.employeeId),
    department: employee.directory?.department?.trim() || employee.team,
    designation: employee.directory?.designation?.trim() || employee.role,
    status: normalizeStatus(employee.directory?.status),
    reportingManagerId: employee.directory?.reportsToEmployeeId,
    reportingManagerName: managerName,
  };
}

function matchesPersonFilters(person: Person, filters: PersonListFilters): boolean {
  if (filters.department && person.department !== filters.department) return false;
  if (filters.role && person.role !== filters.role) return false;
  if (filters.location && (person.directory?.location ?? "") !== filters.location) return false;
  if (filters.reportingManagerId && person.reportingManagerId !== filters.reportingManagerId) {
    return false;
  }
  if (filters.status && person.status !== filters.status) return false;
  if (filters.search?.trim()) {
    const needle = filters.search.trim().toLowerCase();
    const haystack = [
      person.name,
      person.employeeId,
      person.designation,
      person.department,
      person.directory?.workEmail,
      person.email,
      person.role,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

export async function listPeople(
  companyId: string,
  filters: PersonListFilters = {},
): Promise<Person[]> {
  const employees = await listEmployees({ companyId });
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const people = employees.map((employee) => {
    const managerId = employee.directory?.reportsToEmployeeId;
    const manager = managerId ? byId.get(managerId) : undefined;
    return employeeToPerson(employee, manager?.name);
  });
  return people
    .filter((person) => matchesPersonFilters(person, filters))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getPersonById(
  companyId: string,
  idOrSlug: string,
): Promise<PersonDetail | null> {
  const detail = await getEmployeeDetailBySlugOrId(companyId, idOrSlug);
  if (!detail) return null;

  const [employees, tasks] = await Promise.all([
    listEmployees({ companyId }),
    listTasks(),
  ]);
  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  const managerId = detail.directory?.reportsToEmployeeId;
  const manager = managerId ? byId.get(managerId) : undefined;

  const directReports = employees
    .filter((employee) => employee.directory?.reportsToEmployeeId === detail.id)
    .map((employee) => employeeToPerson(employee, detail.name));

  const personTasks = tasks.filter((task) => task.assigneeId === detail.id);
  const completed = personTasks.filter((task) => task.status === "Done").length;
  const total = personTasks.length;

  const recentActivity = personTasks.slice(0, 5).map((task) => ({
    id: task.id,
    action: `Task ${task.status}`,
    details: task.title,
    createdAt: task.updatedAt,
  }));

  const person = employeeToPerson(detail, manager?.name);

  return {
    ...person,
    assignedProjects: detail.assignedProjects,
    directReports,
    recentActivity,
    taskSummary: {
      total,
      completed,
      completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    },
  };
}

export async function createPerson(
  companyId: string,
  input: PersonCreateInput,
): Promise<Person> {
  const { department, designation, status, reportingManagerId, directory, ...employeeInput } = input;
  const created = await createEmployee(companyId, employeeInput);
  if (department || designation || status || reportingManagerId || directory) {
    return updatePerson(companyId, created.id, {
      department,
      designation,
      status,
      reportingManagerId,
      directory,
    });
  }
  return employeeToPerson(created);
}

export async function updatePerson(
  companyId: string,
  id: string,
  input: PersonUpdateInput,
): Promise<Person> {
  const { department, designation, status, reportingManagerId, directory, ...employeePatch } =
    input;
  const updated = await updateEmployee(companyId, id, {
    ...employeePatch,
    directory: {
      ...directory,
      department,
      designation,
      status,
      reportsToEmployeeId: reportingManagerId,
    },
  });
  return employeeToPerson(updated);
}

export async function deletePerson(companyId: string, id: string): Promise<boolean> {
  try {
    await deleteEmployee(id);
    return true;
  } catch {
    return false;
  }
}

export async function listProjectMembers(companyId: string, projectId: string) {
  const projects = await listProjects();
  const project = projects.find((row) => row.id === projectId);
  if (!project) return null;

  const employees = await listEmployees({ companyId });
  const tasks = await listTasks({ projectId });
  const members = employees.filter((employee) => project.memberIds.includes(employee.id));

  return members.map((employee) => {
    const person = employeeToPerson(employee);
    const memberTasks = tasks.filter((task) => task.assigneeId === employee.id);
    const completed = memberTasks.filter((task) => task.status === "Done").length;
    const total = memberTasks.length;
    const teamLead = project.teamLeadId
      ? employees.find((row) => row.id === project.teamLeadId)
      : undefined;

    return {
      ...person,
      assignedProject: { id: project.id, name: project.name, slug: project.slug },
      teamLeadName: teamLead?.name,
      seatLocation: employee.bayNumber || "Unassigned",
      currentTasks: memberTasks.slice(0, 5),
      taskTotal: total,
      completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });
}

export async function addProjectMember(projectId: string, memberId: string) {
  const projects = await listProjects();
  const project = projects.find((row) => row.id === projectId);
  if (!project) return null;
  if (project.memberIds.includes(memberId)) return project;

  const { updateProjectById } = await import("@/lib/data-service");
  return updateProjectById(projectId, {
    memberIds: [...project.memberIds, memberId],
  });
}

export async function removeProjectMember(projectId: string, memberId: string) {
  const projects = await listProjects();
  const project = projects.find((row) => row.id === projectId);
  if (!project) return null;

  const { updateProjectById } = await import("@/lib/data-service");
  return updateProjectById(projectId, {
    memberIds: project.memberIds.filter((id) => id !== memberId),
  });
}
