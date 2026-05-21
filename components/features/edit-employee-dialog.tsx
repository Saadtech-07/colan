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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CompanyRole, Employee, TeamName } from "@/types";
import { COMPANY_ROLES, TEAMS } from "@/lib/constants";

type Props = {
  employee: Employee;
  onSave: (id: string, patch: Partial<Omit<Employee, "id">>) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
};

export function EditEmployeeDialog({ employee, onSave, onDelete }: Props) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(employee.name);
  const [employeeId, setEmployeeId] = React.useState(employee.employeeId || "");
  const [team, setTeam] = React.useState<TeamName>(
    employee.team || "React Team"
  );
  const [role, setRole] = React.useState<CompanyRole>(
    employee.role || "Employee"
  );
  const [bayNumber, setBayNumber] = React.useState(employee.bayNumber || "");
  const [imageUrl, setImageUrl] = React.useState(employee.imageUrl || "");
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setName(employee.name);
      setEmployeeId(employee.employeeId || " ");
      setTeam(employee.team || "React Team");
      setRole(employee.role || "Employee");
      setBayNumber(employee.bayNumber || "");
      setImageUrl(employee.imageUrl || "");
      setError(null);
      setIsSaving(false);
    }
  }, [open, employee]);

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);
    try {
      await onSave(employee.id, {
        name: name.trim(),
        employeeId: employeeId.trim(),
        team,
        role,
        bayNumber,
        imageUrl: imageUrl.trim(),
      });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!confirm(`Delete ${employee.name}?`)) return;
    try {
      await onDelete(employee.id);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit employee</DialogTitle>
          <DialogDescription>Update profile and assignment details.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {error && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 overflow-hidden rounded-full border bg-muted">
              <Image src={imageUrl || "https://api.dicebear.com/7.x/avataaars/png?seed=placeholder&size=128"} alt="Preview" fill className="object-cover" unoptimized />
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="emp-img">Employee image URL</Label>
              <Input id="emp-img" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="emp-name">Employee name</Label>
              <Input id="emp-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-code">Employee ID</Label>
              <Input id="emp-code" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="COL-####" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bay">Bay / system number</Label>
              <Input id="bay" value={bayNumber} onChange={(e) => setBayNumber(e.target.value)} placeholder="E-01" />
            </div>
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={team} onValueChange={(v) => setTeam(v as TeamName)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAMS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as CompanyRole)}>
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

        <DialogFooter>
          <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
            Delete
          </Button>
          <div className="ml-auto">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="ml-2" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
