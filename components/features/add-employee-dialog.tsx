"use client";

import * as React from "react";
import { Plus, UserRoundPlus } from "lucide-react";
import { AvatarUploadField } from "@/components/features/avatar-upload-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CompanyRole, Employee, TeamName } from "@/types";
import { COMPANY_ROLES } from "@/lib/constants";
import { useAppState } from "@/providers/app-state";
import type { ButtonProps } from "@/components/ui/button";

type Props = {
  onCreate: (employee: Omit<Employee, "id">) => void | Promise<void>;
  triggerLabel?: string;
  triggerVariant?: ButtonProps["variant"];
  triggerClassName?: string;
};

export function AddEmployeeDialog({
  onCreate,
  triggerLabel = "Add Employee",
  triggerVariant = "default",
  triggerClassName,
}: Props) {
  const { teamNames } = useAppState();
  const defaultTeam = teamNames[0] ?? "React Team";
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [employeeId, setEmployeeId] = React.useState("");
  const [team, setTeam] = React.useState<TeamName>(defaultTeam);
  const [role, setRole] = React.useState<CompanyRole>("Employee");
  const [bayNumber, setBayNumber] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const resetForm = () => {
    setName("");
    setEmployeeId("");
    setTeam(defaultTeam);
    setRole("Employee");
    setBayNumber("");
    setImageUrl("");
    setError(null);
  };

  const submit = async () => {
    if (!name.trim() || !employeeId.trim()) {
      setError("Employee name and ID are required.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onCreate({
        name: name.trim(),
        employeeId: employeeId.trim(),
        team,
        role,
        bayNumber,
        imageUrl:
          imageUrl.trim() ||
          `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(name)}&size=128`,
      });
      resetForm();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add employee.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant={triggerVariant}
          className={
            triggerClassName ??
            (triggerVariant === "outline"
              ? "h-11 rounded-2xl border-border/70 bg-background/80 px-5 shadow-sm"
              : "h-11 rounded-2xl px-5 shadow-sm")
          }
        >
          {triggerVariant === "outline" ? (
            <UserRoundPlus className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border/70 bg-background/95 shadow-2xl backdrop-blur-xl sm:max-w-2xl sm:rounded-[28px]">
        <DialogHeader className="space-y-2 border-b border-border/60 pb-4">
          <DialogTitle>Add team member</DialogTitle>
          <DialogDescription>
            Create a new workforce profile with team, role, workspace, and avatar details.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-2 xl:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-4">
            <AvatarUploadField
              value={imageUrl}
              previewName={name || "New team member"}
              onChange={setImageUrl}
              className="h-full"
            />
            <div className="rounded-[24px] border border-border/60 bg-muted/10 p-5 text-center">
              <p className="text-base font-semibold text-foreground">
                {name || "New team member"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {employeeId || "Employee ID pending"}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                  {team}
                </span>
                <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                  {role}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Basic profile info
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="emp-name">Employee name</Label>
                  <Input
                    id="emp-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11 rounded-2xl border-border/70 bg-background/80"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emp-code">Employee ID</Label>
                  <Input
                    id="emp-code"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="COL-####"
                    className="h-11 rounded-2xl border-border/70 bg-background/80"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bay">Seat / workspace</Label>
                  <Input
                    id="bay"
                    value={bayNumber}
                    onChange={(e) => setBayNumber(e.target.value)}
                    placeholder="A1 (optional)"
                    className="h-11 rounded-2xl border-border/70 bg-background/80"
                  />
                </div>
              </div>
            </section>

            <section className="space-y-4 border-t border-border/60 pt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Role and team assignment
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Team</Label>
                  <Select value={team} onValueChange={(v) => setTeam(v as TeamName)}>
                    <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-background/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-border/70 bg-background/95 backdrop-blur-xl">
                      {teamNames.map((t) => (
                        <SelectItem key={t} value={t} className="rounded-xl">
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as CompanyRole)}>
                    <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-background/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-border/70 bg-background/95 backdrop-blur-xl">
                      {COMPANY_ROLES.map((r) => (
                        <SelectItem key={r} value={r} className="rounded-xl">
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>
          </div>
        </div>
        {error ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <DialogFooter className="border-t border-border/60 pt-4">
          <Button
            variant="outline"
            type="button"
            onClick={() => setOpen(false)}
            className="h-11 rounded-2xl border-border/70 bg-background/80"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={isSaving}
            className="h-11 rounded-2xl px-5"
          >
            {isSaving ? "Saving..." : "Save employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
