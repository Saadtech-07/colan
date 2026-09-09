import type { ObjectId } from "mongodb";
import { COLLECTIONS } from "./collections";

export const COMPANY_COLLECTION = COLLECTIONS.companies;

export type CompanyDocument = {
  _id: ObjectId;
  name: string;
  slug: string;
  city?: string;
  status?: "active" | "inactive";
  createdAt?: Date;
  updatedAt?: Date;
};

export type CompanyDTO = {
  id: string;
  name: string;
  slug: string;
  city?: string;
  status: "active" | "inactive";
  createdAt?: string;
  updatedAt?: string;
};

export function companyDocToDTO(doc: CompanyDocument): CompanyDTO {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    slug: doc.slug,
    city: doc.city,
    status: doc.status ?? "active",
    createdAt: doc.createdAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
  };
}
