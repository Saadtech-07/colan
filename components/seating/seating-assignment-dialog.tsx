"use client";

import * as React from "react";
import { Check, Loader2, Search, UserMinus } from "lucide-react";
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
import { employeeMatchesSearch, seatOccupancyMap } from "@/lib/seating-utils";
import { teamTabLabel } from "@/lib/team-utils";
import { employeeEligibleForSeating } from "@/lib/workspace-identity";
import type { Employee } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  seatId?: string | null;
  cabinId?: string | null;
  cabinLabel?: string | null;
  employees: Employee[];
  canAssign: boolean;
  saving: boolean;
  officeSlug?: string;
  seatIds?: string[];
  cabinIds?: string[];
  elevated?: boolean;
  onClose: () => void;
  onAssign: (employeeId: string) => void;
  /** Team cabins: save the selected set (Done). */
  onAssignMany?: (employeeIds: string[]) => void;
  onRemove: () => void;
  onReassign?: (targetId: string) => void;
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
  seatIds,
  cabinIds,
  elevated = false,
  onClose,
  onAssign,
  onAssignMany,
  onRemove,
  onReassign,
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
      return true;
    });
  }, [employees, isTeamCabin, occupant, query]);

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
                  ? "Search and assign one person to this cabin (CFO, Manager, CEO, …)."
                  : "Search and assign a team member to this seat."}
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
                            "flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                            "hover:bg-muted/80",
                            checked && "bg-accent/60",
                          )}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border"
                            checked={checked}
                            disabled={saving || !canAssign}
                            onChange={() => toggleSelected(emp.id)}
                          />
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={emp.imageUrl} alt="" />
                            <AvatarFallback className="text-xs">
                              {emp.name.slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{emp.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {emp.employeeId} · {teamTabLabel(emp.team)}
                              {emp.cabinId && emp.cabinId !== cabinId
                                ? ` · cabin ${emp.cabinId}`
                                : emp.bayNumber
                                  ? ` · seat ${emp.bayNumber}`
                                  : ""}
                            </p>
                          </div>
                          {checked ? (
                            <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                          ) : null}
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
              <div className="flex items-start gap-3 rounded-lg border border-border/70 bg-muted/40 p-3">
                <Avatar className="h-11 w-11">
                  <AvatarImage src={occupant.imageUrl} alt="" />
                  <AvatarFallback>{occupant.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{occupant.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {occupant.employeeId} · {teamTabLabel(occupant.team)}
                  </p>
                  <Badge variant="secondary" className="mt-1.5">
                    {isCabin ? "In cabin" : `Seat ${seatId}`}
                  </Badge>
                </div>
                {canAssign ? (
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
                ) : null}
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
                              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                              "hover:bg-muted/80",
                            )}
                          >
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={emp.imageUrl} alt="" />
                              <AvatarFallback className="text-xs">
                                {emp.name.slice(0, 2)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{emp.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {emp.employeeId} · {teamTabLabel(emp.team)}
                                {emp.cabinId
                                  ? ` · cabin ${emp.cabinId}`
                                  : emp.bayNumber
                                    ? ` · currently ${emp.bayNumber}`
                                    : ""}
                              </p>
                            </div>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </ScrollArea>
              </div>
            ) : null}

            <DialogFooter>
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
