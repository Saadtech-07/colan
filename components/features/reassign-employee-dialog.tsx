"use client";

import * as React from "react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAppState } from "@/providers/app-state";
import { ALL_BAY_IDS } from "@/lib/constants";
import type { Employee } from "@/types";

type Props = {
  employee: Employee;
  onReassign: (employeeId: string, newBayId: string) => Promise<void>;
};

export function ReassignEmployeeDialog({ employee, onReassign }: Props) {
  const { employees } = useAppState();
  const [open, setOpen] = React.useState(false);
  const [selectedBay, setSelectedBay] = React.useState<string>("");

  const occupiedBays = new Set(employees.map((e) => e.bayNumber));
  const vacantBays = ALL_BAY_IDS.filter((bayId) => !occupiedBays.has(bayId));

  const handleReassign = async () => {
    if (!selectedBay) return;
    await onReassign(employee.id, selectedBay);
    setSelectedBay("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
        >
          Reassign Bay
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign {employee.name}</DialogTitle>
          <DialogDescription>
            Move {employee.name} from {employee.bayNumber} to a vacant bay.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex items-center gap-3 rounded-lg border p-3 bg-muted/30">
            <Avatar className="h-10 w-10">
              <AvatarImage src={employee.imageUrl} alt="" />
              <AvatarFallback className="text-xs">
                {employee.name.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-medium text-sm">{employee.name}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="text-xs">
                  {employee.team.replace(" Team", "")}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Current: {employee.bayNumber}
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-bay">Select Vacant Bay</Label>
            <Select value={selectedBay} onValueChange={setSelectedBay}>
              <SelectTrigger id="new-bay">
                <SelectValue placeholder="Choose a vacant bay" />
              </SelectTrigger>
              <SelectContent>
                {vacantBays.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No vacant bays available
                  </div>
                ) : (
                  vacantBays.map((bayId) => (
                    <SelectItem key={bayId} value={bayId}>
                      {bayId}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleReassign}
            disabled={!selectedBay || vacantBays.length === 0}
          >
            Move to {selectedBay || "New Bay"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
