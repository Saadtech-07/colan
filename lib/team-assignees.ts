import { getRoleFromRegistry } from "@/lib/role-registry";
import { normalizeAppRole } from "@/lib/permissions";
import { normalizeTeamName, teamMatchKey } from "@/lib/team-utils";
import type { AppRole, TeamName } from "@/types";

const TEAM_LEAD_ROLE_KEYS = new Set(["lead", "co-lead", "co_lead", "colead"]);
const TEAM_MANAGER_ROLE_KEYS = new Set(["manager"]);

export type TeamAssignableAccount = {
  id: string;
  name: string;
  email: string;
  appRole: AppRole;
  team?: string;
};

export function isTeamLeadAppRole(roleKey: AppRole): boolean {
  const key = normalizeAppRole(roleKey).toLowerCase();
  if (TEAM_LEAD_ROLE_KEYS.has(key)) return true;

  const role = getRoleFromRegistry(roleKey);
  const label = role?.name.toLowerCase() ?? "";
  return label.includes("team lead") || label === "lead";
}

export function isTeamManagerAppRole(roleKey: AppRole): boolean {
  const key = normalizeAppRole(roleKey).toLowerCase();
  if (TEAM_MANAGER_ROLE_KEYS.has(key)) return true;

  const role = getRoleFromRegistry(roleKey);
  return role?.name.toLowerCase() === "manager";
}

function sortByName(accounts: TeamAssignableAccount[]) {
  return [...accounts].sort((a, b) => a.name.localeCompare(b.name));
}

function accountMatchesSquad(account: TeamAssignableAccount, squadName: TeamName): boolean {
  if (!account.team?.trim() || !squadName.trim()) return false;
  return teamMatchKey(account.team) === teamMatchKey(squadName);
}

function resolveSquadName(rawSquadName?: string): TeamName | null {
  if (!rawSquadName?.trim()) return null;
  const normalized = normalizeTeamName(rawSquadName);
  return normalized || null;
}

type SquadAccountFilterOptions = {
  selectedId?: string;
  squadName?: string;
};

export function filterTeamLeadAccounts(
  accounts: TeamAssignableAccount[],
  options: SquadAccountFilterOptions = {},
) {
  const { selectedId, squadName } = options;
  const squad = resolveSquadName(squadName);

  return sortByName(
    accounts.filter((account) => {
      if (selectedId && account.id === selectedId) return true;
      if (!isTeamLeadAppRole(account.appRole)) return false;
      if (!squad) return false;
      return accountMatchesSquad(account, squad);
    }),
  );
}

export function filterTeamManagerAccounts(
  accounts: TeamAssignableAccount[],
  options: SquadAccountFilterOptions = {},
) {
  const { selectedId, squadName } = options;
  const squad = resolveSquadName(squadName);

  return sortByName(
    accounts.filter((account) => {
      if (selectedId && account.id === selectedId) return true;
      if (!isTeamManagerAppRole(account.appRole)) return false;
      if (!squad) return false;
      return accountMatchesSquad(account, squad);
    }),
  );
}

export function accountLabel(account: TeamAssignableAccount): string {
  const role = getRoleFromRegistry(account.appRole);
  const roleLabel = role?.name ?? account.appRole;
  return account.team ? `${account.name} · ${account.team}` : `${account.name} · ${roleLabel}`;
}

export function accountsById(accounts: TeamAssignableAccount[]) {
  return new Map(accounts.map((account) => [account.id, account]));
}
