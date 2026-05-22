import type { ObjectId } from "mongodb";
import { COLLECTIONS } from "./collections";

export const TEAM_COLLECTION = COLLECTIONS.teams;

/** Canonical project squad row in MongoDB `teams` collection. */
export type TeamDocument = {
  _id: ObjectId;
  name: string;
  slug: string;
  description?: string;
  displayOrder: number;
  accentColor?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type TeamDTO = {
  id: string;
  name: string;
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
