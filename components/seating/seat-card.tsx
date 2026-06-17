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
        "group relative flex h-[140px] w-[108px] shrink-0 flex-col items-center justify-start overflow-hidden rounded-[22px] border bg-white px-2 py-2 text-center shadow-[0_8px_20px_rgba(15,23,42,0.06)] transition-all duration-200",
        occupied ? "border-slate-200" : "border-slate-200/90",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white",
        canAssign && "cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(15,23,42,0.1)]",
        !occupied && "bg-slate-50/90 hover:border-primary/40 hover:bg-white",
        occupied &&
          teamColors &&
          cn(teamColors.bg, teamColors.border, "hover:brightness-[1.01]"),
        selected &&
          "ring-2 ring-primary ring-offset-2 ring-offset-white shadow-[0_0_0_1px_rgba(59,130,246,0.12),0_14px_28px_rgba(59,130,246,0.18)]",
        highlighted && !selected && "ring-2 ring-amber-400/80 ring-offset-2 ring-offset-white",
        inLayoutCanvas &&
          !occupied &&
          "border-violet-300/70 ring-2 ring-violet-400/50 ring-offset-2 ring-offset-white",
        dimmed && "opacity-35 saturate-[0.75]",
        !canAssign && "cursor-default",
      )}
      title={
        layoutZoneLabel && !occupied
          ? `${layoutZoneLabel} — ${seatId} (assign manually)`
          : occupied
            ? `${occupant.name} · ${teamTabLabel(occupant.team)} — ${seatId}`
            : `Seat ${seatId} (vacant)`
      }
      aria-pressed={selected}
    >
      <span className="inline-flex min-h-5 items-center gap-1 rounded-full border border-slate-200/80 bg-white/90 px-2 font-mono text-[10px] font-bold leading-none text-slate-700 shadow-sm">
        {seatId}
        {inLayoutCanvas && !occupied && (
          <span className="rounded-full bg-violet-500 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
            New
          </span>
        )}
      </span>
      {occupied && occupant ? (
        <>
          <Avatar className="mt-1.5 h-9 w-9 border border-white bg-white shadow-sm">
            <AvatarImage src={occupant.imageUrl} alt="" className="object-contain bg-white p-0.5" />
            <AvatarFallback className="bg-slate-100 text-[9px] text-slate-700">
              {occupant.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="mt-1.5 line-clamp-1 w-full px-0.5 text-[10px] font-semibold leading-tight text-slate-900">
            {occupant.name}
          </span>
          <span
            className={cn(
              "mt-1 inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold shadow-sm",
              "border-black/10 bg-white/90 text-slate-900",
              "ring-1 ring-black/5",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]",
                teamColors?.dot,
              )}
            />
            <span className="truncate">{teamTabLabel(occupant.team)}</span>
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
