import type { ObjectId } from "mongodb";
import { normalizeProjectTeams } from "@/lib/project-teams";
import type { Project, ProjectStatus, TeamName } from "@/types";
import { COLLECTIONS } from "./collections";

export const PROJECT_COLLECTION = COLLECTIONS.projects;

export type ProjectDocument = {
  _id: ObjectId;
  slug: string;
  name: string;
  /** @deprecated Legacy single team; prefer `teams`. */
  team?: TeamName;
  teams?: TeamName[];
  assignedDate: string;
  lastDate: string;
  status: ProjectStatus;
  description?: string;
  memberIds: string[];
  createdAt?: Date;
  updatedAt?: Date;
};

export function projectDocToDTO(doc: ProjectDocument): Project {
  const slug =
    doc.slug && doc.slug.length > 0
      ? doc.slug
      : doc.name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "") || "project";
  return {
    id: doc._id.toHexString(),
    slug,
    name: doc.name,
    teams: normalizeProjectTeams(doc),
    assignedDate: doc.assignedDate,
    lastDate: doc.lastDate,
    status: doc.status,
    description: doc.description,
    memberIds: doc.memberIds ?? [],
  };
}
