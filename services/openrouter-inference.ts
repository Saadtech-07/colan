import "server-only";

import { getOpenRouterApiKey } from "@/lib/openai-env";
import type { OpenAiChatMessage } from "@/services/openai-inference";
import { OpenAiInferenceError } from "@/services/openai-inference";

const CHAT_COMPLETIONS_URL =
  process.env.OPENROUTER_API_URL?.trim() ||
  "https://openrouter.ai/api/v1/chat/completions";

const DEFAULT_TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS ?? 90_000);

const APP_REFERER =
  process.env.OPENROUTER_HTTP_REFERER?.trim() ||
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  "http://localhost:3000";

const APP_TITLE = process.env.OPENROUTER_APP_TITLE?.trim() || "Colan Teams";

function requireOpenRouterApiKey(): string {
  const token = getOpenRouterApiKey();
  if (!token) {
    throw new OpenAiInferenceError(
      "OPENROUTER_API_KEY is not configured on the server.",
      503,
    );
  }
  return token;
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
    throw new OpenAiInferenceError("Unexpected OpenRouter response format.");
  }

  const record = payload as Record<string, unknown>;
  if (record.error) {
    throw new OpenAiInferenceError(extractErrorDetail(payload, ""), 502);
  }

  const choices = record.choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") {
    throw new OpenAiInferenceError("Unexpected OpenRouter response format.");
  }

  const message = (choices[0] as Record<string, unknown>).message;
  if (!message || typeof message !== "object") {
    throw new OpenAiInferenceError("Unexpected OpenRouter response format.");
  }

  const content = (message as Record<string, unknown>).content;
  if (typeof content === "string" && content.trim()) return content.trim();

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        const record = part as Record<string, unknown>;
        if (typeof record.text === "string") return record.text;
        if (record.type === "text" && typeof record.text === "string") return record.text;
        return "";
      })
      .join("")
      .trim();
    if (text) return text;
  }

  throw new OpenAiInferenceError("OpenRouter returned an empty completion.");
}

async function postChatCompletion(input: {
  model: string;
  messages: OpenAiChatMessage[];
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}): Promise<string> {
  const token = requireOpenRouterApiKey();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

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

    if (!res.ok) {
      const detail = extractErrorDetail(parsed, rawText);
      throw new OpenAiInferenceError(
        detail
          ? `OpenRouter request failed (${res.status}): ${detail}`
          : `OpenRouter request failed (${res.status}).`,
        res.status,
        detail,
      );
    }

    return extractChatCompletionText(parsed);
  } catch (error) {
    if (error instanceof OpenAiInferenceError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new OpenAiInferenceError(
        `OpenRouter request timed out after ${Math.round(DEFAULT_TIMEOUT_MS / 1000)}s.`,
        504,
      );
    }
    throw new OpenAiInferenceError(
      error instanceof Error ? error.message : "OpenRouter request failed.",
    );
  } finally {
    clearTimeout(timer);
  }
}

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

export async function runOpenRouterVisionLayoutGeneration(input: {
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

export function getOpenRouterTextModelFallbacks(): string[] {
  const primary =
    process.env.OPENROUTER_TEXT_MODEL?.trim() || "openai/gpt-4o-mini";
  const fallback =
    process.env.OPENROUTER_TEXT_MODEL_FALLBACK?.trim() || "google/gemini-2.5-flash";
  const tertiary = "openai/gpt-4o-mini";
  return [...new Set([primary, fallback, tertiary].filter(Boolean))];
}

export function getOpenRouterVisionModelFallbacks(): string[] {
  const primary =
    process.env.OPENROUTER_VISION_MODEL?.trim() || "google/gemini-2.5-flash";
  const fallback =
    process.env.OPENROUTER_VISION_MODEL_FALLBACK?.trim() || "openai/gpt-4o-mini";
  return [...new Set([primary, fallback].filter(Boolean))];
}

export async function runOpenRouterImageDescribe(input: {
  model: string;
  imageBytes: Buffer;
  mimeType: string;
  notes?: string;
  maxNewTokens?: number;
}): Promise<string> {
  const dataUrl = `data:${input.mimeType};base64,${input.imageBytes.toString("base64")}`;
  const userNotes = input.notes?.trim() ? `User notes: ${input.notes.trim()}` : "";

  return postChatCompletion({
    model: input.model,
    messages: [
      {
        role: "system",
        content:
          "You analyze office seating floor plan images. Reply with a precise plain-text description only — no JSON, no markdown.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this seating layout diagram and reply in this exact format (one field per line):

LAYOUT_TYPE: office_grid | auditorium | other
TOTAL_SEATS: <exact count>
ROW_ORDER: <comma-separated row letters in top-to-bottom order, e.g. A,B,C,D,F,E,G>
PILLARS: yes | no
ENTRANCE: yes | no
STAGE: yes | no

For office_grid also list EVERY row (one line each):
ROW_A: <seat count> seats, <pillar count> pillars, entrance yes|no
ROW_B: ...
(use 0 pillars and entrance no when absent)

Then add a short summary. Count every seat cell exactly. If rows are labeled A-ROW (32), B-ROW (24) with gray PILLAR blocks and blue ENTRANCE, use LAYOUT_TYPE: office_grid.
For two side-by-side seat blocks with a center aisle and a stage at top, use LAYOUT_TYPE: auditorium.
${userNotes}`.trim(),
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    maxTokens: input.maxNewTokens ?? 1500,
    temperature: 0.1,
    jsonMode: false,
  });
}
