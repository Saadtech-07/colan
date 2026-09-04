import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { verifyAuthToken } from "@/lib/auth/jwt";
import { authCookieOptions } from "@/lib/auth/cookies";
import { signAuthToken } from "@/lib/auth/jwt";
import { refreshJwtPayload } from "@/lib/auth/user-token";
import { sanitizeSessionImageUrl } from "@/lib/session-token";
import { normalizeAppRole, roleNeedsTeam } from "@/lib/permissions";
import { hydrateSessionCompanyId } from "@/lib/tenant-scope";
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
      id: payload.appUserId?.trim() || payload.email,
      email: payload.email,
      name: payload.name ?? null,
      image: image ?? null,
      appRole,
      team,
      companyId: payload.companyId ?? "",
      appUserId: payload.appUserId?.trim() || undefined,
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
  const session = sessionFromPayload(payload);
  return hydrateSessionCompanyId(session);
}

/** Re-issue JWT when legacy cookies lack companyId or appUserId. */
export async function refreshSessionCookieIfStale(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return;
  const payload = await verifyAuthToken(token);
  if (!payload || (payload.companyId?.trim() && payload.appUserId?.trim())) return;

  const fresh = await refreshJwtPayload(payload.email);
  if (!fresh?.companyId?.trim()) return;

  jar.set(AUTH_COOKIE_NAME, await signAuthToken(fresh), authCookieOptions());
}

/** Single JWT verify + optional cookie refresh for /api/auth/me. */
export async function getAuthenticatedSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifyAuthToken(token);
  if (!payload) return null;

  const needsRefresh = !payload.companyId?.trim() || !payload.appUserId?.trim();
  if (needsRefresh) {
    const fresh = await refreshJwtPayload(payload.email);
    if (fresh?.companyId?.trim()) {
      jar.set(AUTH_COOKIE_NAME, await signAuthToken(fresh), authCookieOptions());
      return hydrateSessionCompanyId(sessionFromPayload(fresh));
    }
  }

  return hydrateSessionCompanyId(sessionFromPayload(payload));
}

export async function getSessionFromCookieHeader(
  cookieHeader?: string | null,
): Promise<Session | null> {
  const { readTokenFromCookieHeader } = await import("@/lib/auth/cookies");
  const token = readTokenFromCookieHeader(cookieHeader);
  if (!token) return null;
  const payload = await verifyAuthToken(token);
  if (!payload) return null;
  const session = sessionFromPayload(payload);
  return hydrateSessionCompanyId(session);
}
