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
import { employeeMatchesSearch, seatOccupancyMap } from "@/lib/seating-utils";
import { teamTabLabel } from "@/lib/team-utils";
import type { Employee } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  seatId: string | null;
  employees: Employee[];
  canAssign: boolean;
  saving: boolean;
  onClose: () => void;
  onAssign: (employeeId: string) => void;
  onRemove: () => void;
  onReassign: (targetSeatId: string) => void;
};

export function SeatingAssignmentDialog({
  open,
  seatId,
  employees,
  canAssign,
  saving,
  onClose,
  onAssign,
  onRemove,
  onReassign,
}: Props) {
  const [query, setQuery] = React.useState("");
  const occupancy = React.useMemo(() => seatOccupancyMap(employees), [employees]);

  React.useEffect(() => {
    if (open) setQuery("");
  }, [open, seatId]);

  const occupant = seatId ? (occupancy.get(seatId) ?? null) : null;

  const assignableEmployees = React.useMemo(() => {
    return employees.filter((e) => {
      if (occupant && e.id === occupant.id) return false;
      if (!employeeMatchesSearch(e, query)) return false;
      return true;
    });
  }, [employees, occupant, query]);

  const vacantForReassign = React.useMemo(
    () => ALL_SEAT_IDS.filter((id) => id !== seatId && !occupancy.has(id)),
    [occupancy, seatId],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Seat {seatId}</DialogTitle>
          <DialogDescription>
            {occupant
              ? "View assignment, move to another seat, or remove."
              : "Search and assign an employee to this seat."}
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
                <div className="space-y-2">
                  <p className="text-sm font-medium">Move to vacant seat</p>
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
                  Remove from seat
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
                  placeholder="Search employees…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ScrollArea className="h-64 rounded-md border">
                <ul className="p-2">
                  {assignableEmployees.length === 0 ? (
                    <li className="px-2 py-6 text-center text-sm text-muted-foreground">
                      No employees match your search.
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
                              {emp.bayNumber ? ` · currently ${emp.bayNumber}` : ""}
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
