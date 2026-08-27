import type { AppRole } from "@/types";

/** Default workspace role when session/catalog data is missing. */
export const FALLBACK_ROLE_KEY = "employee";

/** Edge-safe role key normalization (no MongoDB or RBAC catalog imports). */
export function normalizeAppRole(value: unknown): AppRole {
  if (typeof value === "string" && value.trim()) return value.trim();
  return FALLBACK_ROLE_KEY;
}
