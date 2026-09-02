import type { ObjectId } from "mongodb";
import type { FloorPlanElement, FloorPlanGrid } from "@/lib/floor-plan-builder/types";
import { COLLECTIONS } from "./collections";

export const FLOOR_PLAN_LAYOUT_COLLECTION = COLLECTIONS.floorPlanLayouts;

export type FloorPlanLayoutDocument = {
  _id: ObjectId;
  companyId: ObjectId;
  floorPlanSlug: string;
  name: string;
  status: "draft" | "published";
  version: number;
  grid: FloorPlanGrid;
  elements: FloorPlanElement[];
  seatIds: string[];
  mergeGroups?: Array<{ id: string; seatIds: string[] }>;
  publishedAt?: Date;
  publishedBy?: { userId: string; name: string; email: string };
  createdAt?: Date;
  updatedAt?: Date;
};

export type FloorPlanLayoutDTO = {
  id: string;
  floorPlanSlug: string;
  name: string;
  status: "draft" | "published";
  version: number;
  grid: FloorPlanGrid;
  elements: FloorPlanElement[];
  seatIds: string[];
  mergeGroups?: Array<{ id: string; seatIds: string[] }>;
  publishedAt?: string;
  updatedAt?: string;
};

export function floorPlanLayoutDocToDTO(doc: FloorPlanLayoutDocument): FloorPlanLayoutDTO {
  return {
    id: doc._id.toHexString(),
    floorPlanSlug: doc.floorPlanSlug,
    name: doc.name,
    status: doc.status,
    version: doc.version,
    grid: doc.grid,
    elements: doc.elements,
    seatIds: doc.seatIds ?? [],
    mergeGroups: doc.mergeGroups,
    publishedAt: doc.publishedAt?.toISOString(),
    updatedAt: doc.updatedAt?.toISOString(),
  };
}
