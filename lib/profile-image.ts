const GENERATED_AVATAR_PATTERN = /api\.dicebear\.com/i;

export function isUploadedProfileImage(value?: string | null): boolean {
  if (!value || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (GENERATED_AVATAR_PATTERN.test(trimmed)) return false;
  return (
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://")
  );
}

export function resolveProfileImageSrc(value?: string | null): string | undefined {
  return isUploadedProfileImage(value) ? value!.trim() : undefined;
}

/** First letter of the display name (or email) when no profile image is uploaded. */
export function profileNameInitial(name?: string | null, email?: string | null): string {
  const fromName = name?.trim();
  if (fromName) return fromName[0]!.toUpperCase();
  const fromEmail = email?.trim();
  if (fromEmail) return fromEmail[0]!.toUpperCase();
  return "?";
}
