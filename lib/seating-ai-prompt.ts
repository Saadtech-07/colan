import { buildTargetSeatInstruction } from "@/lib/seating-ai-layout-hints";
import { ALL_SEAT_IDS, SEATING_ROWS } from "@/lib/seating-layout";
import type { SeatingAiEmployeeContext } from "@/lib/seating-ai-types";

function seatCatalog(): string {
  return SEATING_ROWS.map((row) => {
    const ids = [...row.top, ...row.bottom]
      .filter((c) => c.kind === "seat")
      .map((c) => c.id);
    return `${row.label}: ${ids.join(", ")}`;
  }).join("\n");
}

export function buildSeatingAiSystemPrompt(): string {
  return [
    "You are an expert workplace seating planner for Colan Infotech.",
    "You must output ONLY one JSON object (no markdown, no commentary).",
    "Do NOT assign employees to seats. Only define which desk/seat IDs belong in the new layout.",
    "Use exact seat IDs from the catalog (e.g. A1, B12, G32).",
    "Never include employee names or employeeId in the response.",
    "JSON schema:",
    JSON.stringify(
      {
        summary: "short overview of the blank layout",
        strategy: ["bullet 1", "bullet 2"],
        layoutSeats: ["A1", "A2"],
        zones: [
          {
            id: "engineering",
            label: "Engineering (left)",
            seatIds: ["A1", "A2"],
          },
        ],
      },
      null,
      0,
    ),
  ].join("\n");
}

export function buildSeatingAiUserPrompt(input: {
  adminPrompt: string;
  employees: SeatingAiEmployeeContext[];
  imageAnalysis?: string;
}): string {
  const sections = [
    `Admin request:\n${input.adminPrompt.trim()}`,
    `Valid seat catalog (${ALL_SEAT_IDS.length} seats on the Colan floor plan):\n${seatCatalog()}`,
  ];

  if (input.imageAnalysis?.trim()) {
    sections.push(`Uploaded layout image analysis:\n${input.imageAnalysis.trim()}`);
  }

  const targetInstruction = buildTargetSeatInstruction(input.adminPrompt);
  if (targetInstruction) {
    sections.push(targetInstruction);
  }

  sections.push(
    "Return layout JSON only. layoutSeats must list every desk in the new empty layout. assignments must be omitted or [].",
  );

  return sections.join("\n\n");
}
