import { normalizeTeamName, teamMatchKey } from "@/lib/team-utils";
import type { TeamDTO } from "@/models/team.model";
import type { TeamName } from "@/types";

type TeamSource = {
  team?: TeamName | null;
  teams?: TeamName[] | TeamName | null;
};

function readHexId(value: unknown): string {
  if (
    typeof value === "object" &&
    value !== null &&
    "toHexString" in value &&
    typeof (value as { toHexString?: unknown }).toHexString === "function"
  ) {
    return (value as { toHexString: () => string }).toHexString();
  }
  return "";
}

function collectRawTeamTokens(source: TeamSource): unknown[] {
  const tokens: unknown[] = [];
  const rawTeams = source.teams;
  if (Array.isArray(rawTeams)) tokens.push(...rawTeams);
  else if (rawTeams != null && rawTeams !== "") tokens.push(rawTeams);
  if (source.team != null && source.team !== "") tokens.push(source.team);
  return tokens;
}

function tokenToString(token: unknown): string {
  if (token == null) return "";
  const asHex = readHexId(token);
  if (asHex) return asHex;
  if (typeof token === "object") {
    const record = token as Record<string, unknown>;
    if (typeof record.name === "string") return record.name.trim();
    const refHex = readHexId(record._id);
    if (refHex) return refHex;
    if (typeof record._id === "string") return record._id.trim();
    if (typeof record.slug === "string") return record.slug.trim();
  }
  return String(token).trim();
}

/** Map a MongoDB team token to a canonical squad name from the workspace catalog. */
export function resolveTeamToken(
  token: unknown,
  catalog: Pick<TeamDTO, "id" | "name" | "slug">[],
): TeamName | null {
  const raw = tokenToString(token);
  if (!raw) return null;

  for (const entry of catalog) {
    if (entry.id === raw || entry.name === raw || entry.slug === raw) {
      return entry.name;
    }
  }

  const rawLower = raw.toLowerCase();
  for (const entry of catalog) {
    if (
      entry.name.toLowerCase() === rawLower ||
      entry.slug.toLowerCase() === rawLower
    ) {
      return entry.name;
    }
  }

  const rawKey = teamMatchKey(raw);
  for (const entry of catalog) {
    if (teamMatchKey(entry.name) === rawKey || teamMatchKey(entry.slug) === rawKey) {
      return entry.name;
    }
  }

  const normalized = normalizeTeamName(raw);
  if (!normalized) return null;

  for (const entry of catalog) {
    if (entry.name.toLowerCase() === normalized.toLowerCase()) {
      return entry.name;
    }
    if (teamMatchKey(entry.name) === teamMatchKey(normalized)) {
      return entry.name;
    }
  }

  return normalized;
}

/** Resolve legacy `team` / `teams` values into canonical workspace squad names. */
export function resolveProjectTeamsFromDoc(
  source: TeamSource,
  catalog: Pick<TeamDTO, "id" | "name" | "slug">[],
): TeamName[] {
  const resolved: TeamName[] = [];
  for (const token of collectRawTeamTokens(source)) {
    const name = resolveTeamToken(token, catalog);
    if (name && !resolved.includes(name)) resolved.push(name);
  }
  return resolved;
}
