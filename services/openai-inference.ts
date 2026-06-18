import "server-only";

import { requireOpenAiApiKey } from "@/lib/openai-env";

const CHAT_COMPLETIONS_URL =
  process.env.OPENAI_API_URL?.trim() || "https://api.openai.com/v1/chat/completions";

const DEFAULT_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS ?? 90_000);
const MAX_RETRIES_ON_LOADING = 2;

export type OpenAiChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type OpenAiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | OpenAiChatContentPart[];
};

export class OpenAiInferenceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly details?: string,
  ) {
    super(message);
    this.name = "OpenAiInferenceError";
  }
}

function getApiToken(): string {
  try {
    return requireOpenAiApiKey();
  } catch (error) {
    throw new OpenAiInferenceError(
      error instanceof Error
        ? error.message
        : "OPENAI_API_KEY is not configured on the server.",
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
    throw new OpenAiInferenceError("Unexpected OpenAI response format.");
  }

  const record = payload as Record<string, unknown>;

  if (record.error) {
    throw new OpenAiInferenceError(extractErrorDetail(payload, ""), 502);
  }

  const choices = record.choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") {
    throw new OpenAiInferenceError("Unexpected OpenAI response format.");
  }

  const message = (choices[0] as Record<string, unknown>).message;
  if (!message || typeof message !== "object") {
    throw new OpenAiInferenceError("Unexpected OpenAI response format.");
  }

  const content = (message as Record<string, unknown>).content;
  if (typeof content === "string" && content.trim()) return content.trim();

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        const record = part as Record<string, unknown>;
        if (typeof record.text === "string") return record.text;
        return "";
      })
      .join("")
      .trim();
    if (text) return text;
  }

  throw new OpenAiInferenceError("OpenAI returned an empty completion.");
}

async function postChatCompletion(
  input: {
    model: string;
    messages: OpenAiChatMessage[];
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
        },
        body: JSON.stringify({
          model: input.model,
          messages: input.messages,
          max_tokens: input.maxTokens ?? 4096,
          temperature: input.temperature ?? 0.1,
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
        throw new OpenAiInferenceError(
          detail
            ? `OpenAI request failed (${res.status}): ${detail}`
            : `OpenAI request failed (${res.status}).`,
          res.status,
          detail,
        );
      }

      return extractChatCompletionText(parsed);
    } catch (error) {
      if (error instanceof OpenAiInferenceError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new OpenAiInferenceError(
          `OpenAI request timed out after ${Math.round(timeoutMs / 1000)}s.`,
          504,
        );
      }
      throw new OpenAiInferenceError(
        error instanceof Error ? error.message : "OpenAI request failed.",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  throw new OpenAiInferenceError("OpenAI model is unavailable. Try again shortly.", 503);
}

/** Text seating layout via OpenAI chat completions. */
export async function runOpenAiTextGeneration(input: {
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

/** Vision layout generation from an uploaded floor plan image. */
export async function runOpenAiVisionLayoutGeneration(input: {
  model: string;
  system: string;
  userText: string;
  imageBytes: Buffer;
  mimeType: string;
  maxNewTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}): Promise<string> {
  const dataUrl = `data:${input.mimeType};base64,${input.imageBytes.toString("base64")}`;

  return postChatCompletion({
    model: input.model,
    messages: [
      { role: "system", content: input.system },
      {
        role: "user",
        content: [
          { type: "text", text: input.userText },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    maxTokens: input.maxNewTokens ?? 4096,
    temperature: input.temperature ?? 0.1,
    jsonMode: input.jsonMode ?? true,
  });
}

/** Vision analysis for uploaded floor plans via OpenAI multimodal chat. */
export async function runOpenAiImageCaption(input: {
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
  return process.env.OPENAI_TEXT_MODEL?.trim() || "gpt-4o-mini";
}

export function getDefaultVisionModel(): string {
  return process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o";
}

export function getTextModelFallbacks(): string[] {
  const primary = getDefaultTextModel();
  const fallback = process.env.OPENAI_TEXT_MODEL_FALLBACK?.trim() || "gpt-4o";
  return [...new Set([primary, fallback].filter(Boolean))];
}

export function getVisionModelFallbacks(): string[] {
  const primary = getDefaultVisionModel();
  const fallback = process.env.OPENAI_VISION_MODEL_FALLBACK?.trim() || "gpt-4o";
  return [...new Set([primary, fallback].filter(Boolean))];
}
