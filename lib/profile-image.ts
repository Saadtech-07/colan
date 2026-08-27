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

/** Avatar fallback text from a display name or email. */
export function profileInitials(
  name?: string | null,
  email?: string | null,
  maxLength = 2,
): string {
  const source = name?.trim() || email?.trim();
  if (!source) return "?";

  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, maxLength).toUpperCase();
  }

  return (
    parts
      .map((part) => part[0])
      .join("")
      .slice(0, maxLength)
      .toUpperCase() || "?"
  );
}

/** First letter of the display name (or email) when no profile image is uploaded. */
export function profileNameInitial(name?: string | null, email?: string | null): string {
  return profileInitials(name, email, 1);
}
