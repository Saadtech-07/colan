import "server-only";

import { loadEnvConfig } from "@next/env";

const TOKEN_ENV_KEYS = ["OPENROUTER_API_KEY"] as const;

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

export function getOpenRouterApiKey(): string | null {
  ensureServerEnvLoaded();

  for (const key of TOKEN_ENV_KEYS) {
    const value = readEnvValue(key);
    if (value) return value;
  }

  // Custom `tsx server.ts` may start before .env.local is saved — reload once if missing.
  loadEnvConfig(process.cwd());
  for (const key of TOKEN_ENV_KEYS) {
    const value = readEnvValue(key);
    if (value) return value;
  }

  return null;
}

export function requireOpenRouterApiKey(): string {
  const token = getOpenRouterApiKey();
  if (!token) {
    throw new Error(
      "OPENROUTER_API_KEY is not configured. Add it to .env.local and restart the dev server.",
    );
  }
  return token;
}

export function isOpenRouterConfigured(): boolean {
  return getOpenRouterApiKey() !== null;
}
