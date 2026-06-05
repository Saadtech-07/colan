import "server-only";

import { requireOpenRouterApiKey } from "@/lib/openrouter-env";

const CHAT_COMPLETIONS_URL =
  process.env.OPENROUTER_API_URL?.trim() ||
  "https://openrouter.ai/api/v1/chat/completions";

const DEFAULT_TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS ?? 90_000);
const MAX_RETRIES_ON_LOADING = 2;

const APP_REFERER =
  process.env.OPENROUTER_HTTP_REFERER?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "http://localhost:3000";

const APP_TITLE = process.env.OPENROUTER_APP_TITLE?.trim() || "Colan Teams";

export type OpenRouterChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type OpenRouterChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | OpenRouterChatContentPart[];
};

export class OpenRouterInferenceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly details?: string,
  ) {
    super(message);
    this.name = "OpenRouterInferenceError";
  }
}

function getApiToken(): string {
  try {
    return requireOpenRouterApiKey();
  } catch (error) {
    throw new OpenRouterInferenceError(
      error instanceof Error
        ? error.message
        : "OPENROUTER_API_KEY is not configured on the server.",
      503,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function extractErrorDetail(payload: unknown, rawText: string): string {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (record.error && typeof record.error === "object") {
      const nested = record.error as Record<string, unknown>;
      if (typeof nested.message === "string") return nested.message;
    }
    if (typeof record.error === "string") return record.error;
    if (typeof record.message === "string") return record.message;
  }
  return rawText.slice(0, 500);
}

function extractChatCompletionText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    throw new OpenRouterInferenceError("Unexpected OpenRouter response format.");
  }

  const record = payload as Record<string, unknown>;

  if (record.error) {
    throw new OpenRouterInferenceError(extractErrorDetail(payload, ""), 502);
  }

  const choices = record.choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") {
    throw new OpenRouterInferenceError("Unexpected OpenRouter response format.");
  }

  const message = (choices[0] as Record<string, unknown>).message;
  if (!message || typeof message !== "object") {
    throw new OpenRouterInferenceError("Unexpected OpenRouter response format.");
  }

  const content = (message as Record<string, unknown>).content;
  if (typeof content === "string" && content.trim()) return content.trim();

  throw new OpenRouterInferenceError("OpenRouter returned an empty completion.");
}

async function postChatCompletion(
  input: {
    model: string;
    messages: OpenRouterChatMessage[];
    maxTokens?: number;
    temperature?: number;
    jsonMode?: boolean;
  },
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<string> {
  const token = getApiToken();

  for (let attempt = 0; attempt <= MAX_RETRIES_ON_LOADING; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(CHAT_COMPLETIONS_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "HTTP-Referer": APP_REFERER,
          "X-Title": APP_TITLE,
        },
        body: JSON.stringify({
          model: input.model,
          messages: input.messages,
          max_tokens: input.maxTokens ?? 1400,
          temperature: input.temperature ?? 0.12,
          ...(input.jsonMode ? { response_format: { type: "json_object" } } : {}),
        }),
      });

      const rawText = await res.text();
      let parsed: unknown = rawText;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch {
        parsed = rawText;
      }

      if (res.status === 503 && attempt < MAX_RETRIES_ON_LOADING) {
        await sleep(4_000);
        continue;
      }

      if (!res.ok) {
        const detail = extractErrorDetail(parsed, rawText);
        throw new OpenRouterInferenceError(
          detail
            ? `OpenRouter request failed (${res.status}): ${detail}`
            : `OpenRouter request failed (${res.status}).`,
          res.status,
          detail,
        );
      }

      return extractChatCompletionText(parsed);
    } catch (error) {
      if (error instanceof OpenRouterInferenceError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new OpenRouterInferenceError(
          `OpenRouter request timed out after ${Math.round(timeoutMs / 1000)}s.`,
          504,
        );
      }
      throw new OpenRouterInferenceError(
        error instanceof Error ? error.message : "OpenRouter request failed.",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  throw new OpenRouterInferenceError("OpenRouter model is unavailable. Try again shortly.", 503);
}

/** Text seating layout via OpenRouter chat completions. */
export async function runOpenRouterTextGeneration(input: {
  model: string;
  system: string;
  user: string;
  maxNewTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}): Promise<string> {
  return postChatCompletion({
    model: input.model,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
    maxTokens: input.maxNewTokens,
    temperature: input.temperature,
    jsonMode: input.jsonMode,
  });
}

/** Vision analysis for uploaded floor plans via OpenRouter multimodal chat. */
export async function runOpenRouterImageCaption(input: {
  model: string;
  imageBytes: Buffer;
  mimeType: string;
  prompt?: string;
}): Promise<string> {
  const dataUrl = `data:${input.mimeType};base64,${input.imageBytes.toString("base64")}`;
  const prompt =
    input.prompt?.trim() ||
    "Describe this office floor plan or seating layout image. Focus on rows, clusters, aisles, entrances, and open areas.";

  return postChatCompletion({
    model: input.model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    maxTokens: 400,
    temperature: 0.1,
  });
}

export function getDefaultTextModel(): string {
  return process.env.OPENROUTER_TEXT_MODEL?.trim() || "openai/gpt-4o-mini";
}

export function getDefaultVisionModel(): string {
  return process.env.OPENROUTER_VISION_MODEL?.trim() || "google/gemini-2.5-flash";
}
