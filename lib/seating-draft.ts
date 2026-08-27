import { normalizeOfficeSlug } from "@/lib/floor-plan-layouts";
import { listCabinSlotsOnPlan } from "@/lib/cabin-utils";
import type {
  SeatingChangeRecord,
  SeatingSnapshotPerson,
  SeatingVersionSnapshot,
} from "@/models/seating-version.model";
import type { FloorPlanDTO } from "@/models/floor-plan.model";
import type { Employee } from "@/types";

export type SeatingPendingChange = SeatingChangeRecord;

function cloneEmployees(employees: Employee[]): Employee[] {
  return employees.map((employee) => ({ ...employee }));
}

function matchesOffice(employee: Employee, officeSlug: string) {
  return normalizeOfficeSlug(employee.officeSlug) === normalizeOfficeSlug(officeSlug);
}

function clearSeat(employee: Employee): Employee {
  return {
    ...employee,
    bayNumber: "",
    officeSlug: undefined,
  };
}

function seatEmployee(employee: Employee, seatId: string, officeSlug: string): Employee {
  return {
    ...employee,
    bayNumber: seatId,
    officeSlug: normalizeOfficeSlug(officeSlug),
    cabinId: undefined,
  };
}

function clearCabin(employee: Employee): Employee {
  return {
    ...employee,
    cabinId: undefined,
    officeSlug: undefined,
  };
}

function cabinEmployee(employee: Employee, cabinId: string, officeSlug: string): Employee {
  return {
    ...employee,
    cabinId,
    officeSlug: normalizeOfficeSlug(officeSlug),
    bayNumber: "",
  };
}

export function applySeatingChange(
  employees: Employee[],
  change: SeatingPendingChange,
): Employee[] {
  const office = normalizeOfficeSlug(change.officeSlug);
  const next = cloneEmployees(employees);

  const findById = (id: string | null | undefined) =>
    id ? next.find((employee) => employee.id === id) : undefined;

  switch (change.kind) {
    case "assign-seat":
    case "clear-seat": {
      const seatId = change.seatId?.trim();
      if (!seatId) return employees;
      for (let i = 0; i < next.length; i++) {
        if (next[i].bayNumber === seatId && matchesOffice(next[i], office)) {
          next[i] = clearSeat(next[i]);
        }
      }
      const target = findById(change.employeeId);
      if (target) {
        const index = next.findIndex((employee) => employee.id === target.id);
        if (index >= 0) next[index] = seatEmployee(next[index], seatId, office);
      }
      return next;
    }
    case "move-seat": {
      const fromSeatId = change.fromSeatId?.trim();
      const toSeatId = change.toSeatId?.trim();
      const target = findById(change.employeeId);
      if (!fromSeatId || !toSeatId || !target) return employees;
      for (let i = 0; i < next.length; i++) {
        if (next[i].bayNumber === toSeatId && matchesOffice(next[i], office)) {
          next[i] = clearSeat(next[i]);
        }
      }
      const index = next.findIndex((employee) => employee.id === target.id);
      if (index >= 0) next[index] = seatEmployee(next[index], toSeatId, office);
      return next;
    }
    case "swap-seats": {
      const fromSeatId = change.fromSeatId?.trim();
      const toSeatId = change.toSeatId?.trim();
      if (!fromSeatId || !toSeatId) return employees;
      const fromIndex = next.findIndex(
        (employee) => employee.bayNumber === fromSeatId && matchesOffice(employee, office),
      );
      const toIndex = next.findIndex(
        (employee) => employee.bayNumber === toSeatId && matchesOffice(employee, office),
      );
      if (fromIndex < 0) return employees;
      next[fromIndex] = seatEmployee(next[fromIndex], toSeatId, office);
      if (toIndex >= 0) {
        next[toIndex] = seatEmployee(next[toIndex], fromSeatId, office);
      }
      return next;
    }
    case "assign-cabin":
    case "clear-cabin": {
      const cabinId = change.cabinId?.trim();
      if (!cabinId) return employees;
      for (let i = 0; i < next.length; i++) {
        if (next[i].cabinId === cabinId && matchesOffice(next[i], office)) {
          next[i] = clearCabin(next[i]);
        }
      }
      const target = findById(change.employeeId);
      if (target) {
        const index = next.findIndex((employee) => employee.id === target.id);
        if (index >= 0) next[index] = cabinEmployee(next[index], cabinId, office);
      }
      return next;
    }
    case "set-cabin-members": {
      const cabinId = change.cabinId?.trim();
      if (!cabinId) return employees;
      const selected = new Set(change.employeeIds ?? []);
      for (let i = 0; i < next.length; i++) {
        if (next[i].cabinId === cabinId && matchesOffice(next[i], office) && !selected.has(next[i].id)) {
          next[i] = clearCabin(next[i]);
        }
      }
      for (const id of selected) {
        const index = next.findIndex((employee) => employee.id === id);
        if (index >= 0) next[index] = cabinEmployee(next[index], cabinId, office);
      }
      return next;
    }
    case "swap-cabins":
      return employees;
    default:
      return employees;
  }
}

export function applySeatingChanges(
  employees: Employee[],
  changes: SeatingPendingChange[],
): Employee[] {
  return changes.reduce(applySeatingChange, employees);
}

function toSnapshotPerson(employee: Employee): SeatingSnapshotPerson {
  return {
    employeeId: employee.id,
    name: employee.name,
    code: employee.employeeId,
    team: employee.team,
  };
}

export function buildSeatingSnapshot(
  employees: Employee[],
  officeSlug: string,
  seatIds: string[],
  cabinIds: string[],
): SeatingVersionSnapshot {
  const office = normalizeOfficeSlug(officeSlug);
  const seats: SeatingVersionSnapshot["seats"] = {};
  for (const seatId of seatIds) seats[seatId] = null;
  const cabins: SeatingVersionSnapshot["cabins"] = {};
  for (const cabinId of cabinIds) cabins[cabinId] = [];

  for (const employee of employees) {
    if (normalizeOfficeSlug(employee.officeSlug) !== office) continue;
    const seatId = employee.bayNumber?.trim();
    if (seatId && Object.prototype.hasOwnProperty.call(seats, seatId) && !seats[seatId]) {
      seats[seatId] = toSnapshotPerson(employee);
    }
    const cabinId = employee.cabinId?.trim();
    if (cabinId && Object.prototype.hasOwnProperty.call(cabins, cabinId)) {
      cabins[cabinId].push(toSnapshotPerson(employee));
    }
  }
  return { seats, cabins };
}

export function snapshotFromPlan(
  employees: Employee[],
  plan: FloorPlanDTO,
): SeatingVersionSnapshot {
  return buildSeatingSnapshot(
    employees,
    plan.slug,
    plan.seatIds,
    listCabinSlotsOnPlan(plan).map((slot) => slot.id),
  );
}

export function employeesFromSnapshot(
  snapshot: SeatingVersionSnapshot,
  officeSlug: string,
): Employee[] {
  const office = normalizeOfficeSlug(officeSlug);
  const next: Employee[] = [];
  for (const [seatId, person] of Object.entries(snapshot.seats)) {
    if (!person) continue;
    next.push({
      id: person.employeeId,
      employeeId: person.code,
      name: person.name,
      team: person.team,
      role: "Employee",
      gender: "other",
      bayNumber: seatId,
      officeSlug: office,
      imageUrl: "",
    });
  }
  for (const [cabinId, people] of Object.entries(snapshot.cabins)) {
    for (const person of people) {
      next.push({
        id: person.employeeId,
        employeeId: person.code,
        name: person.name,
        team: person.team,
        role: "Employee",
        gender: "other",
        bayNumber: "",
        cabinId,
        officeSlug: office,
        imageUrl: "",
      });
    }
  }
  return next;
}

export function newChangeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `chg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
