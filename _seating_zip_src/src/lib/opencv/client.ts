"use client";

import type { LayoutAnalysisResult } from "@/lib/types/layout";

type WorkerOutMessage =
  | { type: "warmup-done"; ok: boolean; error?: string }
  | { id: number; type: "progress"; step: string }
  | { id: number; type: "result"; result: LayoutAnalysisResult }
  | { id: number; type: "error"; error: string };

type PendingJob = {
  resolve: (result: LayoutAnalysisResult) => void;
  reject: (error: Error) => void;
  onProgress?: (step: string) => void;
};

// OpenCV.js is ~11 MB; first download + WASM init often exceeds 30 s.
const WARMUP_TIMEOUT_MS = 120_000;

let worker: Worker | null = null;
let jobCounter = 0;
let warmupPromise: Promise<boolean> | null = null;
let warmupComplete = false;
let warmupSucceeded = false;
let lastWarmupError: string | null = null;
const pendingJobs = new Map<number, PendingJob>();
const warmupWaiters: Array<(ok: boolean) => void> = [];

function resetWarmupState() {
  warmupComplete = false;
  warmupSucceeded = false;
  warmupPromise = null;
  lastWarmupError = null;
}

function resolveWarmup(ok: boolean) {
  warmupComplete = true;
  warmupSucceeded = ok;
  for (const waiter of warmupWaiters) waiter(ok);
  warmupWaiters.length = 0;
}

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./analyze.worker.ts", import.meta.url));

    worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
      const message = event.data;

      if (message.type === "warmup-done") {
        lastWarmupError = message.error ?? null;
        resolveWarmup(message.ok);
        return;
      }

      const job = pendingJobs.get(message.id);
      if (!job) return;

      if (message.type === "progress") {
        job.onProgress?.(message.step);
        return;
      }

      pendingJobs.delete(message.id);

      if (message.type === "error") {
        job.reject(new Error(message.error));
        return;
      }

      job.resolve(message.result);
    };

    worker.onerror = (event: ErrorEvent) => {
      lastWarmupError = event.message || "OpenCV worker crashed";
      resolveWarmup(false);
      for (const [id, job] of pendingJobs) {
        job.reject(new Error(lastWarmupError));
        pendingJobs.delete(id);
      }
    };
  }

  return worker;
}

function startWarmup(): Promise<boolean> {
  resetWarmupState();

  warmupPromise = new Promise<boolean>((resolve) => {
    warmupWaiters.push(resolve);
    getWorker().postMessage({ type: "warmup" });

    setTimeout(() => {
      if (!warmupComplete) {
        resolveWarmup(false);
      }
    }, WARMUP_TIMEOUT_MS);
  });

  return warmupPromise;
}

export function getLastWarmupError(): string | null {
  return lastWarmupError;
}

export function preloadAnalysisWorker(): Promise<boolean> {
  if (warmupComplete) {
    return Promise.resolve(warmupSucceeded);
  }

  if (!warmupPromise) {
    return startWarmup();
  }

  return warmupPromise;
}

export async function analyzeFloorPlanFile(
  file: File,
  onProgress?: (step: string) => void,
): Promise<LayoutAnalysisResult> {
  onProgress?.("Loading OpenCV engine...");
  let ready = await preloadAnalysisWorker();

  if (!ready) {
    onProgress?.("Retrying OpenCV engine load...");
    getWorker().postMessage({ type: "reset" });
    ready = await startWarmup();
    if (!ready) {
      throw new Error(
        lastWarmupError ??
          "Could not load OpenCV.js. Refresh the page and ensure /opencv.js is reachable.",
      );
    }
  }

  onProgress?.("Reading image file...");
  const buffer = await file.arrayBuffer();
  const dataCopy = new Uint8Array(buffer);
  const id = ++jobCounter;

  return new Promise((resolve, reject) => {
    pendingJobs.set(id, { resolve, reject, onProgress });

    getWorker().postMessage(
      { id, data: dataCopy, filename: file.name },
      [dataCopy.buffer],
    );
  });
}

export type { LayoutAnalysisResult };
