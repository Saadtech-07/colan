import type { ObjectId } from "mongodb";
import type { Project, ProjectStatus, TeamName } from "@/types";
import { COLLECTIONS } from "./collections";

export const PROJECT_COLLECTION = COLLECTIONS.projects;

export type ProjectDocument = {
  _id: ObjectId;
  name: string;
  team: TeamName;
  assignedDate: string;
  lastDate: string;
  status: ProjectStatus;
  createdAt?: Date;
  updatedAt?: Date;
};

export function projectDocToDTO(doc: ProjectDocument): Project {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    team: doc.team,
    assignedDate: doc.assignedDate,
    lastDate: doc.lastDate,
    status: doc.status,
  };
}
