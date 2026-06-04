import { teamMatchKey } from "@/lib/team-utils";
import type { Project, TeamName } from "@/types";

type TeamSource = {
  team?: TeamName | null;
  teams?: TeamName[] | TeamName | null;
};

/** Sidebar label for projects missing squad assignment in MongoDB. */
export const UNASSIGNED_PROJECTS_SECTION = "Unassigned";

/** Normalize legacy `team` or `teams` into a non-empty teams array when possible. */
export function normalizeProjectTeams(source: TeamSource): TeamName[] {
  const rawTeams = source.teams;
  if (Array.isArray(rawTeams)) {
    const cleaned = rawTeams
      .filter((t): t is TeamName => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim());
    if (cleaned.length) return [...new Set(cleaned)];
  }
  if (typeof rawTeams === "string" && rawTeams.trim()) {
    return [rawTeams.trim()];
  }
  if (typeof source.team === "string" && source.team.trim()) {
    return [source.team.trim()];
  }
  return [];
}

export function projectHasNoTeams(project: Pick<Project, "teams">): boolean {
  return normalizeProjectTeams(project).length === 0;
}

export function projectBelongsToTeam(project: Project, team: TeamName): boolean {
  const squadKey = teamMatchKey(team);
  return project.teams.some(
    (assigned) => assigned === team || teamMatchKey(assigned) === squadKey,
  );
}

export function formatProjectTeams(teams: TeamName[]): string {
  return teams.join(", ");
}
