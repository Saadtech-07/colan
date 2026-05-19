import { z } from "zod";
import { COMPANY_ROLES, TEAMS } from "@/lib/constants";
import type { AppRole, CompanyRole, ProjectStatus, TeamName } from "@/types";

const teamEnum = TEAMS as unknown as [TeamName, ...TeamName[]];
const roleEnum = COMPANY_ROLES as unknown as [CompanyRole, ...CompanyRole[]];
const appRoleEnum = ["admin", "manager", "lead", "employee"] as const;

const projectStatuses: [ProjectStatus, ...ProjectStatus[]] = [
  "Yet To Start",
  "In Progress",
  "Completed",
];

export const employeeCreateSchema = z.object({
  employeeId: z.string().min(1),
  name: z.string().min(1),
  team: z.enum(teamEnum),
  role: z.enum(roleEnum),
  bayNumber: z.string().min(1),
  imageUrl: z.string().min(1),
});

export const appUserCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  appRole: z.enum(appRoleEnum),
  team: z.enum(teamEnum).optional(),
  imageUrl: z.string().url().optional(),
});

export const appUserUpdateSchema = z.object({
  password: z.string().min(6).optional(),
  name: z.string().min(1).optional(),
  appRole: z.enum(appRoleEnum).optional(),
  team: z.enum(teamEnum).optional(),
  imageUrl: z.union([z.string().url(), z.literal("")]).optional(),
});

export const projectCreateSchema = z.object({
  name: z.string().min(1),
  team: z.enum(teamEnum),
  assignedDate: z.string().min(1),
  lastDate: z.string().min(1),
  status: z.enum(projectStatuses),
  description: z.string().optional(),
  memberIds: z.array(z.string()).optional(),
});

export const projectUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  team: z.enum(teamEnum).optional(),
  assignedDate: z.string().min(1).optional(),
  lastDate: z.string().min(1).optional(),
  status: z.enum(projectStatuses).optional(),
  description: z.string().optional(),
  memberIds: z.array(z.string()).optional(),
});

export const galleryCreateSchema = z.object({
  title: z.string().min(1),
  url: z.string().min(1),
  caption: z.string().optional(),
  uploadedAt: z.string().min(1),
});

export const bayAssignSchema = z.object({
  bayId: z.string().min(1),
  employeeId: z.string().min(1).nullable(),
});

export const employeeUpdateSchema = z.object({
  employeeId: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  team: z.enum(teamEnum).optional(),
  role: z.enum(roleEnum).optional(),
  // Empty string means unassigned (see seating / team-members UI).
  bayNumber: z.string().optional(),
  imageUrl: z.string().optional(),
});

export const employeeProjectsUpdateSchema = z.object({
  projectIds: z.array(z.string().min(1)),
});
