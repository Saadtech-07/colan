"use client";

import * as React from "react";
import { AlertTriangle, ArrowLeft, ImageUp, Loader2, Sparkles, Wand2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseApiError } from "@/providers/app-state";
import type { SeatingAiSuggestion } from "@/lib/seating-ai-types";

function formatAiError(error: unknown): string {
  return error instanceof Error ? error.message : "Generation failed.";
}

const EXAMPLE_PROMPTS = [
  "40 seats with 5 columns and 8 rows",
  "replace A row with B row",
  "create X row between A and B with 2 pillars",
  "add 4 pillars in A row",
  "remove 2 pillars in B row",
  "remove the pillars in E rows",
  "add 8 seats to B row",
  "20 seats in 4 rows of 5, with a pillar in the middle",
  "30 seats in a U-shape arrangement with an aisle in the center",
  "16 seats in 2 clusters of 8, facing each other with aisle between",
  "24 seats in a boardroom style around a central conference table",
  "40 seats in 5 rows of 8, two pillars between rows 2 and 3",
  "12 seats along window with 8 seats in center island",
];

const MAX_LAYOUT_IMAGE_BYTES = 5 * 1024 * 1024;

const ACCEPTED_LAYOUT_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

type LayoutImagePayload = {
  imageBase64: string;
  mimeType: string;
  fileName: string;
  previewUrl: string;
};

async function readLayoutImage(file: File): Promise<LayoutImagePayload> {
  if (!ACCEPTED_LAYOUT_IMAGE_TYPES.has(file.type)) {
    throw new Error("Upload a PNG, JPG, WEBP, or GIF floor plan image.");
  }
  if (file.size > MAX_LAYOUT_IMAGE_BYTES) {
    throw new Error("Image must be 5 MB or smaller.");
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.readAsDataURL(file);
  });

  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid image data.");
  }

  return {
    mimeType: match[1],
    imageBase64: match[2],
    fileName: file.name,
    previewUrl: dataUrl,
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  suggestion: SeatingAiSuggestion | null;
  onGenerateText: (prompt: string) => Promise<void>;
  onGenerateImage: (payload: {
    imageBase64: string;
    mimeType: string;
    notes?: string;
    fileName?: string;
  }) => Promise<void>;
  onBackToColan: () => void;
  onApplyColanPrompt?: (prompt: string) => void;
  colanPromptSummary?: string | null;
  colanPromptWarnings?: string[];
};

export function SeatingAiPanel({
  open,
  onOpenChange,
  loading,
  suggestion,
  onGenerateText,
  onGenerateImage,
  onBackToColan,
  onApplyColanPrompt,
  colanPromptSummary = null,
  colanPromptWarnings = [],
}: Props) {
  const [prompt, setPrompt] = React.useState("");
  const [colanPrompt, setColanPrompt] = React.useState("");
  const [imageNotes, setImageNotes] = React.useState("");
  const [layoutImage, setLayoutImage] = React.useState<LayoutImagePayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const runText = async () => {
    setError(null);
    try {
      await onGenerateText(prompt);
    } catch (nextError) {
      setError(formatAiError(nextError));
    }
  };

  const runImage = async () => {
    if (!layoutImage) return;
    setError(null);
    try {
      await onGenerateImage({
        imageBase64: layoutImage.imageBase64,
        mimeType: layoutImage.mimeType,
        notes: imageNotes.trim() || undefined,
        fileName: layoutImage.fileName,
      });
    } catch (nextError) {
      setError(formatAiError(nextError));
    }
  };

  const onImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    try {
      const next = await readLayoutImage(file);
      setLayoutImage(next);
    } catch (nextError) {
      setError(formatAiError(nextError));
    }
  };

  React.useEffect(() => {
    if (!open) return;
    void import("@/lib/opencv/client").then(({ preloadAnalysisWorker }) =>
      preloadAnalysisWorker(),
    );
  }, [open]);

  if (!open) return null;

  return (
    <Card className="border-violet-500/25 bg-gradient-to-br from-violet-500/5 via-card to-card shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300">
            <Sparkles className="h-3.5 w-3.5" />
            AI seating assistant
          </div>
          <CardTitle className="text-lg">Generate blank layout</CardTitle>
          <CardDescription>
            Upload a floor plan image or describe desks, rows, pillars, and aisles — the AI builds a
            precise layout with coordinates.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 rounded-full"
          onClick={() => onOpenChange(false)}
          aria-label="Close AI panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-5">
        {suggestion && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="rounded-full gap-1.5"
            onClick={onBackToColan}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Colan arrangement
          </Button>
        )}

        {onApplyColanPrompt && (
          <div className="space-y-4 rounded-2xl border border-border/70 bg-background/70 p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Edit Colan layout (prompt)</p>
              <p className="text-xs text-muted-foreground">
                Examples: replace A row with B row (swaps layouts + assignments) · create X row between A and B · remove G and E rows.
                Each prompt builds on your current layout.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="colan-layout-prompt">Describe the changes</Label>
              <Textarea
                id="colan-layout-prompt"
                value={colanPrompt}
                onChange={(event) => setColanPrompt(event.target.value)}
                placeholder='e.g. "replace A row with B row"'
                className="min-h-[96px] rounded-2xl border-border/70"
                disabled={loading}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-2xl"
                disabled={loading || colanPrompt.trim().length < 5}
                onClick={() => onApplyColanPrompt(colanPrompt)}
              >
                Apply changes
              </Button>
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => setColanPrompt("")}
                disabled={loading}
              >
                Clear
              </button>
            </div>

            {colanPromptSummary && (
              <div className="rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                {colanPromptSummary}
              </div>
            )}
            {colanPromptWarnings.length > 0 && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
                {colanPromptWarnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="space-y-4 rounded-2xl border border-border/70 bg-background/70 p-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Upload layout image</p>
            <p className="text-xs text-muted-foreground">
              Upload a seating diagram (PNG, JPG, WEBP). OpenCV.js detects desks, pillars, aisles,
              and entrances locally and builds a matching layout. If the image shows two options side
              by side, add a note to pick left or right.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
            className="hidden"
            onChange={(event) => void onImageSelected(event)}
            disabled={loading}
          />

          {layoutImage ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="overflow-hidden rounded-2xl border border-border/70 bg-white p-2 dark:bg-zinc-950">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={layoutImage.previewUrl}
                  alt="Uploaded floor plan preview"
                  className="max-h-40 w-full max-w-[220px] object-contain"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="truncate text-xs font-medium text-foreground">{layoutImage.fileName}</p>
                <Label htmlFor="layout-image-notes">Optional notes</Label>
                <Textarea
                  id="layout-image-notes"
                  value={imageNotes}
                  onChange={(event) => setImageNotes(event.target.value)}
                  placeholder='e.g. "Use the right layout with the center aisle"'
                  className="min-h-[72px] rounded-2xl border-border/70"
                  disabled={loading}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className="rounded-2xl"
                    disabled={loading}
                    onClick={() => void runImage()}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Reading layout…
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4" />
                        Generate from image
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-2xl"
                    disabled={loading}
                    onClick={() => {
                      setLayoutImage(null);
                      setImageNotes("");
                    }}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center transition hover:border-violet-500/40 hover:bg-violet-500/5"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              <ImageUp className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Choose floor plan image</span>
              <span className="text-xs text-muted-foreground">PNG, JPG, WEBP up to 5 MB</span>
            </button>
          )}
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="ai-seating-prompt">Describe the layout (not who sits where)</Label>
            <Textarea
              id="ai-seating-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="e.g. 40 seats with 5 columns and 8 rows…"
              className="min-h-[120px] rounded-2xl border-border/70"
              disabled={loading}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((example) => (
              <button
                key={example}
                type="button"
                className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-left text-xs text-muted-foreground transition hover:border-violet-500/40 hover:text-foreground"
                onClick={() => setPrompt(example)}
                disabled={loading}
              >
                {example}
              </button>
            ))}
          </div>
          <Button
            type="button"
            className="rounded-2xl"
            disabled={loading || prompt.trim().length < 10}
            onClick={() => void runText()}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Building layout…
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                Generate blank layout
              </>
            )}
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {suggestion && (
          <div className="space-y-4 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
            <div>
              <p className="text-sm font-semibold text-foreground">{suggestion.summary}</p>
              {suggestion.description && (
                <p className="mt-2 text-xs text-muted-foreground">{suggestion.description}</p>
              )}
              {suggestion.zones.length > 0 && (
                <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                  {suggestion.zones.map((zone) => (
                    <li key={zone.id} className="rounded-lg border border-border/60 bg-background/80 px-3 py-2">
                      <span className="font-medium text-foreground">{zone.label}</span>
                      <span className="ml-2 tabular-nums">({zone.seatIds.length} desks)</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {suggestion.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
                {suggestion.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              {suggestion.layoutSeats.length} desks in this layout. Model: {suggestion.modelUsed}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export async function requestSeatingAiGeneration(
  payload:
    | { mode: "text"; prompt: string }
    | {
        mode: "image";
        imageBase64: string;
        mimeType: string;
        notes?: string;
        fileName?: string;
      },
): Promise<SeatingAiSuggestion> {
  if (payload.mode === "image") {
    return requestSeatingOpenCvGeneration(payload);
  }

  const res = await fetch("/api/seating/ai-generate", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return (await res.json()) as SeatingAiSuggestion;
}

async function requestSeatingOpenCvGeneration(payload: {
  imageBase64: string;
  mimeType: string;
  notes?: string;
  fileName?: string;
}): Promise<SeatingAiSuggestion> {
  const binary = atob(payload.imageBase64.replace(/^data:[^;]+;base64,/, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const file = new File([bytes], payload.fileName ?? "upload.png", {
    type: payload.mimeType,
  });

  const { analyzeFloorPlanFile } = await import("@/lib/opencv/client");
  const { buildSuggestionFromOpenCvAnalysis } = await import("@/lib/opencv-layout-suggestion");

  const analysis = await analyzeFloorPlanFile(file);
  return buildSuggestionFromOpenCvAnalysis(analysis, {
    notes: payload.notes,
    fileName: payload.fileName,
  });
}
