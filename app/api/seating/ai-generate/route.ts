import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureServerEnvLoaded, isOpenRouterConfigured } from "@/lib/openrouter-env";
import {
  generateSeatingFromTextPrompt,
  SeatingAiGenerationError,
} from "@/lib/seating-ai-generator";
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
    const suggestion = await generateSeatingFromTextPrompt({
      prompt: parsed.data.prompt,
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
