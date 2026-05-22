"use client";

import * as React from "react";
import Image from "next/image";
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

type Props = {
  onCreate: (employee: Omit<Employee, "id">) => void | Promise<void>;
};

export function AddEmployeeDialog({ onCreate }: Props) {
  const { teamNames } = useAppState();
  const defaultTeam = teamNames[0] ?? "React Team";
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [employeeId, setEmployeeId] = React.useState("");
  const [team, setTeam] = React.useState<TeamName>(defaultTeam);
  const [role, setRole] = React.useState<CompanyRole>("Employee");
  const [bayNumber, setBayNumber] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState(
    "https://api.dicebear.com/7.x/avataaars/png?seed=new&size=128",
  );
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const resetForm = () => {
    setName("");
    setEmployeeId("");
    setTeam(defaultTeam);
    setRole("Employee");
    setBayNumber("E-01");
    setImageUrl("https://api.dicebear.com/7.x/avataaars/png?seed=new&size=128");
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
        <Button>Add Employee</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
          <DialogDescription>
            Capture profile details. Image URL accepts any public image link for
            now.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-full border bg-muted">
              <Image
                src={
                  imageUrl ||
                  "https://api.dicebear.com/7.x/avataaars/png?seed=placeholder&size=128"
                }
                alt="Preview"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="emp-img">Employee image URL</Label>
              <Input
                id="emp-img"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="emp-name">Employee name</Label>
              <Input
                id="emp-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-code">Employee ID</Label>
              <Input
                id="emp-code"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                placeholder="COL-####"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bay">Bay / system number</Label>
              <Input
                id="bay"
                value={bayNumber}
                onChange={(e) => setBayNumber(e.target.value)}
                placeholder="A1 (optional)"
              />
            </div>
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={team} onValueChange={(v) => setTeam(v as TeamName)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {teamNames.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as CompanyRole)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        {error ? (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" type="button" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
