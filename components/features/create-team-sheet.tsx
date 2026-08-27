"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import {
  CreateTeamForm,
  createTeamFormToInput,
  emptyCreateTeamFormValues,
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
import { useAppState } from "@/providers/app-state";
import { useTeamAssignableAccounts } from "@/components/features/use-team-assignable-accounts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void | Promise<void>;
};

export function CreateTeamSheet({ open, onOpenChange, onCreated }: Props) {
  const { addWorkspaceTeam } = useAppState();
  const { accounts, loading: accountsLoading } = useTeamAssignableAccounts(open);
  const [values, setValues] = React.useState<CreateTeamFormValues>(emptyCreateTeamFormValues);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const resetForm = React.useCallback(() => {
    setValues(emptyCreateTeamFormValues());
    setError(null);
    setSaving(false);
  }, []);

  React.useEffect(() => {
    if (!open) resetForm();
  }, [open, resetForm]);

  const submit = async () => {
    if (!values.name.trim()) return;
    setError(null);
    setSaving(true);
    try {
      await addWorkspaceTeam(createTeamFormToInput(values));
      resetForm();
      onOpenChange(false);
      await onCreated?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create team");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-[420px]">
        <SheetHeader className="space-y-2 border-b border-border/60 px-6 py-5 pr-14">
          <SheetTitle>New project team</SheetTitle>
          <SheetDescription>
            Create a squad for filtering projects and assigning work. Details are saved to
            MongoDB.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <CreateTeamForm
            values={values}
            onChange={setValues}
            accounts={accounts}
            accountsLoading={accountsLoading}
            error={error}
          />
        </div>

        <SheetFooter className="px-6 py-5">
          <Button
            type="button"
            onClick={submit}
            disabled={saving || !values.name.trim()}
            className="h-12 w-full rounded-xl text-base font-medium"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating team...
              </>
            ) : (
              "Create team"
            )}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            Team slug and code are generated automatically from the team name.
          </p>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
