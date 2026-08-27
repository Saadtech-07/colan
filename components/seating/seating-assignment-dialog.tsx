"use client";

import * as React from "react";
import { Check, History, Loader2, Search, UserMinus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ALL_SEAT_IDS } from "@/lib/seating-layout";
import {
  cabinOccupancyMap,
  cabinOccupantsMap,
  isTeamCabinLabel,
} from "@/lib/cabin-utils";
import {
  employeeMatchesSearch,
  employeeSeatedInOtherBranch,
  employeeSelectableForVacantSlot,
  formatEmployeeSeatingLocation,
  seatOccupancyMap,
} from "@/lib/seating-utils";
import { teamTabLabel } from "@/lib/team-utils";
import { employeeEligibleForSeating } from "@/lib/workspace-identity";
import type { FloorPlanSummary } from "@/models/floor-plan.model";
import type { Employee } from "@/types";
import { cn } from "@/lib/utils";

type OfficePlanRef = Pick<FloorPlanSummary, "slug" | "name" | "city" | "building">;

function AssignEmployeeRow({
  emp,
  officeSlug,
  officePlans,
  cabinLabels,
  trailing,
  className,
}: {
  emp: Employee;
  officeSlug?: string;
  officePlans: OfficePlanRef[];
  cabinLabels?: ReadonlyMap<string, string>;
  trailing?: React.ReactNode;
  className?: string;
}) {
  const location = formatEmployeeSeatingLocation(emp, officePlans, { cabinLabels });
  const isElsewhere = employeeSeatedInOtherBranch(emp, officeSlug, officePlans);
  const role = teamTabLabel(emp.team);

  return (
    <div className={cn("flex min-w-0 items-start gap-3", className)}>
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarImage src={emp.imageUrl} alt="" />
        <AvatarFallback className="text-xs">{emp.name.slice(0, 2)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium leading-snug">{emp.name}</p>
        <div className="mt-1 flex items-start justify-between gap-2">
          <p className="min-w-0 text-xs leading-snug text-muted-foreground">
            <span className="font-medium text-foreground/80">{emp.employeeId}</span>
            <span className="mx-1.5 text-border">·</span>
            <span>{role}</span>
          </p>
          {location ? (
            <Badge
              variant="outline"
              className={cn(
                "max-w-[55%] shrink-0 truncate px-2 py-0 text-[11px] font-normal leading-5",
                isElsewhere
                  ? "border-amber-500/60 bg-amber-500/10 text-amber-950 dark:text-amber-50"
                  : "border-border/80 bg-muted/50 text-muted-foreground",
              )}
              title={location}
            >
              {location}
            </Badge>
          ) : null}
        </div>
      </div>
      {trailing ? <div className="shrink-0 self-center">{trailing}</div> : null}
    </div>
  );
}

type Props = {
  open: boolean;
  seatId?: string | null;
  cabinId?: string | null;
  cabinLabel?: string | null;
  employees: Employee[];
  canAssign: boolean;
  saving: boolean;
  officeSlug?: string;
  /** Floor plan summaries — branch/block labels and assign-list filtering. */
  officePlans?: Pick<FloorPlanSummary, "slug" | "name" | "city" | "building">[];
  /** Cabin id → display label from loaded floor plans. */
  cabinLabels?: ReadonlyMap<string, string>;
  seatIds?: string[];
  cabinIds?: string[];
  elevated?: boolean;
  onClose: () => void;
  onAssign: (employeeId: string) => void;
  /** Team cabins: save the selected set (Done). */
  onAssignMany?: (employeeIds: string[]) => void;
  onRemove: () => void;
  onReassign?: (targetId: string) => void;
  onViewHistory?: () => void;
};

export function SeatingAssignmentDialog({
  open,
  seatId = null,
  cabinId = null,
  cabinLabel = null,
  employees,
  canAssign,
  saving,
  officeSlug,
  officePlans = [],
  cabinLabels,
  seatIds,
  cabinIds,
  elevated = false,
  onClose,
  onAssign,
  onAssignMany,
  onRemove,
  onReassign,
  onViewHistory,
}: Props) {
  const isCabin = !!cabinId;
  const isTeamCabin = isCabin && isTeamCabinLabel(cabinLabel);
  const locationId = cabinId ?? seatId;
  const [query, setQuery] = React.useState("");
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const occupancy = React.useMemo(() => {
    if (isCabin) {
      return cabinOccupancyMap(employees, { officeSlug, cabinIds });
    }
    return seatOccupancyMap(employees, { officeSlug, seatIds });
  }, [cabinIds, employees, isCabin, officeSlug, seatIds]);

  const cabinMembers = React.useMemo(() => {
    if (!isCabin || !cabinId) return [] as Employee[];
    return cabinOccupantsMap(employees, { officeSlug, cabinIds }).get(cabinId) ?? [];
  }, [cabinId, cabinIds, employees, isCabin, officeSlug]);

  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    if (isTeamCabin && cabinId) {
      const members =
        cabinOccupantsMap(employees, { officeSlug, cabinIds }).get(cabinId) ?? [];
      setSelectedIds(members.map((e) => e.id));
    } else {
      setSelectedIds([]);
    }
  }, [open, locationId, isTeamCabin, cabinId, cabinIds, employees, officeSlug]);

  const occupant = locationId ? (occupancy.get(locationId) ?? null) : null;

  const listEmployees = React.useMemo(() => {
    return employees.filter((e) => {
      if (!employeeEligibleForSeating(e)) return false;
      if (!isTeamCabin && occupant && e.id === occupant.id) return false;
      if (!employeeMatchesSearch(e, query)) return false;
      if (
        !employeeSelectableForVacantSlot(e, officeSlug, officePlans, {
          allowCabinId: isTeamCabin ? cabinId : null,
        })
      ) {
        return false;
      }
      return true;
    });
  }, [
    cabinId,
    employees,
    isTeamCabin,
    occupant,
    officePlans,
    officeSlug,
    query,
  ]);

  const vacantForReassign = React.useMemo(() => {
    if (!onReassign || isTeamCabin) return [];
    if (isCabin) {
      const ids = cabinIds?.length ? cabinIds : [];
      return ids.filter((id) => id !== cabinId && !occupancy.has(id));
    }
    const ids = seatIds?.length ? seatIds : ALL_SEAT_IDS;
    return ids.filter((id) => id !== seatId && !occupancy.has(id));
  }, [cabinId, cabinIds, isCabin, isTeamCabin, occupancy, onReassign, seatId, seatIds]);

  const title = isCabin
    ? `Cabin · ${cabinLabel?.trim() || cabinId}`
    : `Seat ${seatId}`;

  const layerClass = elevated ? "z-[110]" : undefined;

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleTeamDone = () => {
    if (!onAssignMany) return;
    onAssignMany(selectedIds);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn("max-h-[90vh] sm:max-w-lg", layerClass)}
        overlayClassName={layerClass}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isTeamCabin
              ? "Select team members with checkboxes, then press Done. Names appear as bullets in the cabin."
              : occupant
                ? isCabin
                  ? "View assignment, move to another cabin, or remove."
                  : "View assignment, move to another seat, or remove."
                : isCabin
                  ? canAssign
                    ? "Search and assign one person to this cabin (CFO, Manager, CEO, …)."
                    : "View this cabin’s current assignment."
                  : canAssign
                    ? "Search and assign a team member to this seat."
                    : "View this seat’s assignment history."}
          </DialogDescription>
        </DialogHeader>

        {isTeamCabin ? (
          <div className="space-y-3">
            {cabinMembers.length > 0 ? (
              <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
                <p className="text-xs font-medium text-muted-foreground">Currently in cabin</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm">
                  {cabinMembers.map((m) => (
                    <li key={m.id}>{m.name}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search people…"
                className="pl-9"
                disabled={saving}
              />
            </div>

            <ScrollArea className="h-[min(50vh,22rem)] rounded-lg border border-border/70">
              <ul className="p-1.5">
                {listEmployees.length === 0 ? (
                  <li className="px-2 py-6 text-center text-sm text-muted-foreground">
                    No team members match your search.
                  </li>
                ) : (
                  listEmployees.map((emp) => {
                    const checked = selectedIds.includes(emp.id);
                    return (
                      <li key={emp.id}>
                        <label
                          className={cn(
                            "flex w-full cursor-pointer rounded-lg border border-transparent px-3 py-3 text-left transition-colors",
                            "hover:border-border/60 hover:bg-muted/70",
                            checked && "border-primary/25 bg-accent/50",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            disabled={saving || !canAssign}
                            onChange={() => toggleSelected(emp.id)}
                          />
                          <AssignEmployeeRow
                            emp={emp}
                            officeSlug={officeSlug}
                            officePlans={officePlans}
                            cabinLabels={cabinLabels}
                            className="w-full"
                            trailing={
                              checked ? (
                                <Check className="h-4 w-4 text-primary" aria-hidden />
                              ) : (
                                <span
                                  className={cn(
                                    "flex h-4 w-4 items-center justify-center rounded border border-border",
                                    checked && "border-primary bg-primary",
                                  )}
                                  aria-hidden
                                />
                              )
                            }
                          />
                        </label>
                      </li>
                    );
                  })
                )}
              </ul>
            </ScrollArea>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
                Cancel
              </Button>
              {canAssign ? (
                <Button type="button" disabled={saving} onClick={handleTeamDone} className="gap-1.5">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Done ({selectedIds.length})
                </Button>
              ) : null}
            </DialogFooter>
          </div>
        ) : (
          <>
            {occupant ? (
              <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                <AssignEmployeeRow
                  emp={occupant}
                  officeSlug={officeSlug}
                  officePlans={officePlans}
                  cabinLabels={cabinLabels}
                  className="items-center"
                  trailing={
                    canAssign ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={saving}
                        className="gap-1.5"
                        onClick={onRemove}
                      >
                        {saving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <UserMinus className="h-3.5 w-3.5" />
                        )}
                        Remove
                      </Button>
                    ) : null
                  }
                />
                <Badge variant="secondary" className="mt-2">
                  {isCabin ? "Assigned to this cabin" : `Assigned to seat ${seatId}`}
                </Badge>
              </div>
            ) : null}

            {canAssign && vacantForReassign.length > 0 && occupant ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Move to vacant {isCabin ? "cabin" : "seat"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {vacantForReassign.slice(0, 24).map((id) => (
                    <Button
                      key={id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      disabled={saving}
                      onClick={() => onReassign?.(id)}
                    >
                      {id}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            {canAssign ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search people to assign…"
                    className="pl-9"
                    disabled={saving}
                  />
                </div>
                <ScrollArea className="h-[min(40vh,18rem)] rounded-lg border border-border/70">
                  <ul className="p-1.5">
                    {listEmployees.length === 0 ? (
                      <li className="px-2 py-6 text-center text-sm text-muted-foreground">
                        No team members match your search.
                      </li>
                    ) : (
                      listEmployees.map((emp) => (
                        <li key={emp.id}>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => onAssign(emp.id)}
                            className={cn(
                              "flex w-full rounded-lg border border-transparent px-3 py-3 text-left transition-colors",
                              "hover:border-border/60 hover:bg-muted/70",
                            )}
                          >
                            <AssignEmployeeRow
                              emp={emp}
                              officeSlug={officeSlug}
                              officePlans={officePlans}
                              cabinLabels={cabinLabels}
                              className="w-full"
                            />
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </ScrollArea>
              </div>
            ) : null}

            <DialogFooter className="gap-2 sm:justify-between">
              {onViewHistory && !isCabin ? (
                <Button type="button" variant="outline" disabled={saving} onClick={onViewHistory} className="gap-1.5">
                  <History className="h-4 w-4" />
                  View History
                </Button>
              ) : (
                <span />
              )}
              <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
