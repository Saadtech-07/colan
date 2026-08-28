import type { ObjectId } from "mongodb";
import type { SeatingCabin } from "@/lib/seating-cabins";
import type { SeatingRowConfig } from "@/lib/seating-layout";
import { COLLECTIONS } from "./collections";

export const FLOOR_PLAN_COLLECTION = COLLECTIONS.floorPlans;

export type FloorPlanSlug =
  | "chennai"
  | "chennai-block-b"
  | "pernambut"
  | "bangalore"
  | string;

export type FloorPlanDocument = {
  _id: ObjectId;
  companyId: ObjectId;
  slug: FloorPlanSlug;
  name: string;
  city?: string;
  building?: string;
  floors?: Array<{ key: string; label: string }>;
  rows: SeatingRowConfig[];
  seatIds: string[];
  cabins?: {
    beforeA: SeatingCabin[];
    afterG: SeatingCabin[];
    sideCabins?: {
      hrManager: string;
      manager: string;
      hrManagerId?: string;
      managerId?: string;
      spans?: { hrManager?: number; manager?: number };
      equalHeights?: boolean;
    };
    /** Compact entrance rendered outside seating bays (e.g. Bangalore). */
    outsideEntrance?: { text: string };
  };
  isActive: boolean;
  sortOrder?: number;
  source?: "excel" | "manual" | "ai" | "seed";
  createdAt?: Date;
  updatedAt?: Date;
};

export type FloorPlanSummary = {
  slug: string;
  name: string;
  city?: string;
  building?: string;
  isActive: boolean;
  sortOrder?: number;
  seatCount: number;
};

export type FloorPlanDTO = {
  slug: string;
  name: string;
  city?: string;
  building?: string;
  floors?: Array<{ key: string; label: string }>;
  rows: SeatingRowConfig[];
  seatIds: string[];
  cabins?: FloorPlanDocument["cabins"];
  isActive: boolean;
  sortOrder?: number;
  source?: FloorPlanDocument["source"];
};

export function floorPlanDocToDTO(doc: FloorPlanDocument): FloorPlanDTO {
  return {
    slug: doc.slug,
    name: doc.name,
    city: doc.city,
    building: doc.building,
    floors: doc.floors,
    rows: doc.rows,
    seatIds: doc.seatIds,
    cabins: doc.cabins,
    isActive: doc.isActive,
    sortOrder: doc.sortOrder,
    source: doc.source,
  };
}

export function floorPlanDocToSummary(doc: FloorPlanDocument): FloorPlanSummary {
  return {
    slug: doc.slug,
    name: doc.name,
    city: doc.city,
    building: doc.building,
    isActive: doc.isActive,
    sortOrder: doc.sortOrder,
    seatCount: doc.seatIds?.length ?? 0,
  };
}
