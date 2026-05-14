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
import { useAppState } from "@/providers/app-state";
import { ALL_BAY_IDS, TEAMS } from "@/lib/constants";
import type { Employee } from "@/types";
import { cn } from "@/lib/utils";

const ALL_TAB = "All";

export default function SeatingPage() {
  const { employees, assignEmployeeToBay, isAdmin } = useAppState();
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
                onClick={() => isAdmin && setBayDialog(bayId)}
                disabled={!isAdmin}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-2 text-left text-xs shadow-sm transition-all duration-200",
                  "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  showDetail && "border-primary/30 bg-primary/5",
                  muted && "border-dashed bg-muted/40 opacity-80",
                  !emp && "bg-background",
                  !isAdmin && "cursor-default hover:translate-y-0",
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

      {!isAdmin && (
        <p className="text-sm text-muted-foreground">
          View-only: admins assign bays from this grid.
        </p>
      )}

      <Dialog open={!!selectedBay} onOpenChange={() => setBayDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign {selectedBay}</DialogTitle>
            <DialogDescription>
              Choose a team member for this bay. Previous occupant is cleared
              automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select
                value={current?.id ?? "__vacant__"}
                onValueChange={(v) => {
                  if (!selectedBay) return;
                  const id = v === "__vacant__" ? null : v;
                  void assignEmployeeToBay(selectedBay, id).catch(() => {
                    /* surface toast later */
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__vacant__">Vacant</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} — {e.team}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setBayDialog(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
