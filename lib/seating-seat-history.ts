import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { allowInMemoryFallback } from "@/lib/data-backend";
import { ensureColanModelIndexes } from "@/models/indexes";
import { COLLECTIONS } from "@/models/collections";
import { normalizeOfficeSlug } from "@/lib/floor-plan-layouts";
import { applySeatingChange, type SeatingPendingChange } from "@/lib/seating-draft";
import type { SeatingVersionActor } from "@/models/seating-version.model";
import type {
  SeatHistoryAction,
  SeatHistoryDocument,
  SeatHistoryEntry,
} from "@/models/seating-seat-history.model";
import type { Employee } from "@/types";

type MemoryHistory = Omit<SeatHistoryDocument, "_id"> & { id: string };

const memoryHistory: MemoryHistory[] = [];

const ACTION_LABELS: Record<SeatHistoryAction, (entry: Pick<SeatHistoryEntry, "previousSeat" | "newSeat">) => string> = {
  assigned: () => "Assigned to this seat",
  removed: () => "Removed from this seat",
  "moved-in": (entry) =>
    entry.previousSeat ? `Moved here from ${entry.previousSeat}` : "Moved to this seat",
  "moved-out": (entry) =>
    entry.newSeat ? `Moved to ${entry.newSeat}` : "Moved away from this seat",
  "swapped-in": (entry) =>
    entry.previousSeat ? `Swapped in from ${entry.previousSeat}` : "Swapped into this seat",
  "swapped-out": (entry) =>
    entry.newSeat ? `Swapped to ${entry.newSeat}` : "Swapped away from this seat",
};

function matchesOffice(employee: Employee, officeSlug: string) {
  return normalizeOfficeSlug(employee.officeSlug) === normalizeOfficeSlug(officeSlug);
}

function occupantOnSeat(
  employees: Employee[],
  officeSlug: string,
  seatId: string,
): Employee | undefined {
  return employees.find(
    (employee) => employee.bayNumber === seatId && matchesOffice(employee, officeSlug),
  );
}

function locationLabel(employee: Employee): string | null {
  const seat = employee.bayNumber?.trim();
  if (seat) return seat;
  const cabin = employee.cabinId?.trim();
  if (cabin) return `Cabin ${cabin}`;
  return null;
}

function toDto(doc: SeatHistoryDocument): SeatHistoryEntry {
  const previousSeat = doc.previousSeat;
  const newSeat = doc.newSeat;
  return {
    id: String(doc._id),
    officeSlug: doc.officeSlug,
    seatId: doc.seatId,
    action: doc.action,
    actionLabel: ACTION_LABELS[doc.action]({ previousSeat, newSeat }),
    employeeName: doc.employeeName,
    employeeId: doc.employeeId,
    employeeCode: doc.employeeCode,
    previousSeat,
    newSeat,
    createdAt: doc.createdAt.toISOString(),
    createdBy: doc.createdBy,
  };
}

function memoryToDoc(row: MemoryHistory): SeatHistoryDocument {
  return {
    _id: new ObjectId(row.id),
    officeSlug: row.officeSlug,
    seatId: row.seatId,
    action: row.action,
    employeeName: row.employeeName,
    employeeId: row.employeeId,
    employeeCode: row.employeeCode,
    previousSeat: row.previousSeat,
    newSeat: row.newSeat,
    createdAt: row.createdAt,
    createdBy: row.createdBy,
  };
}

function personFields(employee: Employee | undefined, fallbackName?: string) {
  return {
    employeeName: employee?.name ?? fallbackName ?? "Unknown",
    employeeId: employee?.id,
    employeeCode: employee?.employeeId,
  };
}

function event(
  officeSlug: string,
  seatId: string,
  action: SeatHistoryAction,
  createdAt: Date,
  createdBy: SeatingVersionActor,
  employee: Employee | undefined,
  previousSeat: string | null,
  newSeat: string | null,
  fallbackName?: string,
): Omit<SeatHistoryDocument, "_id"> {
  return {
    officeSlug: normalizeOfficeSlug(officeSlug),
    seatId,
    action,
    ...personFields(employee, fallbackName),
    previousSeat,
    newSeat,
    createdAt,
    createdBy,
  };
}

function eventsForChange(
  employees: Employee[],
  change: SeatingPendingChange,
  actor: SeatingVersionActor,
  at: Date,
): Omit<SeatHistoryDocument, "_id">[] {
  const office = normalizeOfficeSlug(change.officeSlug);
  const events: Omit<SeatHistoryDocument, "_id">[] = [];

  switch (change.kind) {
    case "assign-seat":
    case "clear-seat": {
      const seatId = change.seatId?.trim();
      if (!seatId) return events;
      const current = occupantOnSeat(employees, office, seatId);
      const incoming = change.employeeId
        ? employees.find((item) => item.id === change.employeeId)
        : undefined;

      if (current && incoming && current.id === incoming.id) return events;

      if (current && (!incoming || current.id !== incoming.id)) {
        events.push(
          event(
            office,
            seatId,
            "removed",
            at,
            actor,
            current,
            seatId,
            null,
            change.employeeName,
          ),
        );
      }

      if (incoming) {
        const from = locationLabel(incoming);
        const moved = !!from && from !== seatId;
        events.push(
          event(
            office,
            seatId,
            moved ? "moved-in" : "assigned",
            at,
            actor,
            incoming,
            from,
            seatId,
            change.employeeName,
          ),
        );
        if (moved && incoming.bayNumber?.trim()) {
          events.push(
            event(
              office,
              incoming.bayNumber.trim(),
              "moved-out",
              at,
              actor,
              incoming,
              incoming.bayNumber.trim(),
              seatId,
              change.employeeName,
            ),
          );
        }
      }
      return events;
    }
    case "move-seat": {
      const fromSeatId = change.fromSeatId?.trim();
      const toSeatId = change.toSeatId?.trim();
      if (!fromSeatId || !toSeatId) return events;
      const mover =
        employees.find((item) => item.id === change.employeeId) ??
        occupantOnSeat(employees, office, fromSeatId);
      const displaced = occupantOnSeat(employees, office, toSeatId);
      if (displaced && displaced.id !== mover?.id) {
        events.push(
          event(office, toSeatId, "removed", at, actor, displaced, toSeatId, null),
        );
      }
      if (mover) {
        events.push(
          event(office, fromSeatId, "moved-out", at, actor, mover, fromSeatId, toSeatId, change.employeeName),
        );
        events.push(
          event(office, toSeatId, "moved-in", at, actor, mover, fromSeatId, toSeatId, change.employeeName),
        );
      }
      return events;
    }
    case "swap-seats": {
      const fromSeatId = change.fromSeatId?.trim();
      const toSeatId = change.toSeatId?.trim();
      if (!fromSeatId || !toSeatId) return events;
      const fromEmp = occupantOnSeat(employees, office, fromSeatId);
      const toEmp = occupantOnSeat(employees, office, toSeatId);
      if (fromEmp) {
        events.push(
          event(office, fromSeatId, "swapped-out", at, actor, fromEmp, fromSeatId, toSeatId, change.fromEmployeeName),
        );
        events.push(
          event(office, toSeatId, "swapped-in", at, actor, fromEmp, fromSeatId, toSeatId, change.fromEmployeeName),
        );
      }
      if (toEmp) {
        events.push(
          event(office, toSeatId, "swapped-out", at, actor, toEmp, toSeatId, fromSeatId, change.toEmployeeName),
        );
        events.push(
          event(office, fromSeatId, "swapped-in", at, actor, toEmp, toSeatId, fromSeatId, change.toEmployeeName),
        );
      }
      return events;
    }
    case "assign-cabin":
    case "clear-cabin":
    case "set-cabin-members": {
      const incomingIds = new Set<string>();
      if (change.employeeId) incomingIds.add(change.employeeId);
      for (const id of change.employeeIds ?? []) incomingIds.add(id);
      for (const id of incomingIds) {
        const person = employees.find((item) => item.id === id);
        const fromSeat = person?.bayNumber?.trim();
        if (!person || !fromSeat || !matchesOffice(person, office)) continue;
        const cabin = change.cabinId?.trim();
        events.push(
          event(
            office,
            fromSeat,
            "moved-out",
            at,
            actor,
            person,
            fromSeat,
            cabin ? `Cabin ${cabin}` : null,
            change.employeeName,
          ),
        );
      }
      return events;
    }
    default:
      return events;
  }
}

export function buildSeatHistoryRecords(
  employees: Employee[],
  changes: SeatingPendingChange[],
  actor: SeatingVersionActor,
  createdAt = new Date(),
): Omit<SeatHistoryDocument, "_id">[] {
  const records: Omit<SeatHistoryDocument, "_id">[] = [];
  let working = employees;
  for (const change of changes) {
    records.push(...eventsForChange(working, change, actor, createdAt));
    working = applySeatingChange(working, change);
  }
  return records;
}

export async function insertSeatHistory(
  records: Omit<SeatHistoryDocument, "_id">[],
): Promise<void> {
  if (records.length === 0) return;
  const db = await getDb();
  if (!db) {
    if (!allowInMemoryFallback()) {
      throw new Error("MongoDB is not available.");
    }
    for (const record of records) {
      memoryHistory.unshift({ ...record, id: new ObjectId().toHexString() });
    }
    return;
  }
  await ensureColanModelIndexes(db);
  await db.collection<SeatHistoryDocument>(COLLECTIONS.seatingSeatHistory).insertMany(
    records.map((record) => ({ ...record, _id: new ObjectId() }) as SeatHistoryDocument),
  );
}

export async function listSeatHistory(
  officeSlug: string,
  seatId: string,
): Promise<SeatHistoryEntry[]> {
  const office = normalizeOfficeSlug(officeSlug);
  const seat = seatId.trim();
  if (!seat) return [];

  const db = await getDb();
  if (!db) {
    if (!allowInMemoryFallback()) {
      throw new Error("MongoDB is not available.");
    }
    return memoryHistory
      .filter((row) => row.officeSlug === office && row.seatId === seat)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((row) => toDto(memoryToDoc(row)));
  }

  await ensureColanModelIndexes(db);
  const rows = await db
    .collection<SeatHistoryDocument>(COLLECTIONS.seatingSeatHistory)
    .find({ officeSlug: office, seatId: seat })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  return rows.map(toDto);
}

export async function recordSeatHistoryForChanges(input: {
  employees: Employee[];
  changes: SeatingPendingChange[];
  actor: SeatingVersionActor;
}): Promise<void> {
  const records = buildSeatHistoryRecords(input.employees, input.changes, input.actor);
  await insertSeatHistory(records);
}
