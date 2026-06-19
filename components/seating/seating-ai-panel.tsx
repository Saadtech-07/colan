"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ImageUp,
  LayoutGrid,
  Loader2,
  MessageSquareText,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
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
  /** Rendered inside the floor plan card — tighter chrome and option buttons. */
  embedded?: boolean;
};

type GeneratorStep = "choose" | "edit-colan" | "upload-image" | "describe-layout";

const GENERATOR_OPTIONS = [
  {
    id: "edit-colan" as const,
    title: "Edit Colan layout",
    description: "Change the current floor plan with a prompt — swap rows, add pillars, or remove sections.",
    example: 'e.g. "replace A row with B row"',
    icon: LayoutGrid,
    accent: {
      ring: "ring-violet-500/30",
      border: "border-violet-500/35 hover:border-violet-500/60",
      bg: "bg-violet-500/10",
      icon: "text-violet-600 dark:text-violet-300",
      badge: "Current layout",
    },
    requiresColanPrompt: true,
  },
  {
    id: "upload-image" as const,
    title: "Upload layout image",
    description: "Upload a seating diagram and OpenCV detects desks, pillars, aisles, and entrances.",
    example: "PNG, JPG, or WEBP up to 5 MB",
    icon: ImageUp,
    accent: {
      ring: "ring-sky-500/30",
      border: "border-sky-500/35 hover:border-sky-500/60",
      bg: "bg-sky-500/10",
      icon: "text-sky-600 dark:text-sky-300",
      badge: "From image",
    },
    requiresColanPrompt: false,
  },
  {
    id: "describe-layout" as const,
    title: "Describe new layout",
    description: "Describe desks, rows, pillars, and aisles in plain text to generate a blank layout.",
    example: "e.g. 40 seats with 5 columns and 8 rows",
    icon: MessageSquareText,
    accent: {
      ring: "ring-emerald-500/30",
      border: "border-emerald-500/35 hover:border-emerald-500/60",
      bg: "bg-emerald-500/10",
      icon: "text-emerald-600 dark:text-emerald-300",
      badge: "From text",
    },
    requiresColanPrompt: false,
  },
] as const;

const STEP_COPY: Record<
  GeneratorStep,
  { title: string; description: string }
> = {
  choose: {
    title: "Generate blank layout",
    description: "Choose how you want to build or change the seating layout.",
  },
  "edit-colan": {
    title: "Edit Colan layout",
    description: "Describe changes to apply on top of your current Colan floor plan.",
  },
  "upload-image": {
    title: "Upload layout image",
    description: "Upload a seating diagram — OpenCV reads desks, pillars, aisles, and entrances.",
  },
  "describe-layout": {
    title: "Describe new layout",
    description: "Describe the layout structure only — not who sits where.",
  },
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
  embedded = false,
}: Props) {
  const [step, setStep] = React.useState<GeneratorStep>("choose");
  const [prompt, setPrompt] = React.useState("");
  const [colanPrompt, setColanPrompt] = React.useState("");
  const [imageNotes, setImageNotes] = React.useState("");
  const [layoutImage, setLayoutImage] = React.useState<LayoutImagePayload | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const visibleOptions = GENERATOR_OPTIONS.filter(
    (option) => !option.requiresColanPrompt || onApplyColanPrompt,
  );
  const stepCopy = STEP_COPY[step];

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

  React.useEffect(() => {
    if (open) return;
    setStep("choose");
    setError(null);
  }, [open]);

  if (!open) return null;

  const panelBody = (
    <>
      {step !== "choose" && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="-mt-1 h-8 rounded-full gap-1.5 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => {
            setStep("choose");
            setError(null);
          }}
          disabled={loading}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to options
        </Button>
      )}

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

      {step === "choose" && (
        <div className={embedded ? "flex flex-wrap gap-2" : "grid gap-3 sm:grid-cols-3"}>
          {visibleOptions.map((option) => {
            const Icon = option.icon;
            if (embedded) {
              return (
                <Button
                  key={option.id}
                  type="button"
                  variant="outline"
                  disabled={loading}
                  onClick={() => {
                    setStep(option.id);
                    setError(null);
                  }}
                  className={cn(
                    "h-9 rounded-lg gap-2 px-3 text-xs font-medium",
                    option.accent.border,
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", option.accent.icon)} />
                  {option.title}
                </Button>
              );
            }

            return (
              <button
                key={option.id}
                type="button"
                disabled={loading}
                onClick={() => {
                  setStep(option.id);
                  setError(null);
                }}
                className={cn(
                  "group flex h-full flex-col rounded-2xl border bg-background/80 p-4 text-left transition duration-motion ease-motion",
                  "hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2",
                  option.accent.border,
                  option.accent.ring,
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      option.accent.bg,
                    )}
                  >
                    <Icon className={cn("h-5 w-5", option.accent.icon)} />
                  </div>
                  <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {option.accent.badge}
                  </span>
                </div>
                <p className="mt-4 text-sm font-semibold text-foreground">{option.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {option.description}
                </p>
                <p className="mt-3 text-[11px] font-medium text-foreground/70">{option.example}</p>
              </button>
            );
          })}
        </div>
      )}

        {step === "edit-colan" && onApplyColanPrompt && (
          <div className="space-y-4 rounded-2xl border border-violet-500/25 bg-violet-500/5 p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Prompt-based edits</p>
              <p className="text-xs text-muted-foreground">
                Examples: replace A row with B row · create X row between A and B · remove G and E rows.
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
                className="min-h-[120px] rounded-2xl border-border/70"
                disabled={loading}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className="rounded-2xl"
                disabled={loading || colanPrompt.trim().length < 5}
                onClick={() => onApplyColanPrompt(colanPrompt)}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Applying changes…
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Apply changes
                  </>
                )}
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

        {step === "upload-image" && (
          <div className="space-y-4 rounded-2xl border border-sky-500/25 bg-sky-500/5 p-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Floor plan upload</p>
              <p className="text-xs text-muted-foreground">
                If the image shows two layouts side by side, add a note to pick left or right after
                uploading.
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
                    className="max-h-48 w-full max-w-[240px] object-contain"
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
                    className="min-h-[88px] rounded-2xl border-border/70"
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
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-sky-500/40 bg-background/80 px-4 py-10 text-center transition hover:border-sky-500/70 hover:bg-sky-500/5"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                <ImageUp className="h-9 w-9 text-sky-600 dark:text-sky-300" />
                <span className="text-sm font-medium text-foreground">Choose floor plan image</span>
                <span className="text-xs text-muted-foreground">PNG, JPG, WEBP up to 5 MB</span>
              </button>
            )}
          </div>
        )}

        {step === "describe-layout" && (
          <div className="space-y-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4">
            <div className="space-y-2">
              <Label htmlFor="ai-seating-prompt">Layout description</Label>
              <Textarea
                id="ai-seating-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="e.g. 40 seats with 5 columns and 8 rows…"
                className="min-h-[120px] rounded-2xl border-border/70"
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Quick examples</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((example) => (
                  <button
                    key={example}
                    type="button"
                    className="rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-left text-xs text-muted-foreground transition hover:border-emerald-500/40 hover:text-foreground"
                    onClick={() => setPrompt(example)}
                    disabled={loading}
                  >
                    {example}
                  </button>
                ))}
              </div>
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
        )}

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
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-3 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-0.5">
            <p className="text-sm font-semibold text-foreground">{stepCopy.title}</p>
            <p className="text-xs text-muted-foreground">{stepCopy.description}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full"
            onClick={() => onOpenChange(false)}
            aria-label="Close AI panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {panelBody}
      </div>
    );
  }

  return (
    <Card className="border-violet-500/25 bg-gradient-to-br from-violet-500/5 via-card to-card shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-700 dark:text-violet-300">
            <Sparkles className="h-3.5 w-3.5" />
            AI seating assistant
          </div>
          <CardTitle className="text-lg">{stepCopy.title}</CardTitle>
          <CardDescription>{stepCopy.description}</CardDescription>
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

      <CardContent className="space-y-5">{panelBody}</CardContent>
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
