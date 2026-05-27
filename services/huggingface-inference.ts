import "server-only";

import { requireHuggingFaceApiToken } from "@/lib/huggingface-env";

const CHAT_COMPLETIONS_URL =
  process.env.HUGGINGFACE_CHAT_URL?.trim() ||
  "https://router.huggingface.co/v1/chat/completions";

const DEFAULT_TIMEOUT_MS = Number(process.env.HUGGINGFACE_TIMEOUT_MS ?? 90_000);
const MAX_RETRIES_ON_LOADING = 2;

export type HuggingFaceChatContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type HuggingFaceChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | HuggingFaceChatContentPart[];
};

export class HuggingFaceInferenceError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly details?: string,
  ) {
    super(message);
    this.name = "HuggingFaceInferenceError";
  }
}

function getApiToken(): string {
  try {
    return requireHuggingFaceApiToken();
  } catch (error) {
    throw new HuggingFaceInferenceError(
      error instanceof Error
        ? error.message
        : "HUGGINGFACE_API_TOKEN is not configured on the server.",
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
    throw new HuggingFaceInferenceError("Unexpected Hugging Face response format.");
  }

  const record = payload as Record<string, unknown>;

  if (record.error) {
    throw new HuggingFaceInferenceError(
      extractErrorDetail(payload, ""),
      502,
    );
  }

  const choices = record.choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") {
    throw new HuggingFaceInferenceError("Unexpected Hugging Face response format.");
  }

  const message = (choices[0] as Record<string, unknown>).message;
  if (!message || typeof message !== "object") {
    throw new HuggingFaceInferenceError("Unexpected Hugging Face response format.");
  }

  const content = (message as Record<string, unknown>).content;
  if (typeof content === "string" && content.trim()) return content.trim();

  throw new HuggingFaceInferenceError("Hugging Face returned an empty completion.");
}

async function postChatCompletion(
  input: {
    model: string;
    messages: HuggingFaceChatMessage[];
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
        await sleep(8_000);
        continue;
      }

      if (!res.ok) {
        const detail = extractErrorDetail(parsed, rawText);
        throw new HuggingFaceInferenceError(
          detail
            ? `Hugging Face inference failed (${res.status}): ${detail}`
            : `Hugging Face inference failed (${res.status}).`,
          res.status,
          detail,
        );
      }

      return extractChatCompletionText(parsed);
    } catch (error) {
      if (error instanceof HuggingFaceInferenceError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new HuggingFaceInferenceError(
          `Hugging Face request timed out after ${Math.round(timeoutMs / 1000)}s.`,
          504,
        );
      }
      throw new HuggingFaceInferenceError(
        error instanceof Error ? error.message : "Hugging Face request failed.",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  throw new HuggingFaceInferenceError("Hugging Face model is still loading. Try again shortly.", 503);
}

/** Text seating layout via Inference Providers chat API. */
export async function runHuggingFaceTextGeneration(input: {
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

/** Vision analysis for uploaded floor plans via chat API. */
export async function runHuggingFaceImageCaption(input: {
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
  return process.env.HUGGINGFACE_TEXT_MODEL?.trim() || "Qwen/Qwen2.5-7B-Instruct";
}

export function getDefaultVisionModel(): string {
  return (
    process.env.HUGGINGFACE_VISION_MODEL?.trim() || "CohereLabs/aya-vision-32b:fastest"
  );
}
