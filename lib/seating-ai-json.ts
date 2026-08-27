function stripMarkdownFences(text: string): string {
  const fenced = text.trim().match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced?.[1]?.trim() ?? text.trim();
}

function repairCommonJsonIssues(json: string): string {
  return json
    .replace(/^\uFEFF/, "")
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/([{,]\s*)'([^']+)'(\s*:)/g, '$1"$2"$3')
    .replace(/:\s*'([^']*)'/g, ': "$1"');
}

function extractBalancedObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index]!;

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  return null;
}

function closeTruncatedJson(json: string): string {
  let repaired = json.trim();
  const openBraces = (repaired.match(/{/g) ?? []).length;
  const closeBraces = (repaired.match(/}/g) ?? []).length;
  const openBrackets = (repaired.match(/\[/g) ?? []).length;
  const closeBrackets = (repaired.match(/]/g) ?? []).length;

  if (repaired.endsWith(",")) repaired = repaired.slice(0, -1);
  for (let i = 0; i < openBrackets - closeBrackets; i += 1) repaired += "]";
  for (let i = 0; i < openBraces - closeBraces; i += 1) repaired += "}";

  return repaired;
}

function buildJsonCandidates(rawText: string): string[] {
  const cleaned = stripMarkdownFences(rawText);
  const balanced = extractBalancedObject(cleaned);
  const candidates = [
    cleaned,
    balanced,
    balanced ? extractBalancedObject(cleaned.replace(/^[\s\S]*?(\{)/, "$1")) : null,
    balanced ? closeTruncatedJson(balanced) : closeTruncatedJson(cleaned),
    balanced ? repairCommonJsonIssues(balanced) : repairCommonJsonIssues(cleaned),
    balanced
      ? repairCommonJsonIssues(closeTruncatedJson(balanced))
      : repairCommonJsonIssues(closeTruncatedJson(cleaned)),
  ].filter((value): value is string => Boolean(value?.trim()));

  return [...new Set(candidates)];
}

/** Parse JSON from LLM output with fence stripping, truncation repair, and trailing-comma fixes. */
export function parseRobustJsonObject<T extends object>(rawText: string): T {
  for (const candidate of buildJsonCandidates(rawText)) {
    try {
      const parsed = JSON.parse(candidate) as T;
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // try next candidate
    }
  }

  throw new Error("AI response was not valid JSON.");
}
