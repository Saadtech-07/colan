"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ImagePlus,
  Loader2,
  Sparkles,
  Upload,
  Wand2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseApiError } from "@/providers/app-state";
import type { SeatingAiSuggestion } from "@/lib/seating-ai-types";
import { cn } from "@/lib/utils";

function formatAiError(error: unknown): string {
  return error instanceof Error ? error.message : "Generation failed.";
}

const EXAMPLE_PROMPTS = [
  "40-seat coworking floor plan with 4 departments: engineering (left), marketing (center-left), sales (center-right), support (right), 5 rows of 8 desks",
  "32-seat open office with Development and QA clusters in rows A and C",
  "24-seat layout for Design team near row B with collaboration gaps",
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  suggestion: SeatingAiSuggestion | null;
  onGenerateText: (prompt: string) => Promise<void>;
  onGenerateImage: (file: File, prompt?: string) => Promise<void>;
  onBackToColan: () => void;
};

export function SeatingAiPanel({
  open,
  onOpenChange,
  loading,
  suggestion,
  onGenerateText,
  onGenerateImage,
  onBackToColan,
}: Props) {
  const [mode, setMode] = React.useState<"text" | "image">("text");
  const [prompt, setPrompt] = React.useState("");
  const [imagePrompt, setImagePrompt] = React.useState("");
  const [imageName, setImageName] = React.useState<string | null>(null);
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const runText = async () => {
    setError(null);
    try {
      await onGenerateText(prompt);
    } catch (nextError) {
      setError(formatAiError(nextError));
    }
  };

  const runImage = async () => {
    if (!imageFile) {
      setError("Upload a floor plan or seating layout image first.");
      return;
    }
    setError(null);
    try {
      await onGenerateImage(imageFile, imagePrompt.trim() || undefined);
    } catch (nextError) {
      setError(formatAiError(nextError));
    }
  };

  const handleFile = (file: File | null) => {
    if (!file) {
      setImageFile(null);
      setImageName(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please upload a JPEG, PNG, WebP, or GIF image.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      setError("Image must be 6 MB or smaller.");
      return;
    }
    setError(null);
    setImageFile(file);
    setImageName(file.name);
  };

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
            Shows only the desks from your prompt (no Colan pillars or entrance). Seat assignments
            save to the database immediately and appear on team member profiles. The Colan floor
            plan stays as it was until you change seats there.
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
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={mode === "text" ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setMode("text")}
          >
            <Wand2 className="mr-1.5 h-3.5 w-3.5" />
            Text prompt
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "image" ? "default" : "outline"}
            className="rounded-full"
            onClick={() => setMode("image")}
          >
            <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
            Image upload
          </Button>
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
        </div>

        {mode === "text" ? (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="ai-seating-prompt">Describe the layout (not who sits where)</Label>
              <Textarea
                id="ai-seating-prompt"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="e.g. 40-seat coworking with 4 departments, 5 rows of 8 desks…"
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
                  <Sparkles className="h-4 w-4" />
                  Generate blank layout
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Office layout image</Label>
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/80 bg-muted/30 px-6 py-8 text-center",
                  imageFile && "border-violet-500/40 bg-violet-500/5",
                )}
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Upload floor plans or sketches (max 6 MB).
                </p>
                {imageName && <p className="text-xs font-medium text-foreground">{imageName}</p>}
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                >
                  Choose image
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-image-prompt">Optional layout instructions</Label>
              <Input
                id="ai-image-prompt"
                value={imagePrompt}
                onChange={(event) => setImagePrompt(event.target.value)}
                placeholder="e.g. 40 desks in 5 rows, 4 department zones"
                className="rounded-2xl border-border/70"
                disabled={loading}
              />
            </div>
            <Button
              type="button"
              className="rounded-2xl"
              disabled={loading || !imageFile}
              onClick={() => void runImage()}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing image…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate blank layout from image
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
              {suggestion.imageAnalysis && (
                <p className="mt-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Image analysis:</span>{" "}
                  {suggestion.imageAnalysis}
                </p>
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
              {suggestion.strategy.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  {suggestion.strategy.map((line) => (
                    <li key={line}>{line}</li>
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
              {suggestion.layoutSeats.length} desks in this layout. Assignments save to the database
              as you place people. Model: {suggestion.modelUsed}
            </p>

            <Button type="button" variant="outline" className="rounded-2xl" onClick={onBackToColan}>
              Back to Colan arrangement
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export async function requestSeatingAiGeneration(
  payload:
    | { mode: "text"; prompt: string }
    | { mode: "image"; prompt?: string; imageBase64: string; mimeType: string },
): Promise<SeatingAiSuggestion> {
  const res = await fetch("/api/seating/ai-generate", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return (await res.json()) as SeatingAiSuggestion;
}
