/** Default squads seeded when the teams collection is empty. */
export const DEFAULT_TEAM_NAMES = [
  "React Team",
  "Next.js Team",
  "Node Team",
  "UI/UX Team",
  "Testing Team",
  "DevOps Team",
  "Java Team",
  "Python Team",
] as const;

/** Display label for tabs (strip " Team" suffix). */
export function teamTabLabel(name: string): string {
  return name.replace(/ Team$/i, "").trim() || name;
}

/** Compare squads ignoring optional " Team" suffix and casing (edge/client safe). */
export function teamMatchKey(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+team$/i, "")
    .replace(/[^a-z0-9]+/g, "");
}

/** Normalize admin input to canonical squad name, e.g. "java" → "Java Team". */
export function normalizeTeamName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (/ team$/i.test(trimmed)) {
    return trimmed
      .split(" ")
      .map((w, i) =>
        i === trimmed.split(" ").length - 1 && /^team$/i.test(w)
          ? "Team"
          : w.charAt(0).toUpperCase() + w.slice(1),
      )
      .join(" ");
  }
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)} Team`;
}

export function teamSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Short squad identifier, e.g. "react" → "REACT", "ui/ux" → "UI-UX". */
export function normalizeTeamCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9-]/g, "");
}

/** Derive a default code from a canonical team name when seeding legacy rows. */
export function teamCodeFromName(name: string): string {
  const base = teamTabLabel(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || teamSlugFromName(name).toUpperCase().replace(/-/g, "");
}
