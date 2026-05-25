"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { teamColorClasses } from "@/lib/seating-utils";
import type { Employee } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  seatId: string;
  occupant: Employee | null;
  selected: boolean;
  highlighted: boolean;
  dimmed: boolean;
  canAssign: boolean;
  onSelect: () => void;
  onDragStart?: (employeeId: string) => void;
  onDrop?: () => void;
};

export function SeatCard({
  seatId,
  occupant,
  selected,
  highlighted,
  dimmed,
  canAssign,
  onSelect,
  onDragStart,
  onDrop,
}: Props) {
  const occupied = !!occupant;
  const teamColors = occupant ? teamColorClasses(occupant.team) : null;

  return (
    <button
      type="button"
      disabled={!canAssign && !occupied}
      draggable={canAssign && occupied}
      onDragStart={(e) => {
        if (!occupant || !canAssign) return;
        e.dataTransfer.setData("text/employee-id", occupant.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.(occupant.id);
      }}
      onDragOver={(e) => {
        if (!canAssign || occupied) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        if (!canAssign || occupied) return;
        e.preventDefault();
        onDrop?.();
      }}
      onClick={onSelect}
      className={cn(
        "group relative flex h-[120px] w-[96px] shrink-0 flex-col items-center justify-start rounded-2xl border-2 border-black/70 bg-white px-2 py-2 text-center shadow-sm transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        canAssign && "cursor-pointer hover:-translate-y-0.5 hover:shadow-md",
        !occupied && "bg-slate-100 hover:border-primary/60 hover:bg-white dark:bg-slate-200/90",
        occupied &&
          teamColors &&
          cn(teamColors.bg, teamColors.border, "hover:brightness-105"),
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-[#4a6fa5] shadow-lg shadow-primary/30",
        highlighted && !selected && "ring-2 ring-amber-400 ring-offset-1",
        dimmed && "opacity-35 saturate-50",
        !canAssign && "cursor-default",
      )}
      title={occupied ? `${occupant.name} — ${seatId}` : `Seat ${seatId} (vacant)`}
    >
      <span className="inline-flex min-h-5 items-center rounded-full bg-slate-900/10 px-2 font-mono text-[10px] font-bold leading-none text-slate-800">
        {seatId}
      </span>
      {occupied && occupant ? (
        <>
          <Avatar className="mt-1.5 h-11 w-11 border-2 border-white/90 bg-white shadow-sm">
            <AvatarImage src={occupant.imageUrl} alt="" className="object-contain bg-white p-0.5" />
            <AvatarFallback className="text-[10px]">
              {occupant.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="mt-2 line-clamp-2 min-h-[2rem] w-full text-[11px] font-semibold leading-tight text-slate-900">
            {occupant.name}
          </span>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center">
          <span className="text-[11px] font-medium text-slate-500">Vacant</span>
          <span className="mt-1 text-[9px] text-slate-400">Available seat</span>
        </div>
      )}
    </button>
  );
}
