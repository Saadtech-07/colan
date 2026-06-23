"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  CreateTeamForm,
  createTeamFormToInput,
  teamFormValuesFromTeam,
  type CreateTeamFormValues,
} from "@/components/features/create-team-form";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { TeamDTO } from "@/models";
import { notifyTeamUpdated } from "@/lib/projects-team-panel";
import { useAppState } from "@/providers/app-state";
import { useTeamAssignableAccounts } from "@/components/features/use-team-assignable-accounts";

type Props = {
  team: TeamDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: (updated: TeamDTO) => void | Promise<void>;
};

export function EditTeamSheet({ team, open, onOpenChange, onUpdated }: Props) {
  const { updateWorkspaceTeam } = useAppState();
  const { accounts, loading: accountsLoading } = useTeamAssignableAccounts(open);
  const [values, setValues] = React.useState<CreateTeamFormValues>(() =>
    teamFormValuesFromTeam(team),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setValues(teamFormValuesFromTeam(team));
      setError(null);
      setSaving(false);
    }
  }, [open, team]);

  const submit = async () => {
    if (!values.name.trim() || !values.code.trim()) return;
    setError(null);
    setSaving(true);
    try {
      const updated = await updateWorkspaceTeam(team.id, createTeamFormToInput(values));
      onOpenChange(false);
      await onUpdated?.(updated);
      notifyTeamUpdated(team, updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update team");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[420px]">
        <SheetHeader className="space-y-2 border-b border-border/60 px-6 py-5 pr-14">
          <SheetTitle>Edit team</SheetTitle>
          <SheetDescription>
            Update {team.name}. Renaming linked employees and projects will be updated
            automatically.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <CreateTeamForm
            values={values}
            onChange={setValues}
            accounts={accounts}
            accountsLoading={accountsLoading}
            error={error}
            idPrefix={`edit-team-${team.id}`}
          />
        </div>

        <SheetFooter className="px-6 py-5">
          <Button
            type="button"
            onClick={submit}
            disabled={saving || !values.name.trim() || !values.code.trim()}
            className="h-12 w-full rounded-xl text-base font-medium"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving changes...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Team slug is generated automatically from the team name.
          </p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
