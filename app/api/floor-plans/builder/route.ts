import { NextResponse } from "next/server";
import { requireTenantContext } from "@/lib/api/tenant-context";
import { createFloorWithBuilderLayout } from "@/lib/floor-plan-layouts.server";
import { canAssignSeating, canManageModule, normalizeAppRole } from "@/lib/permissions";
import { createEmptyLayout } from "@/lib/floor-plan-builder/layout-engine";
import { z } from "zod";

const createBodySchema = z.object({
  name: z.string().min(1),
  city: z.string().optional(),
  slug: z.string().optional(),
  layout: z
    .object({
      name: z.string().optional(),
      grid: z.object({ rows: z.number(), columns: z.number() }).optional(),
      elements: z.array(z.unknown()).optional(),
    })
    .optional(),
});

export async function POST(req: Request) {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return ctx;

  const roleKey = normalizeAppRole(ctx.session.user.appRole);
  if (!canAssignSeating(roleKey) && !canManageModule(roleKey, "seating")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const baseLayout = createEmptyLayout(parsed.data.name);
    const result = await createFloorWithBuilderLayout(ctx.companyId, {
      name: parsed.data.name,
      city: parsed.data.city,
      slug: parsed.data.slug,
      layout: {
        ...baseLayout,
        name: parsed.data.name,
        grid: parsed.data.layout?.grid ?? baseLayout.grid,
        elements: (parsed.data.layout?.elements ?? []) as typeof baseLayout.elements,
      },
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create floor." },
      { status: 400 },
    );
  }
}
