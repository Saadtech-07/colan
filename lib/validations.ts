import { z } from "zod";
import { COMPANY_ROLES, TEAMS } from "@/lib/constants";
import type { CompanyRole, ProjectStatus, TeamName } from "@/types";

const teamEnum = TEAMS as unknown as [TeamName, ...TeamName[]];
const roleEnum = COMPANY_ROLES as unknown as [CompanyRole, ...CompanyRole[]];

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

export const projectCreateSchema = z.object({
  name: z.string().min(1),
  team: z.enum(teamEnum),
  assignedDate: z.string().min(1),
  lastDate: z.string().min(1),
  status: z.enum(projectStatuses),
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
