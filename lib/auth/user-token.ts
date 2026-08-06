import { getAppUserSessionRefresh, verifyAppUserCredentials } from "@/lib/app-users";
import { roleNeedsTeam } from "@/lib/permissions";
import { sanitizeSessionImageUrl } from "@/lib/session-token";
import type { JwtPayload, Session } from "@/types/auth";
import type { TeamName } from "@/types";
import { sessionFromPayload } from "@/lib/auth/session";

export async function buildJwtPayloadFromCredentials(
  email: string,
  password: string,
): Promise<JwtPayload | null> {
  const row = await verifyAppUserCredentials(email, password);
  if (!row) return null;
  const appRole = row.appRole;
  const team =
    roleNeedsTeam(appRole) && row.team ? (row.team as TeamName) : undefined;
  return {
    sub: row.email,
    email: row.email,
    name: row.name,
    picture: sanitizeSessionImageUrl(row.imageUrl),
    appRole,
    team,
    isProfileCompleted: row.isProfileCompleted,
  };
}

export async function refreshJwtPayload(email: string): Promise<JwtPayload | null> {
  const normalized = email.toLowerCase().trim();
  const fresh = await getAppUserSessionRefresh(normalized);
  if (!fresh) return null;
  const appRole = fresh.appRole;
  const team =
    roleNeedsTeam(appRole) && fresh.team ? (fresh.team as TeamName) : undefined;
  return {
    sub: normalized,
    email: normalized,
    name: fresh.name,
    picture: sanitizeSessionImageUrl(fresh.imageUrl),
    appRole,
    team,
    isProfileCompleted: fresh.isProfileCompleted,
  };
}

export function toSession(payload: JwtPayload): Session {
  return sessionFromPayload(payload);
}
