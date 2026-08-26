import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { allowInMemoryFallback } from "@/lib/data-backend";
import { ensureColanModelIndexes } from "@/models/indexes";
import { COLLECTIONS } from "@/models/collections";
import {
  assignEmployeeToBay,
  assignEmployeeToCabin,
  listEmployees,
  setCabinEmployees,
  swapEmployeesBetweenBays,
} from "@/lib/data-service";
import { getFloorPlanBySlug, swapFloorPlanCabins } from "@/lib/floor-plans";
import { normalizeOfficeSlug } from "@/lib/floor-plan-layouts";
import { snapshotFromPlan } from "@/lib/seating-draft";
import type { SeatingPendingChange } from "@/lib/seating-draft";
import type {
  SeatingVersionActor,
  SeatingVersionDocument,
  SeatingVersionDTO,
  SeatingVersionSummary,
} from "@/models/seating-version.model";
import type { Employee } from "@/types";

type MemoryVersion = Omit<SeatingVersionDocument, "_id"> & { id: string };

const memoryVersions: MemoryVersion[] = [];

function toSummary(doc: SeatingVersionDocument): SeatingVersionSummary {
  return {
    id: String(doc._id),
    officeSlug: doc.officeSlug,
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
    createdBy: doc.createdBy,
    changeCount: doc.changes.length,
    changes: doc.changes,
  };
}

function toDto(doc: SeatingVersionDocument): SeatingVersionDTO {
  return {
    ...toSummary(doc),
    snapshot: doc.snapshot,
  };
}

function memoryToDoc(row: MemoryVersion): SeatingVersionDocument {
  return {
    _id: new ObjectId(row.id.padEnd(24, "0").slice(0, 24)),
    officeSlug: row.officeSlug,
    version: row.version,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    changes: row.changes,
    snapshot: row.snapshot,
  };
}

async function nextVersionNumber(officeSlug: string): Promise<number> {
  const office = normalizeOfficeSlug(officeSlug);
  const db = await getDb();
  if (!db) {
    const latest = memoryVersions
      .filter((row) => row.officeSlug === office)
      .reduce((max, row) => Math.max(max, row.version), 0);
    return latest + 1;
  }
  await ensureColanModelIndexes(db);
  const latest = await db
    .collection<SeatingVersionDocument>(COLLECTIONS.seatingVersions)
    .find({ officeSlug: office })
    .sort({ version: -1 })
    .limit(1)
    .next();
  return (latest?.version ?? 0) + 1;
}

export async function listSeatingVersions(officeSlug: string): Promise<SeatingVersionSummary[]> {
  const office = normalizeOfficeSlug(officeSlug);
  const db = await getDb();
  if (!db) {
    if (!allowInMemoryFallback()) {
      throw new Error("MongoDB is not available.");
    }
    return memoryVersions
      .filter((row) => row.officeSlug === office)
      .sort((a, b) => b.version - a.version)
      .map((row) => toSummary(memoryToDoc(row)));
  }
  await ensureColanModelIndexes(db);
  const rows = await db
    .collection<SeatingVersionDocument>(COLLECTIONS.seatingVersions)
    .find({ officeSlug: office })
    .sort({ version: -1, createdAt: -1 })
    .limit(50)
    .toArray();
  return rows.map(toSummary);
}

export async function getSeatingVersion(id: string): Promise<SeatingVersionDTO | null> {
  const db = await getDb();
  if (!db) {
    if (!allowInMemoryFallback()) {
      throw new Error("MongoDB is not available.");
    }
    const row = memoryVersions.find((item) => item.id === id);
    return row ? toDto(memoryToDoc(row)) : null;
  }
  if (!ObjectId.isValid(id)) return null;
  await ensureColanModelIndexes(db);
  const doc = await db
    .collection<SeatingVersionDocument>(COLLECTIONS.seatingVersions)
    .findOne({ _id: new ObjectId(id) });
  return doc ? toDto(doc) : null;
}

async function applyChangeOnServer(change: SeatingPendingChange): Promise<void> {
  switch (change.kind) {
    case "assign-seat":
    case "clear-seat":
      if (!change.seatId) throw new Error("Seat id is required.");
      await assignEmployeeToBay(change.seatId, change.employeeId ?? null, change.officeSlug);
      return;
    case "move-seat":
      if (!change.toSeatId) throw new Error("Destination seat is required.");
      await assignEmployeeToBay(change.toSeatId, change.employeeId ?? null, change.officeSlug);
      return;
    case "swap-seats":
      if (!change.fromSeatId || !change.toSeatId) {
        throw new Error("Both seats are required to swap.");
      }
      await swapEmployeesBetweenBays(change.fromSeatId, change.toSeatId, change.officeSlug);
      return;
    case "assign-cabin":
    case "clear-cabin":
      if (!change.cabinId) throw new Error("Cabin id is required.");
      await assignEmployeeToCabin(change.cabinId, change.employeeId ?? null, change.officeSlug);
      return;
    case "set-cabin-members":
      if (!change.cabinId) throw new Error("Cabin id is required.");
      await setCabinEmployees(change.cabinId, change.employeeIds ?? [], change.officeSlug);
      return;
    case "swap-cabins":
      if (!change.fromCabinId || !change.toCabinId) {
        throw new Error("Both cabins are required to swap.");
      }
      await swapFloorPlanCabins(change.officeSlug, change.fromCabinId, change.toCabinId);
      return;
    default:
      throw new Error("Unknown seating change.");
  }
}

async function insertVersion(doc: Omit<SeatingVersionDocument, "_id">): Promise<SeatingVersionDTO> {
  const db = await getDb();
  if (!db) {
    if (!allowInMemoryFallback()) {
      throw new Error("MongoDB is not available.");
    }
    const id = new ObjectId().toHexString();
    memoryVersions.unshift({ ...doc, id });
    return toDto(memoryToDoc({ ...doc, id }));
  }
  await ensureColanModelIndexes(db);
  const result = await db
    .collection<SeatingVersionDocument>(COLLECTIONS.seatingVersions)
    .insertOne({ ...doc, _id: new ObjectId() } as SeatingVersionDocument);
  return toDto({ ...doc, _id: result.insertedId });
}

export async function saveSeatingVersion(input: {
  officeSlug: string;
  changes: SeatingPendingChange[];
  actor: SeatingVersionActor;
}): Promise<{ versions: SeatingVersionDTO[]; employees: Employee[] }> {
  const changes = input.changes.filter((change) => change.kind && change.officeSlug);
  if (changes.length === 0) {
    throw new Error("No seating changes to save.");
  }

  for (const change of changes) {
    await applyChangeOnServer(change);
  }

  let employees = await listEmployees();
  const offices = [...new Set(changes.map((change) => normalizeOfficeSlug(change.officeSlug)))];
  const versions: SeatingVersionDTO[] = [];

  for (const office of offices) {
    const plan = await getFloorPlanBySlug(office);
    if (!plan) continue;
    const officeChanges = changes.filter(
      (change) => normalizeOfficeSlug(change.officeSlug) === office,
    );
    const snapshot = snapshotFromPlan(employees, plan);
    const version = await nextVersionNumber(office);
    versions.push(
      await insertVersion({
        officeSlug: office,
        version,
        createdAt: new Date(),
        createdBy: input.actor,
        changes: officeChanges,
        snapshot,
      }),
    );
  }

  employees = await listEmployees();
  return { versions, employees };
}
