import { buildLayoutFromPrompt } from "@/lib/seating-ai-layout-builder";
import { parseSeatingAiJson } from "@/lib/seating-ai-json";
import { parseTargetSeatCount } from "@/lib/seating-ai-layout-hints";
import { isValidSeatId } from "@/lib/seating-layout";
import type {
  SeatingAiEmployeeContext,
  SeatingAiSuggestion,
  SeatingAiZone,
} from "@/lib/seating-ai-types";

type RawAiPayload = {
  summary?: unknown;
  strategy?: unknown;
  layoutSeats?: unknown;
  zones?: unknown;
  assignments?: unknown;
};

function parseZones(raw: unknown): SeatingAiZone[] {
  if (!Array.isArray(raw)) return [];
  const zones: SeatingAiZone[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const seatIds = Array.isArray(record.seatIds)
      ? record.seatIds
          .map((id) => String(id).trim().toUpperCase())
          .filter((id) => isValidSeatId(id))
      : [];
    if (!seatIds.length) continue;
    zones.push({
      id: String(record.id ?? record.name ?? zones.length).trim() || `zone-${zones.length}`,
      label: String(record.label ?? record.name ?? "Zone").trim(),
      seatIds,
    });
  }

  return zones;
}

function parseLayoutSeats(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((id) => String(id).trim().toUpperCase())
    .filter((id) => isValidSeatId(id));
}

export function parseSeatingAiResponse(input: {
  adminPrompt?: string;
  rawText: string;
  employees: SeatingAiEmployeeContext[];
  modelUsed: string;
  imageAnalysis?: string;
}): SeatingAiSuggestion {
  const warnings: string[] = [];
  const fallback = buildLayoutFromPrompt(input.adminPrompt ?? "");

  let parsed: RawAiPayload;
  try {
    parsed = parseSeatingAiJson(input.rawText);
  } catch {
    return {
      ...fallback,
      assignments: [],
      warnings: ["AI JSON was invalid; applied a rule-based blank layout from your prompt."],
      modelUsed: `${input.modelUsed} + layout-builder`,
      imageAnalysis: input.imageAnalysis,
    };
  }

  let layoutSeats = parseLayoutSeats(parsed.layoutSeats);
  let zones = parseZones(parsed.zones);

  if (!layoutSeats.length && zones.length) {
    layoutSeats = zones.flatMap((zone) => zone.seatIds);
  }

  if (!layoutSeats.length) {
    return {
      ...fallback,
      assignments: [],
      warnings: ["AI did not return layout seats; applied a rule-based blank layout."],
      modelUsed: `${input.modelUsed} + layout-builder`,
      imageAnalysis: input.imageAnalysis,
    };
  }

  const target = input.adminPrompt ? parseTargetSeatCount(input.adminPrompt) : null;
  if (target && layoutSeats.length < target) {
    const padded = buildLayoutFromPrompt(input.adminPrompt ?? "");
    warnings.push(
      `Expanded layout to ${padded.layoutSeats.length} seats (requested ${target}).`,
    );
    layoutSeats = padded.layoutSeats;
    if (!zones.length) zones = padded.zones;
  }

  const strategy = Array.isArray(parsed.strategy)
    ? parsed.strategy.filter((line): line is string => typeof line === "string" && line.trim().length > 0)
    : fallback.strategy;

  const summary =
    typeof parsed.summary === "string" && parsed.summary.trim()
      ? parsed.summary.trim()
      : fallback.summary;

  return {
    summary,
    strategy: strategy.length ? strategy : fallback.strategy,
    layoutSeats,
    zones: zones.length ? zones : fallback.zones,
    assignments: [],
    warnings,
    modelUsed: input.modelUsed,
    imageAnalysis: input.imageAnalysis,
  };
}
