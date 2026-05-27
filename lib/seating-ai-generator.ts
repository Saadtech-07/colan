import "server-only";

import { buildLayoutFromPrompt } from "@/lib/seating-ai-layout-builder";
import { buildSeatingAiSystemPrompt, buildSeatingAiUserPrompt } from "@/lib/seating-ai-prompt";
import { parseSeatingAiResponse } from "@/lib/seating-ai-parser";
import {
  estimateMaxTokensForSeatTarget,
  parseTargetSeatCount,
} from "@/lib/seating-ai-layout-hints";
import type { SeatingAiEmployeeContext, SeatingAiSuggestion } from "@/lib/seating-ai-types";
import { isValidSeatId } from "@/lib/seating-layout";
import type { Employee } from "@/types";
import {
  getDefaultTextModel,
  getDefaultVisionModel,
  HuggingFaceInferenceError,
  runHuggingFaceImageCaption,
  runHuggingFaceTextGeneration,
} from "@/services/huggingface-inference";

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export function employeesToAiContext(employees: Employee[]): SeatingAiEmployeeContext[] {
  return employees.map((emp) => ({
    id: emp.id,
    employeeId: emp.employeeId,
    name: emp.name,
    team: emp.team,
    role: emp.role,
    currentSeat:
      emp.bayNumber && isValidSeatId(emp.bayNumber) ? emp.bayNumber : null,
  }));
}

function toLayoutSuggestion(
  layout: Pick<SeatingAiSuggestion, "summary" | "strategy" | "layoutSeats" | "zones">,
  modelUsed: string,
  warnings: string[] = [],
  imageAnalysis?: string,
): SeatingAiSuggestion {
  return {
    ...layout,
    assignments: [],
    warnings,
    modelUsed,
    imageAnalysis,
  };
}

async function requestLayoutJson(input: {
  adminPrompt: string;
  employees: SeatingAiEmployeeContext[];
  imageAnalysis?: string;
  compact?: boolean;
}): Promise<string> {
  const textModel = getDefaultTextModel();
  const target = parseTargetSeatCount(input.adminPrompt);
  const system = buildSeatingAiSystemPrompt();
  let user = buildSeatingAiUserPrompt({
    adminPrompt: input.adminPrompt,
    employees: input.employees,
    imageAnalysis: input.imageAnalysis,
  });

  if (input.compact) {
    user += `\n\nOutput ONLY minified JSON with layoutSeats and zones. Exactly ${target ?? 40} seats. No employees.`;
  }

  try {
    return await runHuggingFaceTextGeneration({
      model: textModel,
      system,
      user,
      maxNewTokens: estimateMaxTokensForSeatTarget(target),
      temperature: input.compact ? 0.05 : 0.1,
      jsonMode: true,
    });
  } catch (error) {
    if (
      error instanceof HuggingFaceInferenceError &&
      (error.status === 400 || error.status === 422)
    ) {
      return runHuggingFaceTextGeneration({
        model: textModel,
        system,
        user,
        maxNewTokens: estimateMaxTokensForSeatTarget(target),
        temperature: 0.1,
        jsonMode: false,
      });
    }
    throw error;
  }
}

async function generateFromPrompt(input: {
  adminPrompt: string;
  employees: SeatingAiEmployeeContext[];
  imageAnalysis?: string;
}): Promise<SeatingAiSuggestion> {
  const textModel = getDefaultTextModel();
  const ruleLayout = buildLayoutFromPrompt(input.adminPrompt);

  for (const compact of [false, true]) {
    try {
      const rawText = await requestLayoutJson({ ...input, compact });
      const parsed = parseSeatingAiResponse({
        rawText,
        employees: input.employees,
        modelUsed: textModel,
        imageAnalysis: input.imageAnalysis,
        adminPrompt: input.adminPrompt,
      });
      if (parsed.layoutSeats.length > 0) return parsed;
    } catch {
      // try compact pass or fall through to rules
    }
  }

  return toLayoutSuggestion(ruleLayout, "layout-builder", [
    "Used Colan floor plan rules to build a blank layout from your prompt.",
  ]);
}

export async function generateSeatingFromTextPrompt(input: {
  prompt: string;
  employees: Employee[];
}): Promise<SeatingAiSuggestion> {
  const context = employeesToAiContext(input.employees);
  return generateFromPrompt({
    adminPrompt: input.prompt,
    employees: context,
  });
}

export async function generateSeatingFromImage(input: {
  prompt?: string;
  imageBytes: Buffer;
  mimeType: string;
  employees: Employee[];
}): Promise<SeatingAiSuggestion> {
  if (input.imageBytes.length > MAX_IMAGE_BYTES) {
    throw new Error("Image must be 6 MB or smaller.");
  }

  const visionModel = getDefaultVisionModel();
  const imageAnalysis = await runHuggingFaceImageCaption({
    model: visionModel,
    imageBytes: input.imageBytes,
    mimeType: input.mimeType,
    prompt:
      "Describe desk rows, department zones, aisles, and seat groupings for an office floor plan.",
  });

  const adminPrompt =
    input.prompt?.trim() ||
    "Analyze the uploaded workspace and define a blank seating layout using valid seat IDs.";

  const context = employeesToAiContext(input.employees);
  const suggestion = await generateFromPrompt({
    adminPrompt,
    employees: context,
    imageAnalysis,
  });

  return {
    ...suggestion,
    imageAnalysis,
    modelUsed: `${visionModel} + ${getDefaultTextModel()}`,
  };
}

export { HuggingFaceInferenceError };
