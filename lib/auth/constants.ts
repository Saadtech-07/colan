export const AUTH_COOKIE_NAME = "colan_token";
export const AUTH_MAX_AGE_SEC = 24 * 60 * 60; // 24 hours

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be set (min 32 characters) in production.");
  }
  return "dev-colan-auth-secret-minimum-32-characters-long";
}
