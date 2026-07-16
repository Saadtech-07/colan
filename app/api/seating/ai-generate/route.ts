import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureServerEnvLoaded, isSeatingAiConfigured } from "@/lib/openai-env";
import {
  generateSeatingFromImage,
  generateSeatingFromTextPrompt,
  SeatingAiGenerationError,
} from "@/lib/seating-ai-generator";
import { canAssignSeating, normalizeAppRole } from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { seatingAiGenerateSchema } from "@/lib/validations";

export const maxDuration = 120;

export async function POST(req: Request) {
  ensureServerEnvLoaded();

  if (!isSeatingAiConfigured()) {
    return NextResponse.json(
      {
        error:
          "No AI provider configured. Add OPENROUTER_API_KEY to .env.local (recommended), save, and restart the dev server.",
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
    const suggestion =
      parsed.data.mode === "text"
        ? await generateSeatingFromTextPrompt({ prompt: parsed.data.prompt })
        : await generateSeatingFromImage({
            imageBytes: Buffer.from(
              parsed.data.imageBase64.replace(/^data:[^;]+;base64,/, ""),
              "base64",
            ),
            mimeType: parsed.data.mimeType,
            notes: parsed.data.notes,
          });
    return NextResponse.json(suggestion);
  } catch (error) {
    if (error instanceof SeatingAiGenerationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "AI seating generation failed.",
      },
      { status: 400 },
    );
  }
}
