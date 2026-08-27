/// <reference lib="webworker" />

import { analyzeFloorPlanCore } from "@/lib/opencv/analyzer-core";
import { getOpenCVWorker, resetOpenCVWorker } from "@/lib/opencv/worker-init";
import type { LayoutAnalysisResult } from "@/lib/opencv-types/layout";

type WorkerRequest =
  | { type: "warmup" }
  | { type: "reset" }
  | { id: number; data: Uint8Array; filename?: string };

type WorkerResponse =
  | { type: "warmup-done"; ok: boolean; error?: string }
  | { id: number; type: "progress"; step: string }
  | { id: number; type: "result"; result: LayoutAnalysisResult }
  | { id: number; type: "error"; error: string };

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  if ("type" in event.data && event.data.type === "reset") {
    resetOpenCVWorker();
    return;
  }

  if ("type" in event.data && event.data.type === "warmup") {
    try {
      await getOpenCVWorker();
      ctx.postMessage({ type: "warmup-done", ok: true } satisfies WorkerResponse);
    } catch (error) {
      resetOpenCVWorker();
      ctx.postMessage({
        type: "warmup-done",
        ok: false,
        error: error instanceof Error ? error.message : "Warmup failed",
      } satisfies WorkerResponse);
    }
    return;
  }

  const { id, data, filename } = event.data as Extract<
    WorkerRequest,
    { id: number }
  >;

  try {
    const cv = await getOpenCVWorker();
    ctx.postMessage({
      id,
      type: "progress",
      step: "OpenCV ready — analyzing layout",
    } satisfies WorkerResponse);

    const result = await analyzeFloorPlanCore(cv, data, filename, (step) => {
      ctx.postMessage({ id, type: "progress", step } satisfies WorkerResponse);
    });

    ctx.postMessage({ id, type: "result", result } satisfies WorkerResponse);
  } catch (error) {
    resetOpenCVWorker();
    ctx.postMessage({
      id,
      type: "error",
      error: error instanceof Error ? error.message : "Analysis failed",
    } satisfies WorkerResponse);
  }
};

export {};
