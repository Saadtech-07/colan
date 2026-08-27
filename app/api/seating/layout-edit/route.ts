import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { editColanLayoutWithAi, LayoutEditorError } from "@/lib/seating-layout-editor-ai";
import { ensureServerEnvLoaded } from "@/lib/openai-env";
import { canAssignSeating, normalizeAppRole } from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { seatingLayoutEditSchema } from "@/lib/validations";

export const maxDuration = 60;

export async function POST(req: Request) {
  ensureServerEnvLoaded();

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

  const parsed = seatingLayoutEditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await editColanLayoutWithAi({
      layout: parsed.data.layout,
      prompt: parsed.data.prompt,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof LayoutEditorError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Layout edit failed." },
      { status: 400 },
    );
  }
}
