import { type FloorCell, type SeatingRowConfig } from "@/lib/seating-layout";

export const DEFAULT_OFFICE_SLUG = "chennai";
export const CHENNAI_BLOCK_A_SLUG = "chennai";
export const CHENNAI_BLOCK_B_SLUG = "chennai-block-b";

export function normalizeOfficeSlug(slug?: string | null): string {
  const value = (slug ?? "").trim().toLowerCase();
  return value || DEFAULT_OFFICE_SLUG;
}

export function isChennaiOfficeSlug(slug?: string | null): boolean {
  const value = normalizeOfficeSlug(slug);
  return value === CHENNAI_BLOCK_A_SLUG || value === CHENNAI_BLOCK_B_SLUG;
}

export function seatIdsFromRows(rows: SeatingRowConfig[]): string[] {
  return rows.flatMap((row) =>
    [...row.top, ...row.bottom]
      .filter((cell): cell is Extract<FloorCell, { kind: "seat" }> => cell.kind === "seat")
      .map((cell) => cell.id),
  );
}
