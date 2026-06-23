import "server-only";

import { parseRobustJsonObject } from "@/lib/seating-ai-json";
import {
  getOpenRouterApiKey,
  getSeatingAiProviderOrder,
  type SeatingAiProvider,
} from "@/lib/openai-env";
import {
  applyLayoutEditorResponse,
  parseNaturalLanguageOperations,
  tryParseLayoutEditorResponse,
} from "@/lib/seating-layout-editor-apply";
import { cloneLayoutState } from "@/lib/seating-layout-editor-snapshot";
import {
  buildLayoutEditorUserPrompt,
  LAYOUT_EDITOR_SYSTEM_PROMPT,
} from "@/lib/seating-layout-editor-prompt";
import type {
  ColanLayoutState,
  LayoutEditorApplyResult,
  LayoutEditorResponse,
} from "@/lib/seating-layout-editor-types";
import {
  applySeatingLayoutPrompt,
  parseLayoutPromptActions,
} from "@/lib/seating-layout-prompt";
import {
  getTextModelFallbacks,
  runOpenAiTextGeneration,
  OpenAiInferenceError,
} from "@/services/openai-inference";
import {
  getOpenRouterTextModelFallbacks,
  runOpenRouterTextGeneration,
} from "@/services/openrouter-inference";

const MAX_TOKENS = 4096;

export class LayoutEditorError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "LayoutEditorError";
    this.status = status;
  }
}

async function runTextModel(
  provider: SeatingAiProvider,
  model: string,
  system: string,
  user: string,
): Promise<string> {
  if (provider === "openrouter") {
    return runOpenRouterTextGeneration({
      model,
      system,
      user,
      maxNewTokens: MAX_TOKENS,
      temperature: 0.1,
      jsonMode: true,
    });
  }

  return runOpenAiTextGeneration({
    model,
    system,
    user,
    maxNewTokens: MAX_TOKENS,
    temperature: 0.1,
    jsonMode: true,
  });
}

function parseEditorResponse(raw: string): LayoutEditorResponse {
  const direct = tryParseLayoutEditorResponse(raw);
  if (direct) return direct;

  const parsed = parseRobustJsonObject(raw) as LayoutEditorResponse | null;
  if (!parsed || !Array.isArray(parsed.operations)) {
    throw new LayoutEditorError("AI did not return valid layout editor JSON.", 400);
  }

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary : "Layout updated.",
    operations: parsed.operations,
    errors: Array.isArray(parsed.errors) ? parsed.errors.map(String) : [],
  };
}

function applyLocalFallback(
  layout: ColanLayoutState,
  prompt: string,
): LayoutEditorApplyResult {
  const regexActions = parseLayoutPromptActions(prompt);
  if (regexActions.length > 0) {
    const legacy = applySeatingLayoutPrompt(layout.rows, prompt);
    return {
      layout: {
        ...layout,
        rows: legacy.rows,
      },
      summary: legacy.summary,
      warnings: legacy.warnings,
      errors: [],
      occupancySwaps: legacy.occupancySwaps,
    };
  }

  throw new LayoutEditorError(
    'Could not parse layout changes. Try: "remove G and E rows", "add pillar between G5 and G6", or "replace A row with B row".',
    400,
  );
}

export async function editColanLayoutWithAi(input: {
  layout: ColanLayoutState;
  prompt: string;
}): Promise<LayoutEditorApplyResult> {
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new LayoutEditorError("Prompt is required.", 400);
  }

  const layout = cloneLayoutState(input.layout);

  const regexActions = parseLayoutPromptActions(prompt);
  if (regexActions.length > 0) {
    return applyLocalFallback(layout, prompt);
  }

  const natural = parseNaturalLanguageOperations(prompt, layout);
  if (natural) {
    return applyLayoutEditorResponse(layout, natural);
  }

  const hasOpenRouter = getOpenRouterApiKey() !== null;
  if (!hasOpenRouter) {
    return applyLocalFallback(layout, prompt);
  }

  const system = LAYOUT_EDITOR_SYSTEM_PROMPT;
  const user = buildLayoutEditorUserPrompt(layout, prompt);
  const providers = getSeatingAiProviderOrder();
  let lastError = "AI layout edit failed.";

  for (const provider of providers) {
    const models =
      provider === "openrouter"
        ? getOpenRouterTextModelFallbacks()
        : getTextModelFallbacks();

    for (const model of models) {
      try {
        const raw = await runTextModel(provider, model, system, user);
        const response = parseEditorResponse(raw);
        if (response.errors?.length) {
          throw new LayoutEditorError(response.errors.join(" "), 400);
        }
        return applyLayoutEditorResponse(layout, response);
      } catch (error) {
        if (error instanceof LayoutEditorError) throw error;
        lastError =
          error instanceof OpenAiInferenceError
            ? error.message
            : error instanceof Error
              ? error.message
              : lastError;
      }
    }
  }

  try {
    return applyLocalFallback(layout, prompt);
  } catch {
    throw new LayoutEditorError(
      lastError.includes("No endpoints found")
        ? `Layout edit failed — AI model unavailable (${lastError}). Try simpler phrasing like "insert row X between C and D with 2 pillars".`
        : lastError,
      400,
    );
  }
}
