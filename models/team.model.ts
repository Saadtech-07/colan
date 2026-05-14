import type { ObjectId } from "mongodb";
import type { TeamName } from "@/types";
import { COLLECTIONS } from "./collections";

export const TEAM_COLLECTION = COLLECTIONS.teams;

/**
 * Canonical team row (for DB-driven team lists, colors, ordering).
 * App enums still use `TeamName`; this collection can mirror those names.
 */
export type TeamDocument = {
  _id: ObjectId;
  name: TeamName;
  slug: string;
  description?: string;
  displayOrder: number;
  accentColor?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TeamDTO = {
  id: string;
  name: TeamName;
  slug: string;
  description?: string;
  displayOrder: number;
  accentColor?: string;
};

export function teamDocToDTO(doc: TeamDocument): TeamDTO {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    slug: doc.slug,
    description: doc.description,
    displayOrder: doc.displayOrder,
    accentColor: doc.accentColor,
  };
}
