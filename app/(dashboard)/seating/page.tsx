"use client";

import * as React from "react";
import { Users } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LOADING_PRESETS } from "@/lib/loading-presets";
import { useAppState } from "@/providers/app-state";
import { useGlobalLoading } from "@/providers/global-loading";
import { ALL_BAY_IDS, TEAMS } from "@/lib/constants";
import type { Employee } from "@/types";
import { cn } from "@/lib/utils";

const ALL_TAB = "All";

export default function SeatingPage() {
  const { employees, assignEmployeeToBay, access } = useAppState();
  const { withLoading } = useGlobalLoading();
  const canAssign = access?.canAssignSeating ?? false;
  const [teamTab, setTeamTab] = React.useState<string>(ALL_TAB);
  const [bayDialog, setBayDialog] = React.useState<string | null>(null);

  const occupant = (bayId: string) =>
    employees.find((e) => e.bayNumber === bayId) ?? null;

  const visible = (emp: Employee | null) => {
    if (!emp) return true;
    if (teamTab === ALL_TAB) return true;
    return emp.team === teamTab;
  };

  const selectedBay = bayDialog;
  const current = selectedBay ? occupant(selectedBay) : null;
  const vacantBays = ALL_BAY_IDS.filter(
  (bay) => !employees.some((e) => e.bayNumber === bay)
);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Seating arrangement
        </h1>
        <p className="text-muted-foreground">
          Bays E-01 through E-100 — assign people to desks. Filter highlights team
          focus; all bays stay visible.
        </p>
      </div>

      <Tabs value={teamTab} onValueChange={setTeamTab}>
        <TabsList className="no-scrollbar h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
          <TabsTrigger value={ALL_TAB}>All teams</TabsTrigger>
          {TEAMS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {t.replace(" Team", "")}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <ScrollArea className="h-[calc(100vh-14rem)] rounded-xl border border-border/80 bg-card/50 p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10">
          {ALL_BAY_IDS.map((bayId) => {
            const emp = occupant(bayId);
            const showDetail = emp && visible(emp);
            const muted = emp && !visible(emp);
            return (
              <button
                key={bayId}
                type="button"
                onClick={() => canAssign && setBayDialog(bayId)}
                disabled={!canAssign}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2 text-left text-xs shadow-sm transition-all duration-200",
                  "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  showDetail && "border-primary/30 bg-primary/5",
                  muted && "border-dashed bg-muted/40 opacity-80",
                  !emp && "bg-background",
                  !canAssign && "cursor-default hover:translate-y-0",
                )}
              >
                <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                  {bayId}
                </span>
                {showDetail && emp ? (
                  <>
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={emp.imageUrl} alt="" />
                      <AvatarFallback className="text-[10px]">
                        {emp.name.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="line-clamp-2 font-medium leading-tight">
                      {emp.name}
                    </span>
                    <Badge variant="secondary" className="w-fit px-1 py-0 text-[9px]">
                      {emp.team.replace(" Team", "")}
                    </Badge>
                  </>
                ) : muted ? (
                  <div className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-center">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Occupied</span>
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center py-4 text-[10px] text-muted-foreground">
                    Vacant
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {!canAssign && (
        <p className="text-sm text-muted-foreground">
          View-only: admins and project leads can assign bays from this grid.
        </p>
      )}

    <Dialog open={!!selectedBay} onOpenChange={() => setBayDialog(null)}>
  <DialogContent className="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>Manage {selectedBay}</DialogTitle>

      <DialogDescription>
        Employees can only be reassigned to vacant bays.
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-5 py-2">
      {/* Current Occupant */}
      {current ? (
  <div className="space-y-4">
    <div className="rounded-xl border bg-muted/30 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Current Employee
      </p>

      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={current.imageUrl} />

          <AvatarFallback>
            {current.name.slice(0, 2)}
          </AvatarFallback>
        </Avatar>

        <div>
          <h3 className="font-semibold">
            {current.name}
          </h3>

          <p className="text-sm text-muted-foreground">
            {current.team}
          </p>

          <Badge className="mt-1">
            {selectedBay}
          </Badge>
        </div>
      </div>
    </div>

    {/* Reassign Employee */}
    <div className="space-y-3">
      <Label className="text-sm font-medium">
        Reassign Employee
      </Label>

      <Select
        onValueChange={(bay) => {
          if (!current) return;

          void withLoading("seating-assign", LOADING_PRESETS.assigningBay, async () => {
            await assignEmployeeToBay(bay, current.id);
            setBayDialog(null);
          }).catch(() => {
            alert("Failed to move employee");
          });
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select empty bay" />
        </SelectTrigger>

        <SelectContent className="max-h-72">
          {vacantBays.map((bay) => (
            <SelectItem
              key={bay}
              value={bay}
            >
              {bay}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <p className="text-xs text-muted-foreground">
        Only vacant bays are shown for reassignment.
      </p>
    </div>
  </div>
) : (
  <div className="space-y-4">
    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
      This bay is currently vacant.
    </div>

    {/* Assign Employee */}
    <div className="space-y-2">
      <Label>Assign Employee</Label>

      <Select
        onValueChange={(employeeId) => {
          if (!selectedBay) return;

          void withLoading("seating-assign", LOADING_PRESETS.assigningBay, async () => {
            await assignEmployeeToBay(selectedBay, employeeId);
            setBayDialog(null);
          }).catch(() => {
            alert("Assignment failed");
          });
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder="Choose employee" />
        </SelectTrigger>

        <SelectContent>
          {employees.map((employee) => (
            <SelectItem
              key={employee.id}
              value={employee.id}
            >
              {employee.name} — {employee.team}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  </div>
)}
    </div>
  </DialogContent>
</Dialog>
    </div>
  );
}
