import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  updateGalleryItem,
  deleteGalleryItem,
} from "@/lib/data-service";
import { assertCanWriteGallery, sessionAccess } from "@/lib/session-access";
import { galleryCreateSchema } from "@/lib/validations";
 
type RouteParams = { params: Promise<{ id: string }> };
 
export async function PUT(req: Request, { params }: RouteParams) {
  const session = await auth();
  const access = await sessionAccess(session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const forbidden = assertCanWriteGallery(access);
  if (forbidden) {
    return NextResponse.json({ error: forbidden }, { status: 403 });
  }
 
  const { id } = await params;
 
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
 
  const parsed = galleryCreateSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
 
  try {
    const updated = await updateGalleryItem(id, parsed.data);
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof Error && e.message === "Gallery item not found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw e;
  }
}
 
export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await auth();
  const access = await sessionAccess(session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const forbidden = assertCanWriteGallery(access);
  if (forbidden) {
    return NextResponse.json({ error: forbidden }, { status: 403 });
  }
 
  const { id } = await params;
 
  try {
    await deleteGalleryItem(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Error && e.message === "Gallery item not found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw e;
  }
}
 