import type { LayoutAnalysisResult } from "@/lib/opencv-types/layout";
import type { GeneratedSeatingLayout } from "@/lib/seating-layout-types";
import type { SeatingAiSuggestion } from "@/lib/seating-ai-types";
import { convertAnalysisToAiLayout } from "@/lib/opencv-analysis-to-ai-layout";

export function buildSuggestionFromOpenCvAnalysis(
  analysis: LayoutAnalysisResult,
  options?: { notes?: string; fileName?: string },
): SeatingAiSuggestion {
  const aiData = convertAnalysisToAiLayout(analysis, {
    name: options?.fileName?.replace(/\.[^.]+$/, "") ?? "Uploaded floor plan",
  });

  const sourceLabel = options?.notes?.trim()
    ? `Uploaded layout (${options.notes.trim()})`
    : "Uploaded layout image";

  const layout: GeneratedSeatingLayout = {
    id: `layout_${Date.now()}`,
    name: aiData.name,
    prompt: sourceLabel,
    room: aiData.room,
    seats: aiData.seats.map((seat) => ({ ...seat, status: "empty" as const })),
    pillars: aiData.pillars ?? [],
    walls: aiData.walls ?? [],
    groups: aiData.groups ?? [],
    createdAt: new Date().toISOString(),
  };

  const layoutSeats = layout.seats.map((seat) => seat.label);
  const idToLabel = new Map(layout.seats.map((seat) => [seat.id, seat.label]));

  const zones =
    aiData.groups && aiData.groups.length > 0
      ? aiData.groups.map((group) => ({
          id: group.id,
          label: group.name,
          seatIds: group.seatIds
            .map((seatId) => idToLabel.get(seatId))
            .filter((label): label is string => Boolean(label)),
        }))
      : [
          {
            id: "layout",
            label: aiData.name,
            seatIds: layoutSeats,
          },
        ];

  const warnings: string[] = [];
  if (layout.seats.length === 0) {
    warnings.push(
      "No desk shapes were detected. Try a higher-contrast PNG or JPG of the floor plan.",
    );
  }

  return {
    summary: aiData.name,
    description: aiData.description,
    strategy: [
      "Layout generated locally with OpenCV.js (no API call).",
      ...analysis.processing.steps.slice(-4),
    ],
    layoutSeats,
    zones,
    layout,
    assignments: [],
    warnings,
    modelUsed: `opencv/${analysis.processing.method}`,
    imageAnalysis: analysis.processing.steps.join("\n"),
  };
}
