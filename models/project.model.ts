import type { ObjectId } from "mongodb";
import { normalizeProjectTeams } from "@/lib/project-teams";
import type { Project, ProjectStatus, TeamName } from "@/types";
import { COLLECTIONS } from "./collections";

export const PROJECT_COLLECTION = COLLECTIONS.projects;

export type ProjectDocument = {
  _id: ObjectId;
  slug: string;
  name: string;
  clientName?: string;
  projectManagerId?: string;
  teamLeadId?: string;
  /** @deprecated Legacy single team; prefer `teams`. */
  team?: TeamName;
  teams?: TeamName[];
  assignedDate: string;
  lastDate: string;
  status: ProjectStatus;
  description?: string;
  memberIds: string[];
  totalTasks?: number;
  completedTasks?: number;
  progressPercentage?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

const PROJECT_STATUS_ALIASES: Record<string, ProjectStatus> = {
  "yet to start": "Yet To Start",
  "yet-to-start": "Yet To Start",
  "in progress": "In Progress",
  completed: "Completed",
};

export function normalizeProjectStatus(raw: unknown): ProjectStatus {
  if (typeof raw !== "string" || !raw.trim()) return "Yet To Start";
  const key = raw.trim().toLowerCase();
  if (PROJECT_STATUS_ALIASES[key]) return PROJECT_STATUS_ALIASES[key];
  const titled = raw.trim() as ProjectStatus;
  if (titled === "Yet To Start" || titled === "In Progress" || titled === "Completed") {
    return titled;
  }
  return "Yet To Start";
}

export function projectDocToDTO(doc: ProjectDocument): Project {
  const slug =
    doc.slug && doc.slug.length > 0
      ? doc.slug
      : doc.name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "project";
  const totalTasks = doc.totalTasks ?? 0;
  const completedTasks = doc.completedTasks ?? 0;
  const progressPercentage =
    doc.progressPercentage ??
    (totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : undefined);

  return {
    id: doc._id.toHexString(),
    slug,
    name: doc.name,
    clientName: doc.clientName ?? "",
    projectManagerId: doc.projectManagerId ?? "",
    teamLeadId: doc.teamLeadId ?? "",
    teams: normalizeProjectTeams(doc),
    assignedDate: doc.assignedDate,
    lastDate: doc.lastDate,
    status: normalizeProjectStatus(doc.status),
    description: doc.description ?? "",
    memberIds: doc.memberIds ?? [],
    totalTasks,
    completedTasks,
    progressPercentage,
  };
}
