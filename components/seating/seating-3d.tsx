"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const SEAT_WIDTH = 108;
const SEAT_HEIGHT = 140;
const SEAT_DEPTH = 12;

type BlockDepthProps = {
  depth?: number;
  frontClassName?: string;
  sideClassName?: string;
  shadowClassName?: string;
  emphasized?: boolean;
  staticVisual?: boolean;
};

function BlockDepthFaces({
  depth = SEAT_DEPTH,
  frontClassName,
  sideClassName,
  shadowClassName,
  emphasized = false,
  staticVisual = false,
}: BlockDepthProps) {
  return (
    <>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-0 left-3 right-5 h-2.5 rounded-[50%] bg-slate-900/10 blur-sm transition-all duration-300 ease-out",
          emphasized ? "scale-110 opacity-100" : staticVisual ? "opacity-80" : "opacity-80 group-hover/seat:scale-110 group-hover/seat:opacity-100",
          shadowClassName,
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-0 left-1 rounded-b-[10px]",
          frontClassName,
        )}
        style={{ height: depth, right: 7 }}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-2 right-0 top-2 w-2.5 rounded-r-[10px]",
          sideClassName,
        )}
      />
    </>
  );
}

type SeatBlockProps = {
  children: React.ReactNode;
  className?: string;
  occupied?: boolean;
  emphasized?: boolean;
  /** Size to parent grid cell instead of fixed legacy 108×152px. */
  fillContainer?: boolean;
  /** Builder canvas: no hover lift/z-index effects. */
  staticVisual?: boolean;
};

export function SeatingSeatBlock({
  children,
  className,
  occupied = false,
  emphasized = false,
  fillContainer = false,
  staticVisual = false,
}: SeatBlockProps) {
  const depthFront = occupied
    ? "bg-gradient-to-b from-violet-300/95 to-violet-400"
    : "bg-gradient-to-b from-slate-200 to-slate-300";
  const depthSide = occupied
    ? "bg-gradient-to-r from-violet-300/85 to-violet-500/90"
    : "bg-gradient-to-r from-slate-200/90 to-slate-400/85";
  const depth = fillContainer ? 8 : SEAT_DEPTH;

  return (
    <div
      className={cn(
        "group/seat relative",
        fillContainer ? "h-full w-full pb-1" : "shrink-0 pb-3",
        staticVisual ? "z-0" : emphasized ? "z-30" : "z-0 hover:z-30",
        !staticVisual && "transition-[transform,z-index] duration-300 ease-out",
        className,
      )}
      style={fillContainer ? undefined : { width: SEAT_WIDTH, height: SEAT_HEIGHT + SEAT_DEPTH }}
    >
      <BlockDepthFaces
        emphasized={emphasized}
        staticVisual={staticVisual}
        depth={depth}
        frontClassName={depthFront}
        sideClassName={depthSide}
      />
      <div
        className={cn(
          "absolute left-0 top-0 z-10",
          fillContainer ? "right-0 bottom-1" : "",
          staticVisual
            ? ""
            : emphasized
              ? "-translate-y-1 scale-[1.02] transition-all duration-300 ease-out"
              : "translate-y-0 transition-all duration-300 ease-out group-hover/seat:-translate-y-1 group-hover/seat:scale-[1.02]",
        )}
        style={fillContainer ? undefined : { width: SEAT_WIDTH, height: SEAT_HEIGHT }}
      >
        {children}
      </div>
    </div>
  );
}

type StructuralBlockProps = {
  width: number;
  height?: number;
  variant: "pillar" | "entrance" | "cabin";
  children: React.ReactNode;
  className?: string;
};

export function SeatingStructuralBlock({
  width,
  height = SEAT_HEIGHT,
  variant,
  children,
  className,
}: StructuralBlockProps) {
  const isPillar = variant === "pillar";
  const isCabin = variant === "cabin";
  const depth = isPillar ? 14 : isCabin ? 12 : 10;
  // Cabins: layout height === face height so side cabins can match A/B row blocks exactly.
  // Depth/shadow paint below without adding extra flow height (avoids empty gaps).
  const layoutHeight = isCabin ? height : height + depth;

  return (
    <div
      className={cn("relative shrink-0", !isCabin && "pb-3", className)}
      style={{ width, height: layoutHeight }}
      aria-hidden={isPillar}
    >
      <BlockDepthFaces
        depth={depth}
        frontClassName={
          isPillar
            ? "bg-gradient-to-b from-slate-600 to-slate-700"
            : isCabin
              ? "bg-gradient-to-b from-slate-400/90 to-slate-500"
              : "bg-gradient-to-b from-sky-400/90 to-sky-500/95"
        }
        sideClassName={
          isPillar
            ? "bg-gradient-to-r from-slate-600/90 to-slate-800"
            : isCabin
              ? "bg-gradient-to-r from-slate-400/85 to-slate-600"
              : "bg-gradient-to-r from-sky-400/80 to-sky-600/90"
        }
        shadowClassName={isPillar ? "bg-slate-900/20" : isCabin ? "bg-slate-900/12" : undefined}
      />
      <div
        className={cn(
          "absolute left-0 top-0 z-10 flex items-center justify-center overflow-hidden rounded-[18px] border-2 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]",
          isPillar
            ? "border-slate-600/80 bg-gradient-to-br from-slate-500 via-slate-600 to-slate-700"
            : isCabin
              ? "border-slate-300/80 bg-gradient-to-br from-slate-200 via-[#d8e2ec] to-slate-300/90 px-3"
              : "border-sky-300/80 bg-gradient-to-br from-sky-100 via-sky-50 to-sky-100/90 px-4",
        )}
        style={{ width, height }}
      >
        {children}
      </div>
    </div>
  );
}

type CabinBlockProps = {
  label: string;
  width: number;
  height?: number;
  vertical?: boolean;
  occupantName?: string | null;
  /** Team cabins: multiple names shown as bullets (same cabin size). */
  occupantNames?: string[];
  selected?: boolean;
  canAssign?: boolean;
  onSelect?: () => void;
  cabinId?: string;
  canDragSwap?: boolean;
  onCabinDragStart?: (cabinId: string) => void;
  onCabinDragEnd?: () => void;
  onCabinDrop?: (targetCabinId: string, sourceCabinId?: string) => void;
};

export const CABIN_DRAG_MIME = "application/x-colan-cabin";

export function SeatingCabinBlock({
  label,
  width,
  height = 88,
  vertical = false,
  occupantName = null,
  occupantNames,
  selected: _selected = false,
  canAssign = false,
  onSelect,
  cabinId,
  canDragSwap = false,
  onCabinDragStart,
  onCabinDragEnd,
  onCabinDrop,
}: CabinBlockProps) {
  const names =
    occupantNames && occupantNames.length > 0
      ? occupantNames.map((n) => n.trim()).filter(Boolean)
      : occupantName?.trim()
        ? [occupantName.trim()]
        : [];
  const occupied = names.length > 0;
  const isTeamList =
    names.length > 1 ||
    (occupantNames !== undefined &&
      names.length >= 1 &&
      /\bteam\s*$/i.test(label));
  const interactive = typeof onSelect === "function";
  const draggable = canDragSwap && !!cabinId && canAssign;
  const teamSummary =
    names.length === 1
      ? names[0]
      : names.length > 1
        ? `${names.length} members`
        : null;

  const body = (
    <div
      className={cn(
        "flex h-full w-full flex-col px-2",
        vertical
          ? "items-center justify-center gap-0.5 py-2"
          : "items-center justify-center gap-0.5",
      )}
    >
      {occupied && isTeamList ? (
        <div
          className={cn(
            "group/team relative flex h-full w-full flex-col items-center justify-center gap-0.5",
            vertical && "px-0.5",
          )}
        >
          <span
            className={cn(
              "max-w-full shrink-0 truncate font-extrabold leading-tight text-slate-800",
              vertical ? "text-center text-[10px]" : "text-[11px]",
            )}
            title={label}
          >
            {label}
          </span>
          <span
            className={cn(
              "max-w-full truncate font-semibold leading-tight text-slate-600",
              vertical ? "text-center text-[10px]" : "text-[11px]",
            )}
          >
            {teamSummary}
          </span>
          <div
            role="tooltip"
            className={cn(
              "absolute inset-1 z-20 flex flex-col overflow-hidden rounded-[14px] border border-slate-200/80 bg-white/95 px-2 py-1.5 shadow-sm backdrop-blur-[2px]",
              "opacity-0 transition-opacity duration-150 group-hover/team:opacity-100 group-focus-within/team:opacity-100",
            )}
          >
            <p className="shrink-0 truncate text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400">
              {label}
            </p>
            <ul className="mt-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
              {names.map((name) => (
                <li
                  key={name}
                  className="truncate text-[11px] font-semibold leading-snug text-slate-800"
                  title={name}
                >
                  {name}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : occupied ? (
        <>
          <span
            className={cn(
              "max-w-full truncate font-extrabold leading-tight text-slate-900",
              vertical ? "text-center text-[13px]" : "text-[14px]",
            )}
            title={names[0]}
          >
            {names[0]}
          </span>
          <span
            className={cn(
              "max-w-full truncate font-semibold leading-tight text-slate-600",
              vertical ? "text-center text-[10px]" : "text-[11px]",
            )}
            title={label}
          >
            {label}
          </span>
        </>
      ) : (
        <>
          <span
            className={cn(
              "max-w-full font-extrabold leading-tight text-slate-800",
              vertical
                ? "line-clamp-3 text-center text-[11px]"
                : "line-clamp-2 text-[12px]",
            )}
          >
            {label}
          </span>
          {interactive ? (
            <span
              className={cn(
                "mt-0.5 text-slate-500",
                vertical ? "text-[10px]" : "text-[11px]",
              )}
            >
              {canAssign ? "Assign" : "Vacant"}
            </span>
          ) : null}
        </>
      )}
    </div>
  );

  return (
    <SeatingStructuralBlock width={width} height={height} variant="cabin">
      {interactive ? (
        <button
          type="button"
          disabled={!canAssign && !occupied}
          draggable={draggable}
          onDragStart={(event) => {
            if (!draggable || !cabinId) return;
            event.dataTransfer.setData(CABIN_DRAG_MIME, cabinId);
            event.dataTransfer.setData("text/plain", cabinId);
            event.dataTransfer.effectAllowed = "move";
            onCabinDragStart?.(cabinId);
          }}
          onDragEnd={() => onCabinDragEnd?.()}
          onDragOver={(event) => {
            if (!canDragSwap || !cabinId) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={(event) => {
            if (!canDragSwap || !cabinId) return;
            event.preventDefault();
            event.stopPropagation();
            const fromId =
              event.dataTransfer.getData(CABIN_DRAG_MIME) ||
              event.dataTransfer.getData("text/plain") ||
              undefined;
            onCabinDrop?.(cabinId, fromId || undefined);
          }}
          onClick={onSelect}
          className={cn(
            "h-full w-full rounded-[inherit] text-left focus-visible:outline-none",
            canAssign || occupied ? "cursor-pointer" : "cursor-default",
            draggable && "cursor-grab active:cursor-grabbing",
          )}
          title={
            occupied && isTeamList
              ? `${label}: ${names.join(", ")}`
              : occupied
                ? `${names[0]} · ${label}`
                : canAssign
                  ? `Assign to ${label}`
                  : label
          }
        >
          {body}
        </button>
      ) : (
        body
      )}
    </SeatingStructuralBlock>
  );
}

type FloorSceneProps = {
  children: React.ReactNode;
  className?: string;
};

export function SeatingFloor3DScene({ children, className }: FloorSceneProps) {
  return (
    <div className={cn("relative w-max", className)} data-seating-export-scene>
      <div className="relative overflow-visible rounded-[24px] border border-slate-200/90 bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#e8edf2] p-5 shadow-[0_16px_48px_-20px_rgba(15,23,42,0.2),inset_0_1px_0_rgba(255,255,255,0.95)] sm:p-7 lg:p-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[24px] opacity-35 [background-image:linear-gradient(rgba(148,163,184,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.16)_1px,transparent_1px)] [background-size:32px_32px]"
        />
        <div className="relative z-10">{children}</div>
      </div>
    </div>
  );
}

export { SEAT_DEPTH, SEAT_HEIGHT, SEAT_WIDTH };
