import "server-only";

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function getEnvValue(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getEmailUser(): string | null {
  return getEnvValue("EMAIL_USER");
}

export function getEmailPass(): string | null {
  const raw = getEnvValue("EMAIL_PASS");
  return raw ? raw.replace(/\s+/g, "") : null;
}

export function getEmailFrom(): string | null {
  const explicit = getEnvValue("EMAIL_FROM");
  if (explicit) return explicit;

  const user = getEmailUser();
  return user ? `Colan Infotech <${user}>` : null;
}

export function resolveAppBaseUrl(requestOrigin?: string): string | null {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.AUTH_URL?.trim() || requestOrigin?.trim();

  return configured ? normalizeUrl(configured) : null;
}

export function resolveLoginUrl(requestOrigin?: string): string | null {
  const baseUrl = resolveAppBaseUrl(requestOrigin);
  return baseUrl ? `${baseUrl}/login` : null;
}

export function resolvePasswordResetUrl(token: string, requestOrigin?: string): string | null {
  const baseUrl = resolveAppBaseUrl(requestOrigin);
  if (!baseUrl) return null;
  return `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
}
