/** Keep JWT/session cookies small — Vercel rejects oversized request headers. */
export const SESSION_IMAGE_MAX_LENGTH = 512;

export function isSessionSafeImageUrl(value?: string | null): value is string {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("data:")) return false;
  if (trimmed.length > SESSION_IMAGE_MAX_LENGTH) return false;
  return true;
}

export function sanitizeSessionImageUrl(value?: string | null): string | undefined {
  return isSessionSafeImageUrl(value) ? value.trim() : undefined;
}
