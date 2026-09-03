"use client";

import { Armchair, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { teamColorClasses } from "@/lib/seating-utils";
import { teamTabLabel } from "@/lib/team-utils";
import type { Employee } from "@/types";
import { cn } from "@/lib/utils";

export type SeatCardContentProps = {
  seatId: string;
  occupant: Employee | null;
  selected: boolean;
  highlighted: boolean;
  dimmed: boolean;
  layoutZoneLabel?: string | null;
  inLayoutCanvas?: boolean;
  canAssign: boolean;
  onSelect?: () => void;
  onDragStart?: (employeeId: string) => void;
  onDrop?: () => void;
  onPointerDown?: (event: React.PointerEvent) => void;
  /** Render as static div (builder canvas drag handle). */
  asDiv?: boolean;
  /** Floor plan grid: larger text, name + squad role only (no avatar). */
  floorPlanMode?: boolean;
};

export function SeatCardContent({
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
  onPointerDown,
  asDiv = false,
  floorPlanMode = false,
}: SeatCardContentProps) {
  const occupied = !!occupant;
  const teamColors = occupant ? teamColorClasses(occupant.team) : null;

  const className = cn(
    "flex h-full w-full flex-col items-center justify-start overflow-hidden rounded-[18px] border text-center transition-all duration-300 ease-out",
    floorPlanMode ? "px-2 py-2" : "px-2.5 py-2.5",
    occupied
      ? "border-violet-200/90 bg-gradient-to-b from-violet-50 via-violet-100/80 to-violet-50 shadow-[inset_0_2px_0_rgba(255,255,255,0.9),0_4px_12px_rgba(139,92,246,0.12)]"
      : "border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50 shadow-[inset_0_2px_0_rgba(255,255,255,0.95),0_4px_10px_rgba(15,23,42,0.06)]",
    "group-hover/seat:shadow-[inset_0_2px_0_rgba(255,255,255,0.95),0_10px_22px_rgba(15,23,42,0.12)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-white",
    canAssign && (occupied ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"),
    !occupied && "group-hover/seat:border-primary/30",
    occupied && teamColors && cn(teamColors.border, "group-hover/seat:brightness-[1.02]"),
    selected &&
      "ring-2 ring-primary ring-offset-2 ring-offset-white shadow-[0_0_0_1px_rgba(59,130,246,0.15),0_16px_32px_rgba(59,130,246,0.2)]",
    highlighted &&
      !selected &&
      cn(
        "z-20 border-slate-500/70 bg-gradient-to-b from-slate-200 via-slate-300/90 to-slate-200",
        "ring-2 ring-slate-600 ring-offset-2 ring-offset-white",
        "shadow-[0_0_0_1px_rgba(71,85,105,0.35),0_12px_28px_rgba(51,65,85,0.25)]",
      ),
    inLayoutCanvas &&
      !occupied &&
      "border-violet-300/70 ring-2 ring-violet-400/50 ring-offset-2 ring-offset-white",
    dimmed && "opacity-35 saturate-[0.75]",
    !canAssign && !asDiv && "cursor-pointer",
    asDiv && "select-none",
  );

  const children = (
    <>
      <span
        className={cn(
          "inline-flex min-h-5 items-center gap-1 rounded-full border px-2 font-mono font-bold leading-none shadow-sm",
          floorPlanMode ? "text-[9px]" : "text-[10px]",
          occupied
            ? highlighted && !selected
              ? "border-slate-500/40 bg-white text-slate-900"
              : "border-violet-200/80 bg-white/95 text-violet-900"
            : "border-slate-200/80 bg-white/95 text-slate-700",
        )}
      >
        <Armchair className={cn("shrink-0 opacity-70", floorPlanMode ? "h-2.5 w-2.5" : "h-3 w-3")} aria-hidden />
        {seatId}
        {inLayoutCanvas && !occupied && (
          <span className="rounded-full bg-violet-500 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
            New
          </span>
        )}
      </span>
      {occupied && occupant ? (
        floorPlanMode ? (
          <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-1 px-0.5">
            <span
              className={cn(
                "line-clamp-2 w-full font-bold leading-snug",
                highlighted && !selected ? "text-sm text-slate-900" : "text-[13px] text-slate-900",
              )}
            >
              {occupant.name}
            </span>
            <span className="line-clamp-2 w-full text-[11px] font-semibold leading-tight text-violet-700">
              {teamTabLabel(occupant.team)}
            </span>
          </div>
        ) : (
          <>
            <Avatar className="mt-2 h-11 w-11 border-2 border-white bg-white shadow-sm">
              <AvatarImage src={occupant.imageUrl} alt="" className="object-contain bg-white p-0.5" />
              <AvatarFallback className="bg-violet-100 text-[10px] font-semibold text-violet-800">
                {occupant.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span
              className={cn(
                "mt-1.5 line-clamp-2 w-full px-0.5 font-semibold leading-tight",
                highlighted && !selected
                  ? "text-xs font-bold text-slate-900"
                  : "text-[11px] text-slate-900",
              )}
            >
              {occupant.name}
            </span>
            <span
              className={cn(
                "mt-1 inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold shadow-sm",
                "border-violet-200/60 bg-white/95 text-slate-900",
              )}
            >
              <UserRound className="h-3 w-3 shrink-0 text-violet-600" aria-hidden />
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]",
                  teamColors?.dot ?? "bg-violet-500",
                )}
              />
              <span className="truncate">{teamTabLabel(occupant.team)}</span>
            </span>
          </>
        )
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
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1">
          {floorPlanMode ? (
            <>
              <span className="text-sm font-bold text-slate-700">Vacant</span>
              <span className="mt-1 text-[10px] text-slate-400">Available</span>
            </>
          ) : (
            <>
              <Armchair className="mb-1 h-6 w-6 text-violet-500/80" strokeWidth={2} aria-hidden />
              <span className="text-xs font-bold text-slate-700">Vacant</span>
              <span className="mt-0.5 text-[10px] text-slate-400">Available seat</span>
            </>
          )}
        </div>
      )}
    </>
  );

  const title =
    layoutZoneLabel && !occupied
      ? `${layoutZoneLabel} — ${seatId} (assign manually)`
      : occupied
        ? `${occupant.name} · ${teamTabLabel(occupant.team)} — ${seatId}`
        : `Seat ${seatId} (vacant)`;

  if (asDiv) {
    return (
      <div className={className} title={title} onPointerDown={onPointerDown}>
        {children}
      </div>
    );
  }

  return (
    <button
      type="button"
      draggable={canAssign && occupied}
      onDragStart={(e) => {
        if (!occupant || !canAssign) return;
        e.dataTransfer.setData("text/employee-id", occupant.id);
        e.dataTransfer.setData("text/source-seat-id", seatId);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.(occupant.id);
      }}
      onDragOver={(e) => {
        if (!canAssign) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        if (!canAssign) return;
        e.preventDefault();
        e.stopPropagation();
        onDrop?.();
      }}
      onClick={onSelect}
      className={className}
      title={title}
      aria-pressed={selected}
    >
      {children}
    </button>
  );
}
