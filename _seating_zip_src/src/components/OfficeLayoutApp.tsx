"use client";

import { useCallback, useEffect, useState } from "react";
import { GeneratedLayoutViewer } from "@/components/GeneratedLayoutViewer";
import { ImageUpload } from "@/components/ImageUpload";
import { ProcessingPipeline } from "@/components/ProcessingPipeline";
import { getLastWarmupError, preloadAnalysisWorker } from "@/lib/opencv/client";
import { generateOfficeLayout } from "@/lib/layout/generate-office-layout";
import type { LayoutAnalysisResult } from "@/lib/types/layout";
import type { OfficeLayout } from "@/lib/types/office-layout";

type PipelineStep = "upload" | "opencv" | "detection" | "layout" | "viewer";
type EngineStatus = "loading" | "ready" | "failed";

export function OfficeLayoutApp() {
  const [step, setStep] = useState<PipelineStep>("upload");
  const [result, setResult] = useState<LayoutAnalysisResult | null>(null);
  const [layout, setLayout] = useState<OfficeLayout | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [engineStatus, setEngineStatus] = useState<EngineStatus>("loading");
  const [engineError, setEngineError] = useState<string | null>(null);

  useEffect(() => {
    preloadAnalysisWorker().then((ok) => {
      setEngineStatus(ok ? "ready" : "failed");
      setEngineError(ok ? null : getLastWarmupError());
    });
  }, []);

  const handleProcessingStart = useCallback(() => {
    setError(null);
    setResult(null);
    setLayout(null);
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setStep("opencv");
  }, [imageUrl]);

  const handleProgress = useCallback((step: string) => {
    if (step.includes("contour") || step.includes("Hough") || step.includes("Wall")) {
      setStep("detection");
    } else if (step.includes("Final object")) {
      setStep("layout");
    }
  }, []);

  const handleAnalysisComplete = useCallback(
    (analysis: LayoutAnalysisResult, url: string) => {
      const generated = generateOfficeLayout(analysis);
      setResult(analysis);
      setLayout(generated);
      setImageUrl(url);
      setStep("viewer");
      setEngineStatus("ready");
    },
    [],
  );

  const handleError = useCallback((message: string) => {
    setError(message);
    setStep("upload");
  }, []);

  const handleReset = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setResult(null);
    setLayout(null);
    setImageUrl(null);
    setError(null);
    setStep("upload");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-600">Office Layout Generator</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              Generate office layout from floor plan
            </h1>
            <p className="mt-2 max-w-2xl text-slate-600">
              Upload a floor plan image to analyze the space and generate an exact
              office layout with zones, desks, and assignable seats — ready to plug
              into your employee management app.
            </p>
            {engineStatus === "loading" && (
              <p className="mt-1 text-sm text-indigo-600">
                Preloading analysis engine in background — you can upload anytime.
              </p>
            )}
            {engineStatus === "ready" && (
              <p className="mt-1 text-sm text-emerald-600">Analysis engine ready.</p>
            )}
            {engineStatus === "failed" && (
              <p className="mt-1 text-sm text-amber-600">
                Engine preload failed — upload will retry loading OpenCV automatically.
                {engineError ? ` (${engineError})` : null}
              </p>
            )}
          </div>
          {layout && (
            <button
              type="button"
              onClick={handleReset}
              className="shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Analyze another plan
            </button>
          )}
        </div>
      </header>

      <ProcessingPipeline currentStep={step} processing={result?.processing} />

      {error && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mt-6">
        {!layout ? (
          <ImageUpload
            onAnalysisComplete={handleAnalysisComplete}
            onError={handleError}
            onProcessingStart={handleProcessingStart}
            onProgress={handleProgress}
            disabled={step !== "upload" && step !== "opencv"}
          />
        ) : (
          imageUrl && (
            <GeneratedLayoutViewer layout={layout} imageUrl={imageUrl} />
          )
        )}
      </div>

      {!layout && (
        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "Floor plan analysis",
              body: "OpenCV detects walls, rooms, desks, and seats from your uploaded image.",
            },
            {
              title: "Generated layout",
              body: "Builds zones, desks, and assignable seats positioned exactly on the plan.",
            },
            {
              title: "Employee app ready",
              body: "Export or copy integration JSON with seat IDs, desk mapping, and coordinates.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h3 className="font-semibold text-slate-900">{card.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{card.body}</p>
            </div>
          ))}
          <div className="sm:col-span-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
            Try the included sample:{" "}
            <a
              href="/sample-floor-plan.png"
              download
              className="font-medium underline hover:text-indigo-600"
            >
              sample-floor-plan.png
            </a>
          </div>
        </section>
      )}
    </div>
  );
}
