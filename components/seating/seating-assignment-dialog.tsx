"use client";

import * as React from "react";
import { Loader2, Search, UserMinus } from "lucide-react";
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
import { cabinOccupancyMap } from "@/lib/cabin-utils";
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
  /** Floor plan office — required when Block A/B share seat ids. */
  officeSlug?: string;
  seatIds?: string[];
  cabinIds?: string[];
  /** Render above fullscreen floor-plan View (z-[100]). */
  elevated?: boolean;
  onClose: () => void;
  onAssign: (employeeId: string) => void;
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
  onRemove,
  onReassign,
}: Props) {
  const isCabin = !!cabinId;
  const locationId = cabinId ?? seatId;
  const [query, setQuery] = React.useState("");

  const occupancy = React.useMemo(() => {
    if (isCabin) {
      return cabinOccupancyMap(employees, { officeSlug, cabinIds });
    }
    return seatOccupancyMap(employees, { officeSlug, seatIds });
  }, [cabinIds, employees, isCabin, officeSlug, seatIds]);

  React.useEffect(() => {
    if (open) setQuery("");
  }, [open, locationId]);

  const occupant = locationId ? (occupancy.get(locationId) ?? null) : null;

  const assignableEmployees = React.useMemo(() => {
    return employees.filter((e) => {
      if (!employeeEligibleForSeating(e)) return false;
      if (occupant && e.id === occupant.id) return false;
      if (!employeeMatchesSearch(e, query)) return false;
      return true;
    });
  }, [employees, occupant, query]);

  const vacantForReassign = React.useMemo(() => {
    if (!onReassign) return [];
    if (isCabin) {
      const ids = cabinIds?.length ? cabinIds : [];
      return ids.filter((id) => id !== cabinId && !occupancy.has(id));
    }
    const ids = seatIds?.length ? seatIds : ALL_SEAT_IDS;
    return ids.filter((id) => id !== seatId && !occupancy.has(id));
  }, [cabinId, cabinIds, isCabin, occupancy, onReassign, seatId, seatIds]);

  const title = isCabin
    ? `Cabin · ${cabinLabel?.trim() || cabinId}`
    : `Seat ${seatId}`;

  const layerClass = elevated ? "z-[110]" : undefined;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn("max-h-[90vh] sm:max-w-lg", layerClass)}
        overlayClassName={layerClass}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {occupant
              ? isCabin
                ? "View assignment, move to another cabin, or remove."
                : "View assignment, move to another seat, or remove."
              : isCabin
                ? "Search and assign a manager or team member to this cabin."
                : "Search and assign a team member to this seat."}
          </DialogDescription>
        </DialogHeader>

        {occupant ? (
          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={occupant.imageUrl} alt="" />
                  <AvatarFallback>{occupant.name.slice(0, 2)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{occupant.name}</p>
                  <p className="text-sm text-muted-foreground">{occupant.employeeId}</p>
                  <Badge variant="secondary" className="mt-1">
                    {teamTabLabel(occupant.team)}
                  </Badge>
                </div>
              </div>
            </div>

            {canAssign && (
              <>
                {onReassign && vacantForReassign.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      {isCabin ? "Move to vacant cabin" : "Move to vacant seat"}
                    </p>
                    <ScrollArea className="h-32 rounded-md border p-2">
                      <div className="flex flex-wrap gap-1.5">
                        {vacantForReassign.map((id) => (
                          <Button
                            key={id}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="font-mono text-xs"
                            disabled={saving}
                            onClick={() => onReassign(id)}
                          >
                            {id}
                          </Button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
                <Button
                  type="button"
                  variant="destructive"
                  className="w-full gap-2"
                  disabled={saving}
                  onClick={onRemove}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserMinus className="h-4 w-4" />
                  )}
                  {isCabin ? "Remove from cabin" : "Remove from seat"}
                </Button>
              </>
            )}
          </div>
        ) : (
          canAssign && (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, user ID, or team…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ScrollArea className="h-64 rounded-md border">
                <ul className="p-2">
                  {assignableEmployees.length === 0 ? (
                    <li className="px-2 py-6 text-center text-sm text-muted-foreground">
                      No team members match your search.
                    </li>
                  ) : (
                    assignableEmployees.map((emp) => (
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
          )
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
