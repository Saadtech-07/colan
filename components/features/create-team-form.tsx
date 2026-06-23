"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  accountLabel,
  filterTeamLeadAccounts,
  filterTeamManagerAccounts,
  type TeamAssignableAccount,
} from "@/lib/team-assignees";
import {
  normalizeTeamCode,
  normalizeTeamName,
  teamSlugFromName,
  teamTabLabel,
} from "@/lib/team-utils";
import type { TeamUpsertInput } from "@/models";

export type CreateTeamFormValues = {
  name: string;
  code: string;
  teamLeadId: string;
  teamManagerId: string;
};

type Props = {
  values: CreateTeamFormValues;
  onChange: (values: CreateTeamFormValues) => void;
  accounts: TeamAssignableAccount[];
  accountsLoading?: boolean;
  error?: string | null;
  idPrefix?: string;
};

const NONE_VALUE = "__none__";

export function CreateTeamForm({
  values,
  onChange,
  accounts,
  accountsLoading = false,
  error,
  idPrefix = "create-team",
}: Props) {
  const namePreview = values.name.trim() ? normalizeTeamName(values.name) : "";
  const codePreview = values.code.trim() ? normalizeTeamCode(values.code) : "";
  const slugPreview = namePreview ? teamSlugFromName(namePreview) : "";

  const squadName = namePreview || null;

  const leadOptions = React.useMemo(
    () =>
      filterTeamLeadAccounts(accounts, {
        selectedId: values.teamLeadId || undefined,
        squadName: squadName ?? undefined,
      }),
    [accounts, squadName, values.teamLeadId],
  );
  const managerOptions = React.useMemo(
    () =>
      filterTeamManagerAccounts(accounts, {
        selectedId: values.teamManagerId || undefined,
        squadName: squadName ?? undefined,
      }),
    [accounts, squadName, values.teamManagerId],
  );

  React.useEffect(() => {
    if (accountsLoading || !squadName) return;

    const leadStillValid =
      !values.teamLeadId || leadOptions.some((account) => account.id === values.teamLeadId);
    const managerStillValid =
      !values.teamManagerId ||
      managerOptions.some((account) => account.id === values.teamManagerId);

    if (leadStillValid && managerStillValid) return;

    onChange({
      ...values,
      teamLeadId: leadStillValid ? values.teamLeadId : "",
      teamManagerId: managerStillValid ? values.teamManagerId : "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync assignments when squad filters change
  }, [
    accountsLoading,
    leadOptions,
    managerOptions,
    onChange,
    squadName,
    values.teamLeadId,
    values.teamManagerId,
  ]);

  const patch = (partial: Partial<CreateTeamFormValues>) => {
    onChange({ ...values, ...partial });
  };

  return (
    <div className="grid gap-5">
      {error ? (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>Team name</Label>
        <Input
          id={`${idPrefix}-name`}
          value={values.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="e.g. Java, Mobile, Data"
          className="h-11 rounded-xl border-border/70 bg-muted/20"
        />
        {namePreview ? (
          <p className="text-xs text-muted-foreground">
            Will be saved as:{" "}
            <span className="font-medium text-foreground">{namePreview}</span>
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-slug`}>Team slug</Label>
        <div
          id={`${idPrefix}-slug`}
          className="flex h-11 items-center rounded-xl border border-border/70 bg-muted/30 px-3 font-mono text-sm text-muted-foreground"
        >
          {slugPreview || "auto-generated-from-name"}
        </div>
        <p className="text-xs text-muted-foreground">
          URL-safe identifier used internally when linking this squad.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-code`}>Team code</Label>
        <Input
          id={`${idPrefix}-code`}
          value={values.code}
          onChange={(e) => patch({ code: e.target.value })}
          placeholder="e.g. JAVA, MOBILE, DATA"
          className="h-11 rounded-xl border-border/70 bg-muted/20 font-mono uppercase"
        />
        {codePreview ? (
          <p className="text-xs text-muted-foreground">
            Will be saved as:{" "}
            <span className="font-medium text-foreground">{codePreview}</span>
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-lead`}>Team lead</Label>
        <Select
          value={values.teamLeadId || NONE_VALUE}
          onValueChange={(value) => patch({ teamLeadId: value === NONE_VALUE ? "" : value })}
          disabled={accountsLoading}
        >
          <SelectTrigger
            id={`${idPrefix}-lead`}
            className="h-11 rounded-xl border-border/70 bg-muted/20"
          >
            <SelectValue
              placeholder={
                accountsLoading
                  ? "Loading team leads…"
                  : !squadName
                    ? "Enter a team name first"
                    : leadOptions.length === 0
                      ? `No lead accounts for ${teamTabLabel(squadName)}`
                      : "Select team lead (optional)"
              }
            />
          </SelectTrigger>
          <SelectContent className="rounded-lg border-border/60">
            <SelectItem value={NONE_VALUE}>None</SelectItem>
            {leadOptions.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {accountLabel(account)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-manager`}>Team manager</Label>
        <Select
          value={values.teamManagerId || NONE_VALUE}
          onValueChange={(value) => patch({ teamManagerId: value === NONE_VALUE ? "" : value })}
          disabled={accountsLoading}
        >
          <SelectTrigger
            id={`${idPrefix}-manager`}
            className="h-11 rounded-xl border-border/70 bg-muted/20"
          >
            <SelectValue
              placeholder={
                accountsLoading
                  ? "Loading managers…"
                  : !squadName
                    ? "Enter a team name first"
                    : managerOptions.length === 0
                      ? `No manager accounts for ${teamTabLabel(squadName)}`
                      : "Select team manager (optional)"
              }
            />
          </SelectTrigger>
          <SelectContent className="rounded-lg border-border/60">
            <SelectItem value={NONE_VALUE}>None</SelectItem>
            {managerOptions.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {accountLabel(account)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function createTeamFormToInput(values: CreateTeamFormValues): TeamUpsertInput {
  return {
    name: values.name.trim(),
    code: values.code.trim(),
    teamLeadId: values.teamLeadId || null,
    teamManagerId: values.teamManagerId || null,
  };
}

export const emptyCreateTeamFormValues = (): CreateTeamFormValues => ({
  name: "",
  code: "",
  teamLeadId: "",
  teamManagerId: "",
});

export function teamFormValuesFromTeam(team: {
  name: string;
  code?: string;
  teamLeadId?: string;
  teamManagerId?: string;
}): CreateTeamFormValues {
  return {
    name: team.name,
    code: team.code ?? "",
    teamLeadId: team.teamLeadId ?? "",
    teamManagerId: team.teamManagerId ?? "",
  };
}
