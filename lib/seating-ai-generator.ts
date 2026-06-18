import "server-only";

import { parseRobustJsonObject } from "@/lib/seating-ai-json";
import {
  getOpenRouterApiKey,
  getSeatingAiProviderOrder,
  type SeatingAiProvider,
} from "@/lib/openai-env";
import { SYSTEM_PROMPT, buildImageLayoutFromDescriptionPrompt, buildImageUserPrompt, buildUserPrompt } from "@/lib/seating-layout-prompts";
import {
  buildAuditoriumLayout,
  parseLayoutDescription,
} from "@/lib/seating-auditorium-layout";
import {
  convertRowsToAiLayout,
  parseOfficeLayoutDescription,
  resolveOfficeRowsFromImage,
} from "@/lib/seating-rows-to-ai-layout";
import { normalizeAiLayoutGeometry } from "@/lib/seating-layout-normalize";
import type { AILayoutSchema, GeneratedSeatingLayout } from "@/lib/seating-layout-types";
import type { SeatingAiSuggestion } from "@/lib/seating-ai-types";
import {
  getTextModelFallbacks,
  getVisionModelFallbacks,
  runOpenAiTextGeneration,
  runOpenAiVisionLayoutGeneration,
  OpenAiInferenceError,
} from "@/services/openai-inference";
import {
  getOpenRouterTextModelFallbacks,
  getOpenRouterVisionModelFallbacks,
  runOpenRouterImageDescribe,
  runOpenRouterTextGeneration,
  runOpenRouterVisionLayoutGeneration,
} from "@/services/openrouter-inference";

const LAYOUT_MAX_TOKENS = 8192;

export class SeatingAiGenerationError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "SeatingAiGenerationError";
    this.status = status;
  }
}

function isBillingOrQuotaError(error: unknown): boolean {
  if (!(error instanceof OpenAiInferenceError)) return false;
  if (error.status === 429 || error.status === 402) return true;
  const message = `${error.message} ${error.details ?? ""}`.toLowerCase();
  return /quota|billing|insufficient|exceeded your current/.test(message);
}

function formatFinalGenerationError(lastError: string, vision: boolean): never {
  const quotaHit = /quota|billing|exceeded your current/i.test(lastError);
  const hasOpenRouter = getOpenRouterApiKey() !== null;

  if (!hasOpenRouter && quotaHit) {
    throw new SeatingAiGenerationError(
      "OpenAI API quota exceeded. Set OPENROUTER_API_KEY in .env.local (and SEATING_AI_PROVIDER=openrouter), then restart the dev server.",
      429,
    );
  }

  if (!hasOpenRouter) {
    throw new SeatingAiGenerationError(
      "OPENROUTER_API_KEY is not configured. Add it to .env.local and restart the dev server.",
      503,
    );
  }

  if (quotaHit) {
    throw new SeatingAiGenerationError(
      `AI provider quota exceeded. ${lastError} Check credits at https://openrouter.ai/settings/credits`,
      429,
    );
  }

  throw new SeatingAiGenerationError(
    `All ${vision ? "vision " : ""}models failed. Last error: ${lastError}`,
    500,
  );
}

function visionModelsForProvider(provider: SeatingAiProvider): string[] {
  return provider === "openrouter"
    ? getOpenRouterVisionModelFallbacks()
    : getVisionModelFallbacks();
}

function textModelsForProvider(provider: SeatingAiProvider): string[] {
  return provider === "openrouter" ? getOpenRouterTextModelFallbacks() : getTextModelFallbacks();
}

async function callVisionModel(
  provider: SeatingAiProvider,
  model: string,
  imageBytes: Buffer,
  mimeType: string,
  userText: string,
  jsonMode: boolean,
): Promise<string> {
  if (provider === "openrouter") {
    return runOpenRouterVisionLayoutGeneration({
      model,
      system: SYSTEM_PROMPT,
      userText,
      imageBytes,
      mimeType,
      temperature: 0.1,
      maxNewTokens: LAYOUT_MAX_TOKENS,
      jsonMode,
    });
  }

  return runOpenAiVisionLayoutGeneration({
    model,
    system: SYSTEM_PROMPT,
    userText,
    imageBytes,
    mimeType,
    temperature: 0.1,
    maxNewTokens: LAYOUT_MAX_TOKENS,
    jsonMode,
  });
}

async function callTextModel(
  provider: SeatingAiProvider,
  model: string,
  prompt: string,
): Promise<string> {
  if (provider === "openrouter") {
    return runOpenRouterTextGeneration({
      model,
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(prompt),
      temperature: 0.1,
      maxNewTokens: LAYOUT_MAX_TOKENS,
      jsonMode: true,
    });
  }

  return runOpenAiTextGeneration({
    model,
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(prompt),
    temperature: 0.1,
    maxNewTokens: LAYOUT_MAX_TOKENS,
    jsonMode: true,
  });
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

function parseAiLayout(raw: string, modelLabel: string): AILayoutSchema {
  let aiData: AILayoutSchema;
  try {
    aiData = parseRobustJsonObject<AILayoutSchema>(raw);
  } catch {
    throw new SeatingAiGenerationError(
      `Failed to parse layout JSON from ${modelLabel}.`,
    );
  }

  if (!aiData.seats?.length) {
    throw new SeatingAiGenerationError(`No seats in layout returned by ${modelLabel}`);
  }

  if (!aiData.room) aiData.room = { width: 1200, height: 800 };
  if (!aiData.pillars) aiData.pillars = [];
  if (!aiData.walls) aiData.walls = [];

  return normalizeAiLayoutGeometry(aiData);
}

function buildLayoutFromAiData(
  aiData: AILayoutSchema,
  sourceLabel: string,
): GeneratedSeatingLayout {
  return {
    id: `layout_${Date.now()}`,
    name: aiData.name || "Office Layout",
    prompt: sourceLabel,
    room: aiData.room,
    seats: aiData.seats.map((seat) => ({ ...seat, status: "empty" as const })),
    pillars: aiData.pillars || [],
    walls: aiData.walls || [],
    groups: aiData.groups || [],
    createdAt: new Date().toISOString(),
  };
}

async function generateTextRaw(prompt: string): Promise<{ raw: string; modelLabel: string }> {
  const providers = getSeatingAiProviderOrder();
  let lastError = "";

  for (const provider of providers) {
    for (const model of textModelsForProvider(provider)) {
      try {
        const raw = await callTextModel(provider, model, prompt);
        return { raw, modelLabel: `${provider}/${model}` };
      } catch (error) {
        lastError = error instanceof Error ? error.message : `Unknown ${provider} error`;
        console.warn(`Seating AI ${provider}/${model} text failed: ${lastError}`);
        if (provider === "openai" && isBillingOrQuotaError(error)) break;
      }
    }
    if (provider === "openai" && isBillingOrQuotaError(new Error(lastError))) {
      console.warn("Skipping OpenAI — quota or billing limit.");
    }
  }

  formatFinalGenerationError(lastError, false);
}

async function describeLayoutImage(
  imageBytes: Buffer,
  mimeType: string,
  notes?: string,
): Promise<string> {
  const providers = getSeatingAiProviderOrder();
  let lastError = "";

  for (const provider of providers) {
    for (const model of visionModelsForProvider(provider)) {
      try {
        if (provider === "openrouter") {
          return await runOpenRouterImageDescribe({
            model,
            imageBytes,
            mimeType,
            notes,
          });
        }

        const raw = await runOpenAiVisionLayoutGeneration({
          model,
          system:
            "You analyze office seating floor plan images. Reply with a precise plain-text description only — no JSON.",
          userText: `Describe this seating layout diagram with exact seat counts, rows, aisles, and podium position.
${notes?.trim() ? `User notes: ${notes.trim()}` : ""}`,
          imageBytes,
          mimeType,
          temperature: 0.1,
          maxNewTokens: 1500,
          jsonMode: false,
        });
        return raw;
      } catch (error) {
        lastError = error instanceof Error ? error.message : `Unknown ${provider} describe error`;
        console.warn(`Seating AI ${provider}/${model} image describe failed: ${lastError}`);
        if (provider === "openai" && isBillingOrQuotaError(error)) break;
      }
    }
  }

  throw new Error(lastError || "Could not describe layout image.");
}

async function generateVisionDirect(input: {
  imageBytes: Buffer;
  mimeType: string;
  notes?: string;
}): Promise<{ aiData: AILayoutSchema; modelLabel: string }> {
  const providers = getSeatingAiProviderOrder();
  const userText = buildImageUserPrompt(input.notes);
  let lastParseError = "";
  let lastApiError = "";

  for (const provider of providers) {
    for (const model of visionModelsForProvider(provider)) {
      for (const jsonMode of [true, false] as const) {
        const modelLabel = `${provider}/${model}${jsonMode ? "" : " (no-json-mode)"}`;
        try {
          const raw = await callVisionModel(
            provider,
            model,
            input.imageBytes,
            input.mimeType,
            userText,
            jsonMode,
          );
          try {
            const aiData = parseAiLayout(raw, modelLabel);
            return { aiData, modelLabel };
          } catch (parseError) {
            lastParseError =
              parseError instanceof Error ? parseError.message : "JSON parse failed";
            console.warn(`Seating AI ${modelLabel} returned unparseable layout: ${lastParseError}`);
            console.warn(`Raw snippet: ${raw.slice(0, 300)}`);
          }
        } catch (apiError) {
          lastApiError = apiError instanceof Error ? apiError.message : "Vision API failed";
          console.warn(`Seating AI ${modelLabel} API failed: ${lastApiError}`);
          if (provider === "openai" && isBillingOrQuotaError(apiError)) break;
        }
      }
    }
  }

  throw new Error(lastParseError || lastApiError || "Direct vision layout generation failed.");
}

async function generateVisionTwoPhase(input: {
  imageBytes: Buffer;
  mimeType: string;
  notes?: string;
}): Promise<{ aiData: AILayoutSchema; modelLabel: string }> {
  const description = await describeLayoutImage(
    input.imageBytes,
    input.mimeType,
    input.notes,
  );

  const parsed = parseLayoutDescription(description);
  const officeParsed = parseOfficeLayoutDescription(description);

  if (officeParsed.layoutType === "office_grid") {
    const rows = resolveOfficeRowsFromImage(description);
    if (rows) {
      const layout = convertRowsToAiLayout(rows, "Uploaded office floor plan");
      return {
        aiData: normalizeAiLayoutGeometry(layout),
        modelLabel: "openrouter/office-grid-builder",
      };
    }
  }

  if (parsed.layoutType === "auditorium" && officeParsed.layoutType !== "office_grid") {
    const auditorium = buildAuditoriumLayout(parsed);
    if (auditorium && auditorium.seats.length > 0) {
      return {
        aiData: normalizeAiLayoutGeometry(auditorium),
        modelLabel: "openrouter/auditorium-builder",
      };
    }
  }

  const prompt = buildImageLayoutFromDescriptionPrompt(description, input.notes);

  const { raw, modelLabel } = await generateTextRaw(prompt);
  const aiData = parseAiLayout(raw, `${modelLabel} (two-phase)`);
  return { aiData, modelLabel: `${modelLabel} (two-phase)` };
}

async function generateVisionLayout(input: {
  imageBytes: Buffer;
  mimeType: string;
  notes?: string;
}): Promise<{ aiData: AILayoutSchema; modelLabel: string }> {
  try {
    return await generateVisionTwoPhase(input);
  } catch (twoPhaseError) {
    console.warn(
      "Two-phase image layout failed; trying direct vision.",
      twoPhaseError instanceof Error ? twoPhaseError.message : twoPhaseError,
    );
  }

  try {
    return await generateVisionDirect(input);
  } catch (directError) {
    const message =
      directError instanceof Error ? directError.message : "Vision layout generation failed";
    throw new SeatingAiGenerationError(
      `Failed to parse layout JSON from the AI vision response. ${message}`,
    );
  }
}

export async function generateSeatingFromTextPrompt(input: {
  prompt: string;
}): Promise<SeatingAiSuggestion> {
  const { raw, modelLabel } = await generateTextRaw(input.prompt);
  const aiData = parseAiLayout(raw, modelLabel);
  const layout = buildLayoutFromAiData(aiData, input.prompt);
  return layoutToSuggestion(
    layout,
    modelLabel,
    aiData.description || "AI-generated seating layout.",
  );
}

export async function generateSeatingFromImage(input: {
  imageBytes: Buffer;
  mimeType: string;
  notes?: string;
}): Promise<SeatingAiSuggestion> {
  const sourceLabel = input.notes?.trim()
    ? `Uploaded layout (${input.notes.trim()})`
    : "Uploaded layout image";

  const { aiData, modelLabel } = await generateVisionLayout(input);
  const layout = buildLayoutFromAiData(aiData, sourceLabel);
  return layoutToSuggestion(
    layout,
    modelLabel,
    aiData.description || "Layout generated from uploaded floor plan.",
  );
}
