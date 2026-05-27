type RawAiPayload = {
  summary?: unknown;
  strategy?: unknown;
  layoutSeats?: unknown;
  zones?: unknown;
  assignments?: unknown;
};

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

function extractLayoutSeatsLoose(text: string): RawAiPayload | null {
  const layoutSeats: string[] = [];
  const seatPattern = /"(?:seatId|seat|bay)"\s*:\s*"([A-G]\d+)"/gi;
  const arraySeatPattern = /"layoutSeats"\s*:\s*\[([\s\S]*?)\]/i;

  const arrayMatch = text.match(arraySeatPattern);
  if (arrayMatch?.[1]) {
    const idPattern = /"([A-G]\d+)"/gi;
    let match: RegExpExecArray | null;
    while ((match = idPattern.exec(arrayMatch[1])) !== null) {
      layoutSeats.push(match[1]!.toUpperCase());
    }
  }

  if (!layoutSeats.length) {
    let match: RegExpExecArray | null;
    while ((match = seatPattern.exec(text)) !== null) {
      layoutSeats.push(match[1]!.toUpperCase());
    }
  }

  if (!layoutSeats.length) return null;

  const summaryMatch = text.match(/"summary"\s*:\s*"([^"]+)"/i);

  return {
    summary: summaryMatch?.[1] ?? "Recovered blank layout from AI response.",
    strategy: ["Parsed from partial AI output."],
    layoutSeats: [...new Set(layoutSeats)],
    assignments: [],
  };
}

export function parseSeatingAiJson(rawText: string): RawAiPayload {
  const cleaned = stripMarkdownFences(rawText);
  const candidates = [
    cleaned,
    extractBalancedObject(cleaned),
    extractBalancedObject(cleaned.replace(/^[\s\S]*?(\{)/, "$1")),
    closeTruncatedJson(extractBalancedObject(cleaned) ?? cleaned),
    repairCommonJsonIssues(extractBalancedObject(cleaned) ?? cleaned),
    repairCommonJsonIssues(closeTruncatedJson(extractBalancedObject(cleaned) ?? cleaned)),
  ].filter((value): value is string => Boolean(value?.trim()));

  const unique = [...new Set(candidates)];

  for (const candidate of unique) {
    try {
      const parsed = JSON.parse(candidate) as RawAiPayload;
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      // try next candidate
    }
  }

  const loose = extractLayoutSeatsLoose(cleaned);
  if (loose) return loose;

  throw new Error("AI response was not valid JSON. Try a simpler prompt or retry.");
}
