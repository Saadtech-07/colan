import type { SeatingAiEmployeeContext } from "@/lib/seating-ai-types";

function normalizeRef(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Maps AI output (database id, COL-#### code, or name) to a roster employee.
 */
export function resolveEmployeeFromAiRef(
  ref: string,
  employees: SeatingAiEmployeeContext[],
): SeatingAiEmployeeContext | null {
  const raw = ref.trim();
  if (!raw) return null;

  const byDatabaseId = new Map(employees.map((emp) => [emp.id, emp]));
  if (byDatabaseId.has(raw)) return byDatabaseId.get(raw)!;

  const normalized = normalizeRef(raw);

  for (const emp of employees) {
    if (normalizeRef(emp.employeeId) === normalized) return emp;
    if (normalizeRef(emp.name) === normalized) return emp;
    if (emp.id.toLowerCase() === normalized) return emp;
  }

  return null;
}
