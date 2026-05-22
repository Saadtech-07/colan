import type { ModulePermissionsMap } from "@/lib/rbac-modules";
import { normalizeModulePermissions } from "@/lib/rbac-modules";

export type SystemRoleSeed = {
  key: string;
  name: string;
  description: string;
  color: string;
  responsibilities: string[];
  scopes: string[];
  permissions: ModulePermissionsMap;
  teamScopedProjects?: boolean;
  teamScopedSeating?: boolean;
  displayOrder: number;
};

export const SYSTEM_ROLE_SEEDS: SystemRoleSeed[] = [
  {
    key: "admin",
    name: "Admin",
    description:
      "Full workspace control — employees, projects, seating, gallery, and access policies.",
    color: "#2563eb",
    responsibilities: [
      "Manage the employee directory and org-wide settings",
      "Create and oversee all team projects and gallery content",
      "Assign seating across the full floor plan",
      "Define access policies for all workspace roles",
    ],
    scopes: ["All modules", "User administration", "Org settings", "Full project portfolio"],
    permissions: normalizeModulePermissions({
      dashboard: { view: true, manage: true },
      projects: { view: true, manage: true },
      teamMembers: { view: true, manage: true },
      seating: { view: true, manage: true },
      gallery: { view: true, manage: true },
      roles: { view: true, manage: true },
      appUsers: { view: true, manage: true },
    }),
    displayOrder: 0,
  },
  {
    key: "manager",
    name: "Manager",
    description:
      "Operational oversight across teams with approval workflows and reporting.",
    color: "#7c3aed",
    responsibilities: [
      "Review and approve project timelines across teams",
      "Create and update projects for any squad",
      "Monitor delivery health and team workload",
      "Publish gallery updates for company-wide visibility",
    ],
    scopes: ["All team projects", "Cross-team reporting", "Gallery publishing"],
    permissions: normalizeModulePermissions({
      dashboard: { view: true, manage: true },
      projects: { view: true, manage: true },
      teamMembers: { view: true, manage: false },
      seating: { view: true, manage: false },
      gallery: { view: true, manage: true },
      roles: { view: true, manage: false },
      appUsers: { view: false, manage: false },
    }),
    displayOrder: 1,
  },
  {
    key: "lead",
    name: "Project Lead",
    description:
      "Leads delivery for a squad — prioritization, standups, and unblockers.",
    color: "#0891b2",
    responsibilities: [
      "Own the squad backlog and sprint priorities",
      "Create and update projects for your assigned team",
      "Assign seating for members on your team",
      "Keep the team directory accurate for your squad",
    ],
    scopes: ["Team backlog", "Squad assignments", "Team seating"],
    permissions: normalizeModulePermissions({
      dashboard: { view: true, manage: false },
      projects: { view: true, manage: true },
      teamMembers: { view: true, manage: false },
      seating: { view: true, manage: true },
      gallery: { view: true, manage: false },
      roles: { view: true, manage: false },
      appUsers: { view: false, manage: false },
    }),
    teamScopedProjects: true,
    teamScopedSeating: true,
    displayOrder: 2,
  },
  {
    key: "employee",
    name: "Employee",
    description:
      "Contributing member with read access to assigned team projects and workspace updates.",
    color: "#64748b",
    responsibilities: [
      "Execute work on assigned team projects",
      "Stay current on team announcements and gallery posts",
      "View squad roster and seating for your team",
    ],
    scopes: ["Assigned team projects", "Team directory (read-only)", "Gallery"],
    permissions: normalizeModulePermissions({
      dashboard: { view: true, manage: false },
      projects: { view: true, manage: false },
      teamMembers: { view: true, manage: false },
      seating: { view: true, manage: false },
      gallery: { view: true, manage: false },
      roles: { view: true, manage: false },
      appUsers: { view: false, manage: false },
    }),
    teamScopedProjects: true,
    displayOrder: 3,
  },
];
