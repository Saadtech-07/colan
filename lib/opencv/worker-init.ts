import { loadOpenCV } from "@opencvjs/worker";
import type { CV } from "@/lib/opencv/mat-utils";

let cvPromise: Promise<CV> | null = null;

export function getOpenCVWorker(): Promise<CV> {
  if (!cvPromise) {
    cvPromise = loadOpenCV() as Promise<CV>;
  }
  return cvPromise;
}

export function resetOpenCVWorker(): void {
  cvPromise = null;
}
