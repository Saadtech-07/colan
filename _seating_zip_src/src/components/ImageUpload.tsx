"use client";

import { useCallback, useRef, useState } from "react";
import type { LayoutAnalysisResult } from "@/lib/types/layout";

interface ImageUploadProps {
  onAnalysisComplete: (result: LayoutAnalysisResult, imageUrl: string) => void;
  onError: (message: string) => void;
  onProcessingStart: () => void;
  onProgress?: (step: string) => void;
  disabled?: boolean;
}

export function ImageUpload({
  onAnalysisComplete,
  onError,
  onProcessingStart,
  onProgress,
  disabled,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");

  const processFile = useCallback(
    async (file: File) => {
      const isImage =
        file.type.startsWith("image/") ||
        /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name);

      if (!isImage) {
        onError("Please upload a valid image file (PNG, JPEG, WebP, or BMP).");
        return;
      }

      setUploading(true);
      setStatus("Starting analysis in background worker...");
      onProcessingStart();

      const imageUrl = URL.createObjectURL(file);

      try {
        const { analyzeFloorPlanFile } = await import("@/lib/opencv/client");
        const result = await analyzeFloorPlanFile(file, (step) => {
          setStatus(step);
          onProgress?.(step);
        });
        onAnalysisComplete(result, imageUrl);
      } catch (error) {
        URL.revokeObjectURL(imageUrl);
        onError(error instanceof Error ? error.message : "Analysis failed");
      } finally {
        setUploading(false);
        setStatus("");
      }
    },
    [onAnalysisComplete, onError, onProcessingStart, onProgress],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragOver(false);
      if (disabled || uploading) return;

      const file = event.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [disabled, uploading, processFile],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled && !uploading) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !uploading && !disabled && inputRef.current?.click()}
      className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
        dragOver
          ? "border-indigo-500 bg-indigo-50"
          : "border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50"
      } ${uploading ? "pointer-events-none opacity-60" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/bmp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processFile(file);
        }}
      />

      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100">
        <svg
          className="h-7 w-7 text-indigo-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>

      <h3 className="text-lg font-semibold text-slate-900">
        {uploading ? "Analyzing floor plan..." : "Upload office floor plan"}
      </h3>
      <p className="mt-2 text-sm text-slate-500">
        Drag and drop or click to browse. PNG, JPEG, WebP, or BMP up to 15 MB.
      </p>

      {uploading && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-center gap-2 text-sm text-indigo-600">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            Processing in background — page stays responsive
          </div>
          {status && (
            <p className="mx-auto max-w-md truncate text-xs text-slate-500">{status}</p>
          )}
        </div>
      )}
    </div>
  );
}
