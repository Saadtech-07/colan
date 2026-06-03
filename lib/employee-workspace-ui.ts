import { isValidSeatId } from "@/lib/seating-layout";
import { teamTabLabel } from "@/lib/team-utils";
import type { Employee, EmployeeDetail, Project } from "@/types";

export type SeatAllocationDetails = {
  building: string;
  floor: string;
  bay: string;
  seatNumber: string;
  isAssigned: boolean;
};

export type WorkspaceActivityItem = {
  id: string;
  kind: "project" | "seat" | "team" | "profile";
  title: string;
  subtitle?: string;
  timestamp?: string;
};

export type SkillCategory = {
  name: string;
  skills: string[];
};

const TEAM_SKILL_CATEGORIES: Record<string, SkillCategory[]> = {
  "React Team": [
    { name: "Frontend", skills: ["React", "TypeScript", "JavaScript"] },
    { name: "Styling", skills: ["TailwindCSS", "CSS"] },
    { name: "State & tooling", skills: ["Redux"] },
  ],
  "Next.js Team": [
    { name: "Frontend", skills: ["Next.js", "React", "TypeScript"] },
    { name: "Backend", skills: ["Node.js"] },
    { name: "Styling", skills: ["TailwindCSS"] },
  ],
  "Node Team": [
    { name: "Backend", skills: ["Node.js", "Express", "REST APIs"] },
    { name: "Languages", skills: ["TypeScript"] },
    { name: "Data", skills: ["MongoDB"] },
  ],
  "UI/UX Team": [
    { name: "Design", skills: ["Figma", "Design Systems", "Prototyping"] },
    { name: "Frontend", skills: ["CSS", "Accessibility"] },
  ],
  "Testing Team": [
    { name: "Automation", skills: ["Jest", "Playwright", "Cypress"] },
    { name: "Process", skills: ["QA Automation", "Test Planning"] },
  ],
  "DevOps Team": [
    { name: "Infrastructure", skills: ["Docker", "Kubernetes", "AWS"] },
    { name: "Delivery", skills: ["CI/CD", "Terraform"] },
  ],
  "Java Team": [
    { name: "Backend", skills: ["Java", "Spring Boot", "Microservices"] },
    { name: "Data", skills: ["SQL", "Maven"] },
  ],
  "Python Team": [
    { name: "Backend", skills: ["Python", "Django", "FastAPI"] },
    { name: "Data", skills: ["PostgreSQL", "Data Pipelines"] },
  ],
};

const FLOOR_BY_ROW: Record<string, string> = {
  A: "Floor 2",
  B: "Floor 2",
  C: "Floor 2",
  D: "Floor 1",
  E: "Floor 1",
  F: "Floor 1",
  G: "Floor 3",
};

export function departmentForTeam(team: string): string {
  const label = teamTabLabel(team).toLowerCase();
  if (/ui|ux|design/.test(label)) return "Design";
  if (/test|qa/.test(label)) return "Quality Engineering";
  if (/devops|infra/.test(label)) return "Platform Engineering";
  return "Engineering";
}

export function employmentTypeForRole(role: string): string {
  if (/intern/i.test(role)) return "Intern";
  if (/contract/i.test(role)) return "Contract";
  return "Full-time";
}

export function employmentStatusLabel(): string {
  return "Active";
}

export function parseSeatAllocation(bayNumber?: string): SeatAllocationDetails {
  const seat = bayNumber?.trim() ?? "";
  if (!seat || !isValidSeatId(seat)) {
    return {
      building: "Colan HQ",
      floor: "—",
      bay: "—",
      seatNumber: "Unassigned",
      isAssigned: false,
    };
  }

  const row = seat.charAt(0).toUpperCase();
  return {
    building: "Building A",
    floor: FLOOR_BY_ROW[row] ?? "Floor 1",
    bay: `${row}-Bay`,
    seatNumber: seat,
    isAssigned: true,
  };
}

export function yearsOfExperience(joinedDate?: string): string {
  if (!joinedDate?.trim()) return "—";
  const joined = new Date(`${joinedDate.trim()}T00:00:00`);
  if (Number.isNaN(joined.getTime())) return "—";

  const now = new Date();
  const months =
    (now.getFullYear() - joined.getFullYear()) * 12 + (now.getMonth() - joined.getMonth());
  if (months < 1) return "< 1 Year";
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${months} Month${months === 1 ? "" : "s"}`;
  if (rem === 0) return `${years} Year${years === 1 ? "" : "s"}`;
  return `${years}+ Years`;
}

export function categorizedSkillsForTeam(team: string): SkillCategory[] {
  return (
    TEAM_SKILL_CATEGORIES[team] ?? [
      { name: "Core", skills: ["Collaboration", "Agile", "Documentation"] },
      { name: "Communication", skills: ["Communication", "Stakeholder Updates"] },
    ]
  );
}

export function inferSkillsForTeam(team: string): string[] {
  return categorizedSkillsForTeam(team).flatMap((category) => category.skills);
}

export function findReportingManagerName(
  employee: Pick<Employee, "id" | "team">,
  roster: Employee[],
): string | null {
  const lead = roster.find(
    (member) =>
      member.id !== employee.id &&
      member.team === employee.team &&
      /lead|manager/i.test(member.role),
  );
  return lead?.name ?? null;
}

export function relativeAssignedLabel(assignedDate?: string): string {
  if (!assignedDate?.trim()) return "Assignment date unavailable";
  const assigned = new Date(`${assignedDate.trim()}T00:00:00`);
  if (Number.isNaN(assigned.getTime())) return "Assignment date unavailable";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((today.getTime() - assigned.getTime()) / 86_400_000);
  if (diff <= 0) return "Assigned today";
  if (diff === 1) return "Assigned 1 day ago";
  return `Assigned ${diff} days ago`;
}

export function formatWorkspaceDate(value?: string): string {
  if (!value?.trim()) return "—";
  const parsed = new Date(`${value.trim()}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value.trim();
  return parsed.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function buildWorkspaceActivity(
  employee: EmployeeDetail,
  seat: SeatAllocationDetails,
): WorkspaceActivityItem[] {
  const items: WorkspaceActivityItem[] = [];

  for (const project of employee.assignedProjects.slice(0, 4)) {
    items.push({
      id: `project-${project.id}`,
      kind: "project",
      title: `Assigned to ${project.name}`,
      subtitle: project.status,
      timestamp: project.assignedDate,
    });
  }

  if (seat.isAssigned) {
    items.push({
      id: "seat",
      kind: "seat",
      title: `Workspace seat ${seat.seatNumber}`,
      subtitle: `${seat.building} · ${seat.floor}`,
    });
  }

  if (employee.directory?.joinedDate) {
    items.push({
      id: "joined",
      kind: "team",
      title: `Joined ${employee.team}`,
      subtitle: departmentForTeam(employee.team),
      timestamp: employee.directory.joinedDate,
    });
  }

  items.push({
    id: "profile",
    kind: "profile",
    title: "Profile synced to workspace directory",
    subtitle: "Managed via App Users",
  });

  return items;
}

export function workspaceQuickStats(employee: EmployeeDetail, seat: SeatAllocationDetails) {
  const completed = employee.assignedProjects.filter((p) => p.status === "Completed").length;
  const current = employee.assignedProjects.filter((p) => p.status !== "Completed").length;

  return {
    projectsCompleted: completed,
    currentProjects: current,
    attendancePercent: null as number | null,
    workspaceAllocation: seat.isAssigned ? "Assigned" : "Unassigned",
  };
}

export function projectRoleLabel(employeeRole: string): string {
  if (/lead/i.test(employeeRole)) return "Project Lead";
  if (/manager/i.test(employeeRole)) return "Project Manager";
  return employeeRole || "Contributor";
}

export function activeAndCompletedProjects(projects: Project[]) {
  return {
    active: projects.filter((p) => p.status !== "Completed"),
    completed: projects.filter((p) => p.status === "Completed"),
  };
}
