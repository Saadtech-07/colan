import "server-only";

import { SYSTEM_PROMPT, buildUserPrompt } from "@/lib/seating-layout-prompts";
import type { AILayoutSchema, GeneratedSeatingLayout } from "@/lib/seating-layout-types";
import type { SeatingAiSuggestion } from "@/lib/seating-ai-types";

const OPENROUTER_MODELS = [
  "meta-llama/llama-3.3-70b-instruct:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "openai/gpt-oss-20b:free",
  "nousresearch/hermes-3-llama-3.1-405b:free",
] as const;

export class SeatingAiGenerationError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "SeatingAiGenerationError";
    this.status = status;
  }
}

function extractJSON(raw: string): string {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return raw.slice(start, end + 1).trim();
  return raw.trim();
}

function labelBySeatId(layout: GeneratedSeatingLayout): Map<string, string> {
  const map = new Map<string, string>();
  for (const seat of layout.seats) {
    map.set(seat.id, seat.label);
  }
  return map;
}

function layoutToSuggestion(
  layout: GeneratedSeatingLayout,
  modelUsed: string,
  description: string,
): SeatingAiSuggestion {
  const layoutSeats = layout.seats.map((seat) => seat.label);
  const idToLabel = labelBySeatId(layout);

  const zones =
    layout.groups && layout.groups.length > 0
      ? layout.groups.map((group) => ({
          id: group.id,
          label: group.name,
          seatIds: group.seatIds
            .map((seatId) => idToLabel.get(seatId))
            .filter((label): label is string => Boolean(label)),
        }))
      : [
          {
            id: "layout",
            label: layout.name || "Generated layout",
            seatIds: layoutSeats,
          },
        ];

  return {
    summary: layout.name || "Generated layout",
    description,
    strategy: description ? [description] : [],
    layoutSeats,
    zones,
    layout,
    assignments: [],
    warnings: [],
    modelUsed,
  };
}

async function callOpenRouterModel(
  apiKey: string,
  model: string,
  prompt: string,
): Promise<{ aiData: AILayoutSchema; raw: string }> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXTAUTH_URL ?? "http://localhost:3000",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(prompt) },
      ],
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const message =
      (errBody as { error?: { message?: string } })?.error?.message ?? res.statusText;
    throw new SeatingAiGenerationError(message, res.status);
  }

  const data = await res.json();
  const raw: string = data?.choices?.[0]?.message?.content ?? "";
  if (!raw) {
    throw new SeatingAiGenerationError(`Empty response from ${model}`);
  }

  const text = extractJSON(raw);
  const aiData: AILayoutSchema = JSON.parse(text);
  if (!aiData.seats?.length) {
    throw new SeatingAiGenerationError(`No seats in layout returned by ${model}`);
  }

  return { aiData, raw };
}

export async function generateSeatingFromTextPrompt(input: {
  prompt: string;
}): Promise<SeatingAiSuggestion> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new SeatingAiGenerationError("OPENROUTER_API_KEY not configured.", 503);
  }

  let lastError = "";

  for (const model of OPENROUTER_MODELS) {
    try {
      const { aiData } = await callOpenRouterModel(apiKey, model, input.prompt);

      const layout: GeneratedSeatingLayout = {
        id: `layout_${Date.now()}`,
        name: aiData.name || "Office Layout",
        prompt: input.prompt,
        room: aiData.room,
        seats: aiData.seats.map((seat) => ({ ...seat, status: "empty" as const })),
        pillars: aiData.pillars || [],
        walls: aiData.walls || [],
        groups: aiData.groups || [],
        createdAt: new Date().toISOString(),
      };

      return layoutToSuggestion(
        layout,
        model,
        aiData.description || "AI-generated seating layout.",
      );
    } catch (error) {
      if (error instanceof SyntaxError) {
        lastError = `Failed to parse JSON from ${model}`;
      } else {
        lastError = error instanceof Error ? error.message : "Unknown model error";
      }
      console.warn(`Seating AI model ${model} failed: ${lastError}`);
    }
  }

  throw new SeatingAiGenerationError(`All models failed. Last error: ${lastError}`, 500);
}
