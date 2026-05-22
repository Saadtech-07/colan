import type { Project, TeamName } from "@/types";

type TeamSource = { team?: TeamName; teams?: TeamName[] };

/** Normalize legacy `team` or `teams` into a non-empty teams array when possible. */
export function normalizeProjectTeams(source: TeamSource): TeamName[] {
  if (source.teams?.length) return [...new Set(source.teams)];
  if (source.team) return [source.team];
  return [];
}

export function projectBelongsToTeam(project: Project, team: TeamName): boolean {
  return project.teams.includes(team);
}

export function formatProjectTeams(teams: TeamName[]): string {
  return teams.join(", ");
}
