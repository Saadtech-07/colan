import "server-only";

import { loadEnvConfig } from "@next/env";

const OPENAI_ENV_KEYS = ["OPENAI_API_KEY"] as const;
const OPENROUTER_ENV_KEYS = ["OPENROUTER_API_KEY"] as const;

/** Ensures Next.js env files (.env.local, etc.) are loaded (custom server + API routes). */
export function ensureServerEnvLoaded(): void {
  loadEnvConfig(process.cwd());
}

function readEnvValue(name: string): string | null {
  const raw = process.env[name];
  if (!raw) return null;
  const value = raw.replace(/^\uFEFF/, "").trim();
  return value.length > 0 ? value : null;
}

export function getOpenAiApiKey(): string | null {
  ensureServerEnvLoaded();

  for (const key of OPENAI_ENV_KEYS) {
    const value = readEnvValue(key);
    if (value) return value;
  }

  // Custom `tsx server.ts` may start before .env.local is saved — reload once if missing.
  loadEnvConfig(process.cwd());
  for (const key of OPENAI_ENV_KEYS) {
    const value = readEnvValue(key);
    if (value) return value;
  }

  return null;
}

export function getOpenRouterApiKey(): string | null {
  ensureServerEnvLoaded();

  for (const key of OPENROUTER_ENV_KEYS) {
    const value = readEnvValue(key);
    if (value) return value;
  }

  loadEnvConfig(process.cwd());
  for (const key of OPENROUTER_ENV_KEYS) {
    const value = readEnvValue(key);
    if (value) return value;
  }

  return null;
}

export function requireOpenAiApiKey(): string {
  const token = getOpenAiApiKey();
  if (!token) {
    throw new Error(
      "OPENAI_API_KEY is not configured. Add it to .env.local and restart the dev server.",
    );
  }
  return token;
}

export function isOpenAiConfigured(): boolean {
  return getOpenAiApiKey() !== null;
}

/** True when OpenAI and/or OpenRouter is configured for seating AI generation. */
export function isSeatingAiConfigured(): boolean {
  return isOpenAiConfigured() || getOpenRouterApiKey() !== null;
}

export type SeatingAiProvider = "openrouter" | "openai";

/** Provider order for seating AI — OpenRouter first by default when both keys exist. */
export function getSeatingAiProviderOrder(): SeatingAiProvider[] {
  const preference = process.env.SEATING_AI_PROVIDER?.trim().toLowerCase();

  if (preference === "openrouter") {
    return getOpenRouterApiKey() ? ["openrouter"] : [];
  }
  if (preference === "openai") {
    return getOpenAiApiKey() ? ["openai"] : [];
  }

  const order: SeatingAiProvider[] = [];
  if (getOpenRouterApiKey()) order.push("openrouter");
  if (getOpenAiApiKey()) order.push("openai");
  return order;
}
