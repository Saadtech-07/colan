"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  downloadLayoutJson,
  toEmployeeAppPayload,
} from "@/lib/layout/generate-office-layout";
import type { OfficeLayout, OfficeSeat } from "@/lib/types/office-layout";
import {
  DESK_COLOR,
  DOOR_COLOR,
  SEAT_COLOR,
  WALL_COLOR,
  ZONE_COLORS,
} from "@/lib/types/office-layout";

interface GeneratedLayoutViewerProps {
  layout: OfficeLayout;
  imageUrl?: string;
}

type ViewMode = "layout" | "overlay";
type SelectedEntity =
  | { kind: "seat"; entity: OfficeSeat }
  | { kind: "desk"; entity: OfficeLayout["desks"][number] }
  | { kind: "zone"; entity: OfficeLayout["zones"][number] };

export function GeneratedLayoutViewer({
  layout,
  imageUrl,
}: GeneratedLayoutViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("overlay");
  const [showLabels, setShowLabels] = useState(true);
  const [selected, setSelected] = useState<SelectedEntity | null>(null);

  const { width, height } = layout.source;

  const fitToContainer = useCallback(() => {
    if (!containerRef.current) return;
    const padding = 32;
    const available = containerRef.current.clientWidth - padding;
    setScale(Math.min(1, available / width));
  }, [width]);

  useEffect(() => {
    fitToContainer();
    window.addEventListener("resize", fitToContainer);
    return () => window.removeEventListener("resize", fitToContainer);
  }, [fitToContainer]);

  const integrationJson = useMemo(
    () => JSON.stringify(toEmployeeAppPayload(layout), null, 2),
    [layout],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{layout.name}</h2>
            <p className="text-sm text-slate-500">
              Generated office layout — {layout.stats.assignableSeats} assignable seats
              across {layout.stats.totalDesks} desks
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ViewToggle
              active={viewMode === "overlay"}
              onClick={() => setViewMode("overlay")}
              label="Floor plan"
            />
            <ViewToggle
              active={viewMode === "layout"}
              onClick={() => setViewMode("layout")}
              label="Schematic"
            />
            <button
              type="button"
              onClick={() => setShowLabels((v) => !v)}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
            >
              {showLabels ? "Hide labels" : "Show labels"}
            </button>
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.25, s - 0.1))}
              className="rounded-lg border border-slate-200 px-2 py-1 text-sm hover:bg-slate-50"
            >
              −
            </button>
            <span className="text-xs text-slate-500">{Math.round(scale * 100)}%</span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(2, s + 0.1))}
              className="rounded-lg border border-slate-200 px-2 py-1 text-sm hover:bg-slate-50"
            >
              +
            </button>
            <button
              type="button"
              onClick={fitToContainer}
              className="rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
            >
              Fit
            </button>
          </div>
        </div>

        <div
          ref={containerRef}
          className="overflow-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-inner"
        >
          <div
            className="relative mx-auto origin-top-left"
            style={{ width: width * scale, height: height * scale }}
          >
            {viewMode === "overlay" && imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Original floor plan"
                className="absolute inset-0 block h-full w-full"
                draggable={false}
              />
            )}
            <svg
              className="relative block h-full w-full"
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="none"
            >
              {viewMode === "layout" && (
                <rect width={width} height={height} fill="#f8fafc" />
              )}

              {layout.zones.map((zone) => (
                <g key={zone.id}>
                  {zone.polygon && zone.polygon.length >= 3 ? (
                    <polygon
                      points={zone.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill={ZONE_COLORS[zone.type]}
                      fillOpacity={viewMode === "overlay" ? 0.08 : 0.55}
                      stroke="#64748b"
                      strokeWidth={viewMode === "overlay" ? 1 : 2}
                      strokeOpacity={viewMode === "overlay" ? 0.4 : 1}
                      onClick={() => setSelected({ kind: "zone", entity: zone })}
                      className="cursor-pointer"
                    />
                  ) : (
                    <rect
                      x={zone.bounds.x}
                      y={zone.bounds.y}
                      width={zone.bounds.width}
                      height={zone.bounds.height}
                      fill={ZONE_COLORS[zone.type]}
                      fillOpacity={viewMode === "overlay" ? 0.08 : 0.55}
                      stroke="#64748b"
                      strokeWidth={viewMode === "overlay" ? 1 : 2}
                      strokeOpacity={viewMode === "overlay" ? 0.4 : 1}
                      onClick={() => setSelected({ kind: "zone", entity: zone })}
                      className="cursor-pointer"
                    />
                  )}
                  {showLabels && (
                    <text
                      x={zone.bounds.x + 8}
                      y={zone.bounds.y + 20}
                      className="fill-slate-700 text-[11px] font-semibold"
                      style={{ fontSize: Math.max(10, width / 80) }}
                    >
                      {zone.label}
                    </text>
                  )}
                </g>
              ))}

              {layout.walls.map((wall) => (
                <line
                  key={wall.id}
                  x1={wall.start.x}
                  y1={wall.start.y}
                  x2={wall.end.x}
                  y2={wall.end.y}
                  stroke={WALL_COLOR}
                  strokeWidth={viewMode === "overlay" ? 2 : 3}
                  strokeOpacity={viewMode === "overlay" ? 0.35 : 1}
                  strokeLinecap="round"
                />
              ))}

              {layout.doors.map((door) => (
                <rect
                  key={door.id}
                  x={door.bounds.x}
                  y={door.bounds.y}
                  width={door.bounds.width}
                  height={door.bounds.height}
                  fill={DOOR_COLOR}
                  fillOpacity={0.35}
                  stroke={DOOR_COLOR}
                  strokeWidth={2}
                  rx={2}
                />
              ))}

              {viewMode === "layout" &&
                layout.desks.map((desk) => (
                <g key={desk.id}>
                  {desk.polygon && desk.polygon.length >= 3 ? (
                    <polygon
                      points={desk.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
                      fill={DESK_COLOR}
                      fillOpacity={0.25}
                      stroke={DESK_COLOR}
                      strokeWidth={2}
                      onClick={() => setSelected({ kind: "desk", entity: desk })}
                      className="cursor-pointer"
                    />
                  ) : (
                    <rect
                      x={desk.bounds.x}
                      y={desk.bounds.y}
                      width={desk.bounds.width}
                      height={desk.bounds.height}
                      fill={DESK_COLOR}
                      fillOpacity={0.25}
                      stroke={DESK_COLOR}
                      strokeWidth={2}
                      rx={4}
                      onClick={() => setSelected({ kind: "desk", entity: desk })}
                      className="cursor-pointer"
                    />
                  )}
                  {showLabels && (
                    <text
                      x={desk.bounds.x + desk.bounds.width / 2}
                      y={desk.bounds.y + desk.bounds.height / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-indigo-900 font-medium"
                      style={{ fontSize: Math.max(9, width / 100) }}
                    >
                      {desk.label}
                    </text>
                  )}
                </g>
              ))}

              {layout.seats.map((seat) => (
                <g key={seat.id}>
                  <rect
                    x={seat.bounds.x}
                    y={seat.bounds.y}
                    width={seat.bounds.width}
                    height={seat.bounds.height}
                    fill={SEAT_COLOR}
                    fillOpacity={viewMode === "overlay" ? 0.2 : 0.45}
                    stroke={SEAT_COLOR}
                    strokeWidth={selected?.kind === "seat" && selected.entity.id === seat.id ? 3 : 1.5}
                    strokeOpacity={viewMode === "overlay" ? 0.85 : 1}
                    rx={4}
                    onClick={() => setSelected({ kind: "seat", entity: seat })}
                    className="cursor-pointer"
                  />
                  {showLabels && (
                    <text
                      x={seat.position.x}
                      y={seat.position.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className={viewMode === "overlay" ? "fill-indigo-700 font-bold" : "fill-white font-semibold"}
                      style={{ fontSize: Math.max(8, width / 120) }}
                    >
                      {seat.label.replace("Seat ", "S")}
                    </text>
                  )}
                </g>
              ))}
            </svg>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:col-span-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">Layout summary</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Stat label="Assignable seats" value={layout.stats.assignableSeats} />
            <Stat label="Desks" value={layout.stats.totalDesks} />
            <Stat label="Zones" value={layout.stats.zones} />
            <Stat label="Walls" value={layout.walls.length} />
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => downloadLayoutJson(layout, "employee-app")}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Export for employee app
            </button>
            <button
              type="button"
              onClick={() => downloadLayoutJson(layout, "full")}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Download full layout
            </button>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(integrationJson)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Copy integration JSON
            </button>
          </div>
        </div>

        {selected && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
            <h3 className="text-sm font-semibold text-indigo-900">
              {selected.kind === "seat"
                ? selected.entity.label
                : selected.kind === "desk"
                  ? selected.entity.label
                  : selected.entity.label}
            </h3>
            <dl className="mt-2 space-y-1 text-xs text-indigo-800">
              <Row label="Type" value={selected.kind} />
              {"assignable" in selected.entity && (
                <Row
                  label="Assignable"
                  value={selected.entity.assignable ? "Yes" : "No"}
                />
              )}
              {"deskId" in selected.entity && selected.entity.deskId && (
                <Row label="Desk" value={selected.entity.deskId} />
              )}
              {"zoneId" in selected.entity && selected.entity.zoneId && (
                <Row label="Zone" value={selected.entity.zoneId} />
              )}
              {"seatIds" in selected.entity && (
                <Row label="Seats" value={String(selected.entity.seatIds.length)} />
              )}
            </dl>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Zones & desks</h3>
          <div className="max-h-48 space-y-2 overflow-y-auto text-sm">
            {layout.zones.length === 0 && (
              <p className="text-slate-500">No enclosed zones detected — open floor plan.</p>
            )}
            {layout.zones.map((zone) => (
              <div key={zone.id} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="font-medium text-slate-800">{zone.label}</p>
                <p className="text-xs text-slate-500">
                  {zone.deskIds.length} desks · {zone.seatIds.length} seats
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-900">
          <div className="border-b border-slate-700 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-200">
              Employee app integration payload
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              POST this JSON to your employee management API to create seats and desks.
            </p>
          </div>
          <pre className="max-h-64 overflow-auto p-4 text-xs leading-relaxed text-emerald-400">
            {integrationJson}
          </pre>
        </div>
      </div>
    </div>
  );
}

function ViewToggle({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-2 py-1 text-xs font-medium ${
        active
          ? "bg-indigo-600 text-white"
          : "border border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}
    >
      {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-lg font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
