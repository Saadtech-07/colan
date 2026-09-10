import { ObjectId } from "mongodb";

import { getDb } from "@/lib/mongodb";
import { allowInMemoryFallback } from "@/lib/data-backend";
import { ensureColanModelIndexes } from "@/models/indexes";
import { COLLECTIONS } from "@/models/collections";
import {
  companyScope,
  toCompanyObjectId,
} from "@/lib/tenant-scope";
import { normalizeOfficeSlug } from "@/lib/floor-plan-layouts";
import {
  applySeatingChange,
  type SeatingPendingChange,
} from "@/lib/seating-draft";

import type { SeatingVersionActor } from "@/models/seating-version.model";

import type {
  SeatHistoryAction,
  SeatHistoryDocument,
  SeatHistoryEntry,
} from "@/models/seating-seat-history.model";

import type { Employee } from "@/types";

/**
 * Draft record used before companyId and Mongo _id are added.
 */
type SeatHistoryDraft = Omit<
  SeatHistoryDocument,
  "_id" | "companyId"
>;

/**
 * In-memory fallback representation.
 */
type MemoryHistory = SeatHistoryDocument & {
  id: string;
};

const memoryHistory: MemoryHistory[] = [];

/**
 * Human-readable labels for seat history actions.
 */
const ACTION_LABELS: Record<
  SeatHistoryAction,
  (
    entry: Pick<
      SeatHistoryEntry,
      "previousSeat" | "newSeat"
    >,
  ) => string
> = {
  assigned: () => "Assigned to this seat",

  removed: () => "Removed from this seat",

  "moved-in": (entry) =>
    entry.previousSeat
      ? `Moved here from ${entry.previousSeat}`
      : "Moved to this seat",

  "moved-out": (entry) =>
    entry.newSeat
      ? `Moved to ${entry.newSeat}`
      : "Moved away from this seat",

  "swapped-in": (entry) =>
    entry.previousSeat
      ? `Swapped in from ${entry.previousSeat}`
      : "Swapped into this seat",

  "swapped-out": (entry) =>
    entry.newSeat
      ? `Swapped to ${entry.newSeat}`
      : "Swapped away from this seat",
};

/**
 * Check whether an employee belongs to the requested office.
 */
function matchesOffice(
  employee: Employee,
  officeSlug: string,
) {
  return (
    normalizeOfficeSlug(employee.officeSlug) ===
    normalizeOfficeSlug(officeSlug)
  );
}

/**
 * Find the employee currently occupying a seat.
 */
function occupantOnSeat(
  employees: Employee[],
  officeSlug: string,
  seatId: string,
): Employee | undefined {
  return employees.find(
    (employee) =>
      employee.bayNumber === seatId &&
      matchesOffice(employee, officeSlug),
  );
}

/**
 * Return the employee's current location.
 */
function locationLabel(
  employee: Employee,
): string | null {
  const seat = employee.bayNumber?.trim();

  if (seat) {
    return seat;
  }

  const cabin = employee.cabinId?.trim();

  if (cabin) {
    return `Cabin ${cabin}`;
  }

  return null;
}

/**
 * Convert database document into API response DTO.
 */
function toDto(
  doc: SeatHistoryDocument,
): SeatHistoryEntry {
  const previousSeat = doc.previousSeat;
  const newSeat = doc.newSeat;

  return {
    id: String(doc._id),
    officeSlug: doc.officeSlug,
    seatId: doc.seatId,
    action: doc.action,

    actionLabel:
      ACTION_LABELS[doc.action]({
        previousSeat,
        newSeat,
      }),

    employeeName: doc.employeeName,
    employeeId: doc.employeeId,
    employeeCode: doc.employeeCode,

    previousSeat,
    newSeat,

    createdAt: doc.createdAt.toISOString(),
    createdBy: doc.createdBy,
  };
}

/**
 * Convert memory record into a database-style document.
 */
function memoryToDoc(
  row: MemoryHistory,
): SeatHistoryDocument {
  return {
    _id: new ObjectId(row.id),

    companyId: row.companyId,

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

/**
 * Build employee information for a history event.
 */
function personFields(
  employee: Employee | undefined,
  fallbackName?: string,
) {
  return {
    employeeName:
      employee?.name ??
      fallbackName ??
      "Unknown",

    employeeId: employee?.id,

    employeeCode:
      employee?.employeeId,
  };
}

/**
 * Create one seat-history event.
 */
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
): SeatHistoryDraft {
  return {
    officeSlug:
      normalizeOfficeSlug(officeSlug),

    seatId,

    action,

    ...personFields(
      employee,
      fallbackName,
    ),

    previousSeat,

    newSeat,

    createdAt,

    createdBy,
  };
}

/**
 * Generate history events for one seating change.
 */
function eventsForChange(
  employees: Employee[],
  change: SeatingPendingChange,
  actor: SeatingVersionActor,
  at: Date,
): SeatHistoryDraft[] {
  const office =
    normalizeOfficeSlug(
      change.officeSlug,
    );

  const events: SeatHistoryDraft[] = [];

  switch (change.kind) {
    /**
     * Assign seat / clear seat.
     */
    case "assign-seat":
    case "clear-seat": {
      const seatId =
        change.seatId?.trim();

      if (!seatId) {
        return events;
      }

      const current =
        occupantOnSeat(
          employees,
          office,
          seatId,
        );

      const incoming =
        change.employeeId
          ? employees.find(
              (item) =>
                item.id ===
                change.employeeId,
            )
          : undefined;

      /**
       * Same employee is already on this seat.
       */
      if (
        current &&
        incoming &&
        current.id === incoming.id
      ) {
        return events;
      }

      /**
       * Remove current occupant.
       */
      if (
        current &&
        (
          !incoming ||
          current.id !== incoming.id
        )
      ) {
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

      /**
       * Add incoming employee.
       */
      if (incoming) {
        const from =
          locationLabel(incoming);

        const moved =
          !!from &&
          from !== seatId;

        events.push(
          event(
            office,
            seatId,
            moved
              ? "moved-in"
              : "assigned",
            at,
            actor,
            incoming,
            from,
            seatId,
            change.employeeName,
          ),
        );

        /**
         * If employee moved from another seat,
         * record the old seat as moved-out.
         */
        if (
          moved &&
          incoming.bayNumber?.trim()
        ) {
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

    /**
     * Move employee from one seat to another.
     */
    case "move-seat": {
      const fromSeatId =
        change.fromSeatId?.trim();

      const toSeatId =
        change.toSeatId?.trim();

      if (
        !fromSeatId ||
        !toSeatId
      ) {
        return events;
      }

      const mover =
        employees.find(
          (item) =>
            item.id ===
            change.employeeId,
        ) ??
        occupantOnSeat(
          employees,
          office,
          fromSeatId,
        );

      const displaced =
        occupantOnSeat(
          employees,
          office,
          toSeatId,
        );

      /**
       * Remove employee already occupying destination.
       */
      if (
        displaced &&
        displaced.id !== mover?.id
      ) {
        events.push(
          event(
            office,
            toSeatId,
            "removed",
            at,
            actor,
            displaced,
            toSeatId,
            null,
          ),
        );
      }

      if (mover) {
        /**
         * Old seat.
         */
        events.push(
          event(
            office,
            fromSeatId,
            "moved-out",
            at,
            actor,
            mover,
            fromSeatId,
            toSeatId,
            change.employeeName,
          ),
        );

        /**
         * New seat.
         */
        events.push(
          event(
            office,
            toSeatId,
            "moved-in",
            at,
            actor,
            mover,
            fromSeatId,
            toSeatId,
            change.employeeName,
          ),
        );
      }

      return events;
    }

    /**
     * Swap two employees.
     */
    case "swap-seats": {
      const fromSeatId =
        change.fromSeatId?.trim();

      const toSeatId =
        change.toSeatId?.trim();

      if (
        !fromSeatId ||
        !toSeatId
      ) {
        return events;
      }

      const fromEmp =
        occupantOnSeat(
          employees,
          office,
          fromSeatId,
        );

      const toEmp =
        occupantOnSeat(
          employees,
          office,
          toSeatId,
        );

      /**
       * Employee from first seat.
       */
      if (fromEmp) {
        events.push(
          event(
            office,
            fromSeatId,
            "swapped-out",
            at,
            actor,
            fromEmp,
            fromSeatId,
            toSeatId,
            change.fromEmployeeName,
          ),
        );

        events.push(
          event(
            office,
            toSeatId,
            "swapped-in",
            at,
            actor,
            fromEmp,
            fromSeatId,
            toSeatId,
            change.fromEmployeeName,
          ),
        );
      }

      /**
       * Employee from second seat.
       */
      if (toEmp) {
        events.push(
          event(
            office,
            toSeatId,
            "swapped-out",
            at,
            actor,
            toEmp,
            toSeatId,
            fromSeatId,
            change.toEmployeeName,
          ),
        );

        events.push(
          event(
            office,
            fromSeatId,
            "swapped-in",
            at,
            actor,
            toEmp,
            toSeatId,
            fromSeatId,
            change.toEmployeeName,
          ),
        );
      }

      return events;
    }

    /**
     * Cabin assignment changes.
     */
    case "assign-cabin":
    case "clear-cabin":
    case "set-cabin-members": {
      const incomingIds =
        new Set<string>();

      if (change.employeeId) {
        incomingIds.add(
          change.employeeId,
        );
      }

      for (
        const id of
          change.employeeIds ?? []
      ) {
        incomingIds.add(id);
      }

      for (
        const id of incomingIds
      ) {
        const person =
          employees.find(
            (item) =>
              item.id === id,
          );

        const fromSeat =
          person?.bayNumber?.trim();

        if (
          !person ||
          !fromSeat ||
          !matchesOffice(
            person,
            office,
          )
        ) {
          continue;
        }

        const cabin =
          change.cabinId?.trim();

        events.push(
          event(
            office,
            fromSeat,
            "moved-out",
            at,
            actor,
            person,
            fromSeat,
            cabin
              ? `Cabin ${cabin}`
              : null,
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

/**
 * Build all seat history records for a list
 * of seating changes.
 */
export function buildSeatHistoryRecords(
  employees: Employee[],
  changes: SeatingPendingChange[],
  actor: SeatingVersionActor,
  createdAt = new Date(),
): SeatHistoryDraft[] {
  const records: SeatHistoryDraft[] = [];

  let working = employees;

  for (const change of changes) {
    records.push(
      ...eventsForChange(
        working,
        change,
        actor,
        createdAt,
      ),
    );

    /**
     * Apply the change so the next event
     * sees the updated seating state.
     */
    working =
      applySeatingChange(
        working,
        change,
      );
  }

  return records;
}

/**
 * Insert seat history records.
 */
export async function insertSeatHistory(
  records: Omit<
    SeatHistoryDocument,
    "_id"
  >[],
): Promise<void> {
  if (records.length === 0) {
    return;
  }

  const db = await getDb();

  /**
   * MongoDB unavailable.
   * Use in-memory fallback when allowed.
   */
  if (!db) {
    if (!allowInMemoryFallback()) {
      throw new Error(
        "MongoDB is not available.",
      );
    }

    for (const record of records) {
      const id = new ObjectId();

      memoryHistory.unshift({
        ...record,

        _id: id,

        id: id.toHexString(),
      });
    }

    return;
  }

  /**
   * Make sure required indexes exist.
   */
  await ensureColanModelIndexes(db);

  /**
   * Add MongoDB _id to every record.
   */
  await db
    .collection<SeatHistoryDocument>(
      COLLECTIONS.seatingSeatHistory,
    )
    .insertMany(
      records.map(
        (record) =>
          ({
            ...record,
            _id: new ObjectId(),
          }) as SeatHistoryDocument,
      ),
    );
}

/**
 * Get seat history for a company and seat.
 */
export async function listSeatHistory(
  companyId: string,
  officeSlug: string,
  seatId: string,
): Promise<SeatHistoryEntry[]> {
  const office =
    normalizeOfficeSlug(
      officeSlug,
    );

  const seat =
    seatId.trim();

  if (!seat) {
    return [];
  }

  const db = await getDb();

  /**
   * In-memory fallback.
   */
  if (!db) {
    if (!allowInMemoryFallback()) {
      throw new Error(
        "MongoDB is not available.",
      );
    }

    return memoryHistory
      .filter(
        (row) =>
          row.companyId?.toString() ===
            companyId &&
          row.officeSlug ===
            office &&
          row.seatId === seat,
      )
      .sort(
        (a, b) =>
          b.createdAt.getTime() -
          a.createdAt.getTime(),
      )
      .map((row) =>
        toDto(
          memoryToDoc(row),
        ),
      );
  }

  await ensureColanModelIndexes(db);

  /**
   * IMPORTANT:
   * companyScope prevents one tenant/company
   * from seeing another company's history.
   */
  const rows = await db
    .collection<SeatHistoryDocument>(
      COLLECTIONS.seatingSeatHistory,
    )
    .find({
      ...companyScope<SeatHistoryDocument>(
        companyId,
      ),

      officeSlug: office,

      seatId: seat,
    })
    .sort({
      createdAt: -1,
    })
    .limit(200)
    .toArray();

  return rows.map(toDto);
}

/**
 * Record seat history for seating changes.
 */
export async function recordSeatHistoryForChanges(
  input: {
    companyId: string;

    employees: Employee[];

    changes: SeatingPendingChange[];

    actor: SeatingVersionActor;
  },
): Promise<void> {
  const records =
    buildSeatHistoryRecords(
      input.employees,
      input.changes,
      input.actor,
    ).map(
      (record) => ({
        ...record,

        companyId:
          toCompanyObjectId(
            input.companyId,
          ),
      }),
    );

  await insertSeatHistory(
    records,
  );
}