"use client";

import * as React from "react";
import { AlertTriangle, ArrowLeft, Loader2, Sparkles, Wand2, X } from "lucide-react";
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
  "20 seats in 4 rows of 5, with a pillar in the middle",
  "30 seats in a U-shape arrangement with an aisle in the center",
  "16 seats in 2 clusters of 8, facing each other with aisle between",
  "24 seats in a boardroom style around a central conference table",
  "40 seats in 5 rows of 8, two pillars between rows 2 and 3",
  "12 seats along window with 8 seats in center island",
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  suggestion: SeatingAiSuggestion | null;
  onGenerateText: (prompt: string) => Promise<void>;
  onBackToColan: () => void;
};

export function SeatingAiPanel({
  open,
  onOpenChange,
  loading,
  suggestion,
  onGenerateText,
  onBackToColan,
}: Props) {
  const [prompt, setPrompt] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const runText = async () => {
    setError(null);
    try {
      await onGenerateText(prompt);
    } catch (nextError) {
      setError(formatAiError(nextError));
    }
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
            Describe desks, rows, pillars, and aisles — the AI builds a precise floor plan with
            coordinates. Seat assignments save to the database as you place people.
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

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="ai-seating-prompt">Describe the layout (not who sits where)</Label>
            <Textarea
              id="ai-seating-prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="e.g. 20 seats in 4 rows of 5, with a pillar in the middle…"
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

export async function requestSeatingAiGeneration(payload: {
  mode: "text";
  prompt: string;
}): Promise<SeatingAiSuggestion> {
  const res = await fetch("/api/seating/ai-generate", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseApiError(res));
  return (await res.json()) as SeatingAiSuggestion;
}
