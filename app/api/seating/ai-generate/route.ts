import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureServerEnvLoaded, isOpenRouterConfigured } from "@/lib/openrouter-env";
import {
  generateSeatingFromImage,
  generateSeatingFromTextPrompt,
  OpenRouterInferenceError,
} from "@/lib/seating-ai-generator";
import { listEmployees } from "@/lib/data-service";
import { canAssignSeating, normalizeAppRole } from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { seatingAiGenerateSchema } from "@/lib/validations";

export const maxDuration = 120;

export async function POST(req: Request) {
  ensureServerEnvLoaded();

  if (!isOpenRouterConfigured()) {
    return NextResponse.json(
      {
        error:
          "OPENROUTER_API_KEY is not configured. Add it to .env.local, save the file, and restart the dev server.",
      },
      { status: 503 },
    );
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureRoleRegistry();
  const roleKey = normalizeAppRole(session.user.appRole);
  if (!canAssignSeating(roleKey)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = seatingAiGenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const employees = await listEmployees();

    if (parsed.data.mode === "text") {
      const suggestion = await generateSeatingFromTextPrompt({
        prompt: parsed.data.prompt,
        employees,
      });
      return NextResponse.json(suggestion);
    }

    const base64 = parsed.data.imageBase64.replace(/^data:[^;]+;base64,/, "");
    const imageBytes = Buffer.from(base64, "base64");
    if (!imageBytes.length) {
      return NextResponse.json({ error: "Invalid image payload." }, { status: 400 });
    }

    const suggestion = await generateSeatingFromImage({
      prompt: parsed.data.prompt,
      imageBytes,
      mimeType: parsed.data.mimeType,
      employees,
    });

    return NextResponse.json(suggestion);
  } catch (error) {
    if (error instanceof OpenRouterInferenceError) {
      return NextResponse.json(
        {
          error: error.message,
          details: error.details,
        },
        { status: error.status ?? 502 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI seating generation failed.",
      },
      { status: 400 },
    );
  }
}
