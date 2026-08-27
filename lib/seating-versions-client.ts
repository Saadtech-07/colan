import { parseApiError } from "@/providers/app-state";
import type { SeatingPendingChange } from "@/lib/seating-draft";
import type { SeatingVersionDTO, SeatingVersionSummary } from "@/models/seating-version.model";
import type { Employee } from "@/types";

export async function fetchSeatingVersions(
  officeSlug: string,
): Promise<SeatingVersionSummary[]> {
  const res = await fetch(
    `/api/seating/versions?officeSlug=${encodeURIComponent(officeSlug)}`,
    { credentials: "include", cache: "no-store" },
  );
  if (!res.ok) throw new Error(await parseApiError(res));
  const data = (await res.json()) as { versions: SeatingVersionSummary[] };
  return data.versions;
}

export async function fetchSeatingVersion(id: string): Promise<SeatingVersionDTO> {
  const res = await fetch(`/api/seating/versions/${encodeURIComponent(id)}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return (await res.json()) as SeatingVersionDTO;
}

export async function saveSeatingChangesClient(input: {
  officeSlug: string;
  changes: SeatingPendingChange[];
}): Promise<{ versions: SeatingVersionDTO[]; employees: Employee[] }> {
  const res = await fetch("/api/seating/versions", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return (await res.json()) as { versions: SeatingVersionDTO[]; employees: Employee[] };
}
