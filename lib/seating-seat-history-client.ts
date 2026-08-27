import { parseApiError } from "@/providers/app-state";
import type { SeatHistoryEntry } from "@/models/seating-seat-history.model";

export async function fetchSeatHistory(
  officeSlug: string,
  seatId: string,
): Promise<SeatHistoryEntry[]> {
  const params = new URLSearchParams({
    officeSlug,
    seatId,
  });
  const res = await fetch(`/api/seating/seat-history?${params.toString()}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  const data = (await res.json()) as { entries: SeatHistoryEntry[] };
  return data.entries;
}
