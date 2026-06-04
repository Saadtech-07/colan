"use client";

import * as React from "react";
import { ArrowRight, Loader2, Save } from "lucide-react";
import {
  AppUserAccountDetailsStep,
  AppUserWorkspaceDetailsStep,
  type AppUserAccountFormValues,
} from "@/components/features/app-user-account-form-fields";
import { AppUserFormStepper, type AppUserFormStep } from "@/components/features/app-user-form-stepper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { roleNeedsEmployeeIdentity } from "@/lib/permissions";
import type { TeamName } from "@/types";
import type { WorkspaceRole } from "@/models";
import type { Employee } from "@/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  values: AppUserAccountFormValues;
  onChange: (patch: Partial<AppUserAccountFormValues>) => void;
  workspaceRoles: WorkspaceRole[];
  teamNames: TeamName[];
  defaultTeam: TeamName;
  employees: Employee[];
  editingEmployeeId?: string;
  submitting: boolean;
  onSubmit: () => void;
};

function validateAccountStep(values: AppUserAccountFormValues): string | null {
  if (!values.email || !values.name.trim()) {
    return "Email and name are required.";
  }
  if (roleNeedsEmployeeIdentity(values.appRole)) {
    if (!values.employeeId.trim()) return "Employee ID is required for this role.";
    if (!values.team.trim()) return "Team is required for this role.";
  }
  if (values.password.trim() && values.password.trim().length < 6) {
    return "Password must be at least 6 characters.";
  }
  return null;
}

export function EditAppUserDialog({
  open,
  onOpenChange,
  values,
  onChange,
  workspaceRoles,
  teamNames,
  defaultTeam,
  employees,
  editingEmployeeId,
  submitting,
  onSubmit,
}: Props) {
  const [error, setError] = React.useState<string | null>(null);
  const [step, setStep] = React.useState<AppUserFormStep>("account");

  React.useEffect(() => {
    if (open) {
      setStep("account");
      setError(null);
    }
  }, [open, values.email]);

  const continueToWorkspace = () => {
    setError(null);
    const validationError = validateAccountStep(values);
    if (validationError) {
      setError(validationError);
      return;
    }
    setStep("workspace");
  };

  const handleSave = () => {
    setError(null);
    const accountError = validateAccountStep(values);
    if (accountError) {
      setError(accountError);
      setStep("account");
      return;
    }
    onSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(100vw-2rem,56rem)] max-w-none flex-col overflow-hidden border-border/70 bg-background/95 p-0 shadow-2xl backdrop-blur-xl sm:rounded-[28px]">
        <DialogHeader className="shrink-0 space-y-4 border-b border-border/60 px-6 py-5">
          <Badge
            variant="warning"
            className="w-fit rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em]"
          >
            Editing account
          </Badge>
          <div className="space-y-2">
            <DialogTitle className="text-lg">Edit account</DialogTitle>
            <DialogDescription className="text-xs">
              Login access on step one; workspace and addresses on step two.
            </DialogDescription>
          </div>
          <AppUserFormStepper step={step} mode="edit" />
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <div className="mb-4 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {step === "account" ? (
            <AppUserAccountDetailsStep
              values={values}
              onChange={onChange}
              mode="edit"
              workspaceRoles={workspaceRoles}
              teamNames={teamNames}
              defaultTeam={defaultTeam}
              employees={employees}
              disabled={submitting}
            />
          ) : (
            <AppUserWorkspaceDetailsStep
              values={values}
              onChange={onChange}
              mode="edit"
              workspaceRoles={workspaceRoles}
              teamNames={teamNames}
              defaultTeam={defaultTeam}
              employees={employees}
              editingEmployeeId={editingEmployeeId}
              disabled={submitting}
            />
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border/60 bg-background/95 px-6 py-4 backdrop-blur sm:justify-between">
          <p className="text-xs leading-5 text-muted-foreground">
            Changes apply to the login account and linked team member profile.
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl border-border/70 bg-background/80"
              onClick={() => {
                if (step === "workspace") {
                  setStep("account");
                  setError(null);
                  return;
                }
                onOpenChange(false);
              }}
              disabled={submitting}
            >
              {step === "workspace" ? "Back" : "Cancel"}
            </Button>
            {step === "account" ? (
              <Button
                type="button"
                className="h-11 rounded-2xl px-5 shadow-sm"
                onClick={continueToWorkspace}
                disabled={submitting}
              >
                Save &amp; continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                className="h-11 rounded-2xl px-5 shadow-sm"
                disabled={submitting}
                onClick={handleSave}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
