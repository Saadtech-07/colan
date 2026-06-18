"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  OBJECT_COLORS,
  OBJECT_LABELS,
  type LayoutAnalysisResult,
  type LayoutObject,
  type LayoutObjectType,
} from "@/lib/types/layout";

interface LayoutViewerProps {
  result: LayoutAnalysisResult;
  imageUrl: string;
}

export function LayoutViewer({ result, imageUrl }: LayoutViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleTypes, setVisibleTypes] = useState<Set<LayoutObjectType>>(
    () => new Set(Object.keys(OBJECT_LABELS) as LayoutObjectType[]),
  );

  const counts = useMemo(() => {
    const map = {} as Record<LayoutObjectType, number>;
    for (const obj of result.objects) {
      map[obj.type] = (map[obj.type] ?? 0) + 1;
    }
    return map;
  }, [result.objects]);

  const filteredObjects = useMemo(
    () => result.objects.filter((obj) => visibleTypes.has(obj.type)),
    [result.objects, visibleTypes],
  );

  const fitToContainer = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth } = containerRef.current;
    const padding = 32;
    const available = clientWidth - padding;
    setScale(Math.min(1, available / result.image.width));
  }, [result.image.width]);

  useEffect(() => {
    fitToContainer();
    window.addEventListener("resize", fitToContainer);
    return () => window.removeEventListener("resize", fitToContainer);
  }, [fitToContainer]);

  const toggleType = (type: LayoutObjectType) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const selected = result.objects.find((o) => o.id === selectedId);

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Layout Viewer</h2>
          <div className="flex items-center gap-2">
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
          className="overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-4"
        >
          <div
            className="relative mx-auto origin-top-left"
            style={{
              width: result.image.width * scale,
              height: result.image.height * scale,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Floor plan"
              className="block h-full w-full"
              draggable={false}
            />
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox={`0 0 ${result.image.width} ${result.image.height}`}
              preserveAspectRatio="none"
            >
              {filteredObjects.map((obj) => (
                <ObjectOverlay
                  key={obj.id}
                  obj={obj}
                  selected={selectedId === obj.id}
                  onSelect={() => setSelectedId(obj.id === selectedId ? null : obj.id)}
                />
              ))}
            </svg>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(OBJECT_LABELS) as LayoutObjectType[]).map((type) => {
            const count = counts[type] ?? 0;
            if (count === 0) return null;
            const visible = visibleTypes.has(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  visible
                    ? "bg-white shadow-sm ring-1 ring-slate-200"
                    : "bg-slate-100 text-slate-400 line-through"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: OBJECT_COLORS[type] }}
                />
                {OBJECT_LABELS[type]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:col-span-2">
        {selected && (
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
            <h3 className="text-sm font-semibold text-indigo-900">
              {OBJECT_LABELS[selected.type]}
            </h3>
            <dl className="mt-2 space-y-1 text-xs text-indigo-800">
              <div className="flex justify-between">
                <dt>Confidence</dt>
                <dd>{(selected.confidence * 100).toFixed(0)}%</dd>
              </div>
              <div className="flex justify-between">
                <dt>Position</dt>
                <dd>
                  ({selected.bbox.x}, {selected.bbox.y})
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Size</dt>
                <dd>
                  {selected.bbox.width} × {selected.bbox.height}
                </dd>
              </div>
            </dl>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-200">Layout JSON</h3>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(JSON.stringify(result, null, 2))}
              className="rounded-lg bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
            >
              Copy
            </button>
          </div>
          <pre className="flex-1 overflow-auto p-4 text-xs leading-relaxed text-emerald-400">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Detection Summary</h3>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(OBJECT_LABELS) as LayoutObjectType[]).map((type) => (
              <div
                key={type}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
              >
                <span className="flex items-center gap-2 text-slate-600">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: OBJECT_COLORS[type] }}
                  />
                  {OBJECT_LABELS[type]}
                </span>
                <span className="font-semibold text-slate-900">{counts[type] ?? 0}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Total: {result.objects.length} objects detected
          </p>
        </div>
      </div>
    </div>
  );
}

function ObjectOverlay({
  obj,
  selected,
  onSelect,
}: {
  obj: LayoutObject;
  selected: boolean;
  onSelect: () => void;
}) {
  const color = OBJECT_COLORS[obj.type];
  const { x, y, width, height } = obj.bbox;

  if (obj.polygon && obj.polygon.length === 2 && obj.type === "wall") {
    const [p1, p2] = obj.polygon;
    return (
      <line
        x1={p1.x}
        y1={p1.y}
        x2={p2.x}
        y2={p2.y}
        stroke={color}
        strokeWidth={selected ? 4 : 2}
        strokeOpacity={selected ? 1 : 0.85}
        onClick={onSelect}
        className="cursor-pointer"
      />
    );
  }

  if (obj.polygon && obj.polygon.length >= 3) {
    const points = obj.polygon.map((p) => `${p.x},${p.y}`).join(" ");
    return (
      <polygon
        points={points}
        fill={color}
        fillOpacity={selected ? 0.35 : 0.2}
        stroke={color}
        strokeWidth={selected ? 3 : 1.5}
        onClick={onSelect}
        className="cursor-pointer"
      />
    );
  }

  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={color}
      fillOpacity={selected ? 0.35 : 0.2}
      stroke={color}
      strokeWidth={selected ? 3 : 1.5}
      rx={obj.type === "seat" ? 4 : 2}
      onClick={onSelect}
      className="cursor-pointer"
    />
  );
}
