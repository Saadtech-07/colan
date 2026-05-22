"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { teamColorClasses } from "@/lib/seating-utils";
import { teamTabLabel } from "@/lib/team-utils";
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
        "group relative flex h-[52px] w-[52px] shrink-0 flex-col items-center justify-center rounded-sm border-2 border-black/80 bg-white px-0.5 py-1 text-center shadow-sm transition-all duration-200",
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
      <span className="font-mono text-[9px] font-bold leading-none text-slate-800">
        {seatId}
      </span>
      {occupied && occupant ? (
        <>
          <Avatar className="mt-0.5 h-5 w-5 border border-white/80">
            <AvatarImage src={occupant.imageUrl} alt="" />
            <AvatarFallback className="text-[6px]">
              {occupant.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="mt-0.5 line-clamp-1 w-full px-0.5 text-[7px] font-semibold leading-tight text-slate-900">
            {occupant.name.split(" ")[0]}
          </span>
          {(selected || highlighted) && (
            <>
              <span className="line-clamp-1 w-full text-[6px] text-slate-600">
                {occupant.employeeId}
              </span>
              <Badge
                variant="secondary"
                className={cn(
                  "absolute -right-1 -top-1 h-4 px-1 text-[7px]",
                  teamColors?.text,
                )}
              >
                {teamTabLabel(occupant.team).slice(0, 4)}
              </Badge>
            </>
          )}
        </>
      ) : (
        <span className="mt-1 text-[7px] text-slate-500">Vacant</span>
      )}
    </button>
  );
}
