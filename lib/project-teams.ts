import { teamMatchKey } from "@/lib/team-utils";
import type { Project, TeamName } from "@/types";

type TeamSource = {
  team?: TeamName | null;
  teams?: TeamName[] | TeamName | null;
};

/** Sidebar label for projects missing squad assignment in MongoDB. */
export const UNASSIGNED_PROJECTS_SECTION = "Unassigned";

/** All-tab portfolio section (every project the user can access). */
export const ALL_PROJECTS_SECTION = "All projects";

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

/** Merge catalog-resolved squads with legacy `team` / `teams` on the document. */
export function mergeProjectTeamNames(
  resolved: TeamName[],
  source: TeamSource,
): TeamName[] {
  const merged = [...resolved];
  for (const legacy of normalizeProjectTeams(source)) {
    if (
      !merged.some(
        (name) => name === legacy || teamMatchKey(name) === teamMatchKey(legacy),
      )
    ) {
      merged.push(legacy);
    }
  }
  return merged;
}

/** Squad tabs: workspace catalog first, then any teams referenced on projects. */
export function discoverTeamsFromProjects(
  catalogTeamNames: string[],
  projects: Pick<Project, "teams">[],
): TeamName[] {
  const byKey = new Map<string, TeamName>();

  const add = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const key = teamMatchKey(trimmed);
    if (!byKey.has(key)) byKey.set(key, trimmed);
  };

  for (const name of catalogTeamNames) add(name);
  for (const project of projects) {
    for (const team of project.teams) add(team);
  }

  const ordered: TeamName[] = [];
  for (const name of catalogTeamNames) {
    const hit = byKey.get(teamMatchKey(name));
    if (hit) {
      ordered.push(hit);
      byKey.delete(teamMatchKey(name));
    }
  }
  for (const name of byKey.values()) ordered.push(name);
  return ordered;
}
