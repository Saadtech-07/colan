import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { verifyAuthToken } from "@/lib/auth/jwt";
import { sanitizeSessionImageUrl } from "@/lib/session-token";
import { normalizeAppRole, roleNeedsTeam } from "@/lib/permissions";
import type { JwtPayload, Session } from "@/types/auth";
import type { AppRole, TeamName } from "@/types";

export function sessionFromPayload(payload: JwtPayload): Session {
  const appRole = normalizeAppRole(payload.appRole as AppRole);
  const team =
    roleNeedsTeam(appRole) && payload.team
      ? (payload.team as TeamName)
      : undefined;
  const image = sanitizeSessionImageUrl(payload.picture);

  return {
    user: {
      id: payload.email,
      email: payload.email,
      name: payload.name ?? null,
      image: image ?? null,
      appRole,
      team,
      isProfileCompleted: payload.isProfileCompleted !== false,
    },
  };
}

/** Read the JWT HTTP-only cookie and return the current session. */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyAuthToken(token);
  if (!payload) return null;
  return sessionFromPayload(payload);
}

export async function getSessionFromCookieHeader(
  cookieHeader?: string | null,
): Promise<Session | null> {
  const { readTokenFromCookieHeader } = await import("@/lib/auth/cookies");
  const token = readTokenFromCookieHeader(cookieHeader);
  if (!token) return null;
  const payload = await verifyAuthToken(token);
  if (!payload) return null;
  return sessionFromPayload(payload);
}
