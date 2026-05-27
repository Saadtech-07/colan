"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  layoutZoneLabel?: string | null;
  inLayoutCanvas?: boolean;
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
  layoutZoneLabel,
  inLayoutCanvas = false,
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
        "group relative flex h-[132px] w-[108px] shrink-0 flex-col items-center justify-start overflow-hidden rounded-[24px] border-2 border-black/70 bg-white px-2.5 py-2.5 text-center shadow-[0_10px_24px_rgba(15,23,42,0.08)] transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-[#4a6fa5]",
        canAssign && "cursor-pointer hover:-translate-y-1 hover:shadow-[0_14px_28px_rgba(15,23,42,0.16)]",
        !occupied && "bg-slate-100/95 hover:border-primary/50 hover:bg-white dark:bg-slate-200/90",
        occupied &&
          teamColors &&
          cn(teamColors.bg, teamColors.border, "hover:brightness-[1.02]"),
        selected &&
          "ring-2 ring-primary ring-offset-2 ring-offset-[#4a6fa5] shadow-[0_0_0_1px_rgba(255,255,255,0.25),0_18px_34px_rgba(59,130,246,0.26)]",
        highlighted && !selected && "ring-2 ring-amber-400/90 ring-offset-1",
        inLayoutCanvas &&
          !occupied &&
          "ring-2 ring-violet-500/80 ring-offset-2 ring-offset-[#4a6fa5] border-violet-400/60",
        dimmed && "opacity-30 saturate-[0.7]",
        !canAssign && "cursor-default",
      )}
      title={
        layoutZoneLabel && !occupied
          ? `${layoutZoneLabel} — ${seatId} (assign manually)`
          : occupied
            ? `${occupant.name} — ${seatId}`
            : `Seat ${seatId} (vacant)`
      }
      aria-pressed={selected}
    >
      <span className="inline-flex min-h-6 items-center gap-1 rounded-full border border-black/5 bg-slate-900/10 px-2.5 font-mono text-[10px] font-bold leading-none text-slate-800 shadow-sm">
        {seatId}
        {inLayoutCanvas && !occupied && (
          <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
            New
          </span>
        )}
      </span>
      {occupied && occupant ? (
        <>
          <Avatar className="mt-2 h-12 w-12 border-2 border-white/90 bg-white shadow-sm">
            <AvatarImage src={occupant.imageUrl} alt="" className="object-contain bg-white p-0.5" />
            <AvatarFallback className="text-[10px]">
              {occupant.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="mt-2.5 line-clamp-2 min-h-[2.15rem] w-full px-0.5 text-[11px] font-semibold leading-tight text-slate-900">
            {occupant.name}
          </span>
          <span
            className={cn(
              "mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium shadow-sm",
              teamColors?.bg,
              teamColors?.text,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", teamColors?.dot)} />
            {teamTabLabel(occupant.team)}
          </span>
        </>
      ) : layoutZoneLabel ? (
        <div className="flex flex-1 flex-col items-center justify-center px-1">
          <span className="text-[10px] font-bold uppercase tracking-wide text-violet-700">
            Open desk
          </span>
          <span className="mt-1 line-clamp-2 text-[10px] font-semibold leading-tight text-slate-800">
            {layoutZoneLabel}
          </span>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center">
          <span className="text-[11px] font-semibold text-slate-600">Vacant</span>
          <span className="mt-1 text-[9px] text-slate-400">Available seat</span>
        </div>
      )}
    </button>
  );
}
