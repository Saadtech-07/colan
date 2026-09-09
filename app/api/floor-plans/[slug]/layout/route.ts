import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireTenantContext } from "@/lib/api/tenant-context";
import {
  getFloorPlanLayout,
  publishFloorPlanLayout,
  saveFloorPlanLayoutDraft,
} from "@/lib/floor-plan-layouts.server";
import { canAssignSeating, canManageModule, normalizeAppRole } from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { z } from "zod";

const layoutElementSchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  parentId: z.string().nullable(),
  row: z.number(),
  column: z.number(),
  width: z.number(),
  height: z.number(),
  rotation: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]).optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
  seatId: z.string().optional(),
  mergeGroupId: z.string().optional(),
});

const workspaceBlockSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  grid: z.object({ rows: z.number().min(4), columns: z.number().min(4) }),
  elements: z.array(layoutElementSchema),
});

const layoutBodySchema = z.object({
  name: z.string().min(1),
  status: z.enum(["draft", "published"]).optional(),
  version: z.number().optional(),
  grid: z.object({ rows: z.number().min(4), columns: z.number().min(4) }),
  elements: z.array(layoutElementSchema),
  blocks: z.array(workspaceBlockSchema).optional(),
});

type RouteParams = { params: Promise<{ slug: string }> };

async function assertLayoutAccess() {
  const ctx = await requireTenantContext();
  if (ctx instanceof Response) return { error: ctx };
  await ensureRoleRegistry(ctx.companyId);
  const roleKey = normalizeAppRole(ctx.session.user.appRole);
  if (!canAssignSeating(roleKey) && !canManageModule(roleKey, "seating")) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ctx };
}

export async function GET(req: Request, { params }: RouteParams) {
  const access = await assertLayoutAccess();
  if ("error" in access && access.error) return access.error;

  const { slug } = await params;
  const status = new URL(req.url).searchParams.get("status") === "published" ? "published" : "draft";

  const layout = await getFloorPlanLayout(access.ctx!.companyId, slug, status);
  if (!layout) {
    return NextResponse.json({ error: "Layout not found." }, { status: 404 });
  }
  return NextResponse.json(layout);
}

export async function PUT(req: Request, { params }: RouteParams) {
  const access = await assertLayoutAccess();
  if ("error" in access && access.error) return access.error;

  const { slug } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = layoutBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const saved = await saveFloorPlanLayoutDraft(access.ctx!.companyId, slug, {
      ...parsed.data,
      status: "draft",
      version: parsed.data.version ?? 0,
      floorPlanSlug: slug,
      elements: parsed.data.elements as import("@/lib/floor-plan-builder/types").FloorPlanElement[],
      blocks: parsed.data.blocks as import("@/lib/floor-plan-builder/types").WorkspaceBlock[] | undefined,
    });
    return NextResponse.json(saved);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save layout." },
      { status: 400 },
    );
  }
}

export async function POST(req: Request, { params }: RouteParams) {
  const access = await assertLayoutAccess();
  if ("error" in access && access.error) return access.error;

  const { slug } = await params;
  const action = new URL(req.url).searchParams.get("action");
  if (action !== "publish") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = layoutBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const session = await auth();
  const user = session?.user;
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const published = await publishFloorPlanLayout(
      access.ctx!.companyId,
      slug,
      {
        ...parsed.data,
        status: "draft",
        version: parsed.data.version ?? 0,
        floorPlanSlug: slug,
        elements: parsed.data.elements as import("@/lib/floor-plan-builder/types").FloorPlanElement[],
        blocks: parsed.data.blocks as import("@/lib/floor-plan-builder/types").WorkspaceBlock[] | undefined,
      },
      {
        userId: user.email,
        name: user.name ?? user.email,
        email: user.email,
      },
    );
    return NextResponse.json(published);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to publish layout." },
      { status: 400 },
    );
  }
}
