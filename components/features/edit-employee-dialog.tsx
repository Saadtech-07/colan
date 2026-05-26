"use client";

import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ALL_SEAT_IDS } from "@/lib/seating-layout";
import { seatOccupancyMap } from "@/lib/seating-utils";
import { COMPANY_ROLES } from "@/lib/constants";
import { useAppState } from "@/providers/app-state";
import type { Employee, EmployeeDirectoryInfo, TeamName } from "@/types";
import type { ButtonProps } from "@/components/ui/button";

const UNASSIGNED_SEAT = "__unassigned__";

type Props = {
  employee: Employee;
  onSave: (
    id: string,
    patch: Partial<Omit<Employee, "id">> & { directory?: Partial<EmployeeDirectoryInfo> },
  ) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
  /** Controlled open state (omit trigger when using this). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Hide default trigger; use with controlled `open`. */
  hideTrigger?: boolean;
  projectCount?: number;
  triggerLabel?: string;
  triggerVariant?: ButtonProps["variant"];
  triggerClassName?: string;
};

export function EditEmployeeDialog({
  employee,
  onSave,
  onDelete,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
  projectCount = 0,
  triggerLabel = "Edit",
  triggerVariant = "secondary",
  triggerClassName,
}: Props) {
  const { employees, teamNames } = useAppState();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [name, setName] = React.useState(employee.name);
  const [employeeId, setEmployeeId] = React.useState(employee.employeeId || "");
  const [team, setTeam] = React.useState<TeamName>(employee.team || "React Team");
  const [role, setRole] = React.useState(employee.role || "Employee");
  const [seatId, setSeatId] = React.useState(
    employee.bayNumber?.trim() ? employee.bayNumber : UNASSIGNED_SEAT,
  );
  const [imageUrl, setImageUrl] = React.useState(employee.imageUrl || "");
  const [workEmail, setWorkEmail] = React.useState(employee.directory?.workEmail ?? "");
  const [phone, setPhone] = React.useState(employee.directory?.phone ?? "");
  const [location, setLocation] = React.useState(employee.directory?.location ?? "");
  const [joinedDate, setJoinedDate] = React.useState(employee.directory?.joinedDate ?? "");
  const [notes, setNotes] = React.useState(employee.directory?.notes ?? "");
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const occupancy = React.useMemo(() => seatOccupancyMap(employees), [employees]);

  const vacantSeats = React.useMemo(
    () => ALL_SEAT_IDS.filter((id) => !occupancy.has(id) || occupancy.get(id)?.id === employee.id),
    [occupancy, employee.id],
  );

  React.useEffect(() => {
    if (!open) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(employee.name);
    setEmployeeId(employee.employeeId || "");
    setTeam(employee.team || "React Team");
    setRole(employee.role || "Employee");
    setSeatId(employee.bayNumber?.trim() ? employee.bayNumber : UNASSIGNED_SEAT);
    setImageUrl(employee.imageUrl || "");
    setWorkEmail(employee.directory?.workEmail ?? "");
    setPhone(employee.directory?.phone ?? "");
    setLocation(employee.directory?.location ?? "");
    setJoinedDate(employee.directory?.joinedDate ?? "");
    setNotes(employee.directory?.notes ?? "");
    setError(null);
    setIsSaving(false);
    /* eslint-enable react-hooks/set-state-in-effect */
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
        bayNumber: seatId === UNASSIGNED_SEAT ? "" : seatId,
        imageUrl: imageUrl.trim(),
        directory: {
          workEmail: workEmail.trim(),
          phone: phone.trim(),
          location: location.trim(),
          joinedDate: joinedDate.trim(),
          notes: notes.trim(),
        },
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
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button
            variant={triggerVariant}
            size="sm"
            className={
              triggerClassName ??
              "h-9 rounded-2xl border-border/70 bg-background/80 px-3 shadow-sm"
            }
          >
            {triggerLabel}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border/70 bg-background/95 shadow-2xl backdrop-blur-xl sm:max-w-3xl sm:rounded-[28px]">
        <DialogHeader className="space-y-2 border-b border-border/60 pb-4">
          <DialogTitle>Edit employee</DialogTitle>
          <DialogDescription>
            Update profile, role, directory details, workspace seat, and workforce information.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-2">
          {error && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <section className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="space-y-4">
              <AvatarUploadField
                value={imageUrl}
                previewName={name || employee.name}
                onChange={setImageUrl}
              />
              <div className="rounded-[24px] border border-border/60 bg-muted/10 p-5 text-center">
                <p className="text-base font-semibold text-foreground">
                  {name || employee.name}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {employeeId || employee.employeeId}
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                    {team}
                  </span>
                  <span className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
                    {role}
                  </span>
                </div>
                <div className="mt-4 w-full rounded-2xl border border-border/60 bg-background/80 p-4 text-left">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Project assignment
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {projectCount} assigned project{projectCount === 1 ? "" : "s"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Use Assign Projects in the employee workspace for delivery ownership.
                  </p>
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
                    <Label htmlFor="emp-name">Full name</Label>
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
                    <Select value={role} onValueChange={(v) => setRole(v as Employee["role"])}>
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

              <section className="space-y-4 border-t border-border/60 pt-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Directory and workspace info
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="work-email">Work email</Label>
                    <Input
                      id="work-email"
                      type="email"
                      value={workEmail}
                      onChange={(e) => setWorkEmail(e.target.value)}
                      placeholder="name@colan.io"
                      className="h-11 rounded-2xl border-border/70 bg-background/80"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1-555-0100"
                      className="h-11 rounded-2xl border-border/70 bg-background/80"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Chennai / Remote"
                      className="h-11 rounded-2xl border-border/70 bg-background/80"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="joined">Joined date</Label>
                    <Input
                      id="joined"
                      type="date"
                      value={joinedDate}
                      onChange={(e) => setJoinedDate(e.target.value)}
                      className="h-11 rounded-2xl border-border/70 bg-background/80"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      placeholder="Internal notes about this employee…"
                      className="rounded-2xl border-border/70 bg-background/80"
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-4 border-t border-border/60 pt-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Seating and workspace settings
                </h3>
                <div className="space-y-2">
                  <Label>Office seat</Label>
                  <Select value={seatId} onValueChange={setSeatId}>
                    <SelectTrigger className="h-11 rounded-2xl border-border/70 bg-background/80">
                      <SelectValue placeholder="Select seat" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 rounded-2xl border-border/70 bg-background/95 backdrop-blur-xl">
                      <SelectItem value={UNASSIGNED_SEAT} className="rounded-xl">Unassigned</SelectItem>
                      <SelectGroup>
                        <SelectLabel>Vacant seats</SelectLabel>
                        {vacantSeats.map((id) => (
                          <SelectItem key={`v-${id}`} value={id} className="rounded-xl">
                            {id}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                      {seatId !== UNASSIGNED_SEAT &&
                        !vacantSeats.includes(seatId) &&
                        ALL_SEAT_IDS.includes(seatId) && (
                          <SelectItem value={seatId} className="rounded-xl">
                            Current: {seatId}
                          </SelectItem>
                        )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Assign a seat from the floor plan (A1–G32). Vacant seats only; changing seat
                    moves this employee and frees the previous desk.
                  </p>
                </div>
              </section>
            </div>
          </section>
        </div>

        <DialogFooter className="gap-2 border-t border-border/60 pt-4 sm:gap-0">
          {onDelete && (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSaving}
              className="h-11 rounded-2xl"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSaving}
              className="h-11 rounded-2xl border-border/70 bg-background/80"
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="h-11 rounded-2xl px-5">
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EditEmployeeButton({
  onClick,
  className,
  label = "Edit employee",
}: {
  onClick: () => void;
  className?: string;
  label?: string;
}) {
  return (
    <Button
      type="button"
      className={className ?? "h-11 rounded-2xl px-5 shadow-sm"}
      onClick={onClick}
    >
      <Pencil className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
