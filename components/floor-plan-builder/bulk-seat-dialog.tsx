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
import { useFloorPlanBuilder } from "./builder-store";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId?: string | null;
};

export function BulkSeatDialog({ open, onOpenChange, parentId = null }: Props) {
  const { bulkCreateSeats } = useFloorPlanBuilder();
  const [matrixRows, setMatrixRows] = React.useState("2");
  const [matrixColumns, setMatrixColumns] = React.useState("5");
  const [startRow, setStartRow] = React.useState("1");
  const [startColumn, setStartColumn] = React.useState("1");
  const [direction, setDirection] = React.useState<"left-to-right" | "top-to-bottom">("left-to-right");

  const total = (Number(matrixRows) || 0) * (Number(matrixColumns) || 0);

  const handleCreate = () => {
    bulkCreateSeats({
      parentId,
      startRow: Number(startRow) || 0,
      startColumn: Number(startColumn) || 0,
      matrixRows: Number(matrixRows) || 1,
      matrixColumns: Number(matrixColumns) || 1,
      direction,
      idPrefix: "S",
      namePrefix: "Seat",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create seats</DialogTitle>
          <DialogDescription>
            Place a full matrix of seats aligned to grid cells. Total seats: {total || 0}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Rows</Label>
            <Input value={matrixRows} onChange={(e) => setMatrixRows(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Columns</Label>
            <Input value={matrixColumns} onChange={(e) => setMatrixColumns(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Start row</Label>
            <Input value={startRow} onChange={(e) => setStartRow(e.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Start column</Label>
            <Input value={startColumn} onChange={(e) => setStartColumn(e.target.value)} className="rounded-xl" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Direction</Label>
          <Select value={direction} onValueChange={(v) => setDirection(v as typeof direction)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="left-to-right">Left → Right</SelectItem>
              <SelectItem value="top-to-bottom">Top → Bottom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="rounded-xl" onClick={handleCreate} disabled={total <= 0}>
            Create {total} seats
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
