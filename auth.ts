import { getSession } from "@/lib/auth/session";
import type { Session } from "@/types/auth";

/**
 * Server-side auth helper used by API routes.
 * Reads the JWT from the HTTP-only `colan_token` cookie.
 */
export async function auth(): Promise<Session | null> {
  return getSession();
}

export type { Session };
