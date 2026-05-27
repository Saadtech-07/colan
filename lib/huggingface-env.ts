import "server-only";

import { loadEnvConfig } from "@next/env";

const TOKEN_ENV_KEYS = [
  "HUGGINGFACE_API_TOKEN",
  "HF_TOKEN",
  "HUGGING_FACE_API_TOKEN",
] as const;

let envLoaded = false;

/** Ensures Next.js env files (.env.local, etc.) are loaded in dev/scripts. */
export function ensureServerEnvLoaded(): void {
  if (envLoaded) return;
  loadEnvConfig(process.cwd());
  envLoaded = true;
}

function readEnvValue(name: string): string | null {
  const raw = process.env[name];
  if (!raw) return null;
  const value = raw.replace(/^\uFEFF/, "").trim();
  return value.length > 0 ? value : null;
}

export function getHuggingFaceApiToken(): string | null {
  ensureServerEnvLoaded();

  for (const key of TOKEN_ENV_KEYS) {
    const value = readEnvValue(key);
    if (value) return value;
  }

  return null;
}

export function requireHuggingFaceApiToken(): string {
  const token = getHuggingFaceApiToken();
  if (!token) {
    throw new Error(
      "HUGGINGFACE_API_TOKEN is not configured. Add it to .env.local and restart the dev server.",
    );
  }
  return token;
}

export function isHuggingFaceConfigured(): boolean {
  return getHuggingFaceApiToken() !== null;
}
