import type { ObjectId } from "mongodb";
import { COLLECTIONS } from "./collections";

export const COMPANY_COLLECTION = COLLECTIONS.companies;

export type CompanyDocument = {
  _id: ObjectId;
  name: string;
  slug: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type CompanyDTO = {
  id: string;
  name: string;
  slug: string;
  createdAt?: string;
};

export function companyDocToDTO(doc: CompanyDocument): CompanyDTO {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    slug: doc.slug,
    createdAt: doc.createdAt?.toISOString(),
  };
}
