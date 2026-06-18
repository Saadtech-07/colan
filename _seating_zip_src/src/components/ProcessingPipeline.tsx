"use client";

import {
  OBJECT_COLORS,
  OBJECT_LABELS,
  type LayoutAnalysisResult,
  type LayoutObjectType,
} from "@/lib/types/layout";

type PipelineStep = "upload" | "opencv" | "detection" | "layout" | "viewer";

interface ProcessingPipelineProps {
  currentStep: PipelineStep;
  processing?: LayoutAnalysisResult["processing"];
}

const STEPS: { id: PipelineStep; label: string; description: string }[] = [
  { id: "upload", label: "Image Upload", description: "Floor plan received" },
  { id: "opencv", label: "OpenCV Processing", description: "Grayscale, threshold, morphology" },
  { id: "detection", label: "Object Detection", description: "Contours, Hough lines & circles" },
  { id: "layout", label: "Layout Generation", description: "Zones, desks & seats built" },
  { id: "viewer", label: "Generated Layout", description: "Interactive office layout" },
];

const STEP_ORDER: PipelineStep[] = ["upload", "opencv", "detection", "layout", "viewer"];

function stepIndex(step: PipelineStep): number {
  return STEP_ORDER.indexOf(step);
}

export function ProcessingPipeline({ currentStep, processing }: ProcessingPipelineProps) {
  const currentIdx = stepIndex(currentStep);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
        Processing Pipeline
      </h2>

      <div className="flex flex-col gap-0 sm:flex-row sm:items-start sm:justify-between">
        {STEPS.map((step, index) => {
          const done = index < currentIdx;
          const active = index === currentIdx;
          const pending = index > currentIdx;

          return (
            <div key={step.id} className="flex flex-1 items-start gap-3 sm:flex-col sm:items-center sm:text-center">
              <div className="flex items-center gap-3 sm:flex-col">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    done
                      ? "bg-emerald-500 text-white"
                      : active
                        ? "bg-indigo-600 text-white ring-4 ring-indigo-100"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {done ? "✓" : index + 1}
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`hidden h-0.5 flex-1 sm:block sm:h-px sm:w-full ${
                      done ? "bg-emerald-400" : "bg-slate-200"
                    }`}
                  />
                )}
              </div>
              <div className="pb-4 sm:pb-0">
                <p
                  className={`text-sm font-medium ${
                    pending ? "text-slate-400" : active ? "text-indigo-700" : "text-slate-800"
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-xs text-slate-500">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>

      {processing && (
        <div className="mt-4 rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-600">
            Completed in {processing.durationMs}ms using{" "}
            <code className="rounded bg-slate-200 px-1">{processing.method}</code>
          </p>
          <ul className="mt-2 max-h-24 overflow-y-auto text-xs text-slate-500">
            {processing.steps.map((step) => (
              <li key={step} className="flex items-start gap-1.5 py-0.5">
                <span className="text-emerald-500">•</span>
                {step}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ObjectLegend({
  visibleTypes,
  counts,
  onToggle,
}: {
  visibleTypes: Set<LayoutObjectType>;
  counts: Record<LayoutObjectType, number>;
  onToggle: (type: LayoutObjectType) => void;
}) {
  const types = Object.keys(OBJECT_LABELS) as LayoutObjectType[];

  return (
    <div className="flex flex-wrap gap-2">
      {types.map((type) => {
        const visible = visibleTypes.has(type);
        const count = counts[type] ?? 0;
        if (count === 0) return null;

        return (
          <button
            key={type}
            type="button"
            onClick={() => onToggle(type)}
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
  );
}
