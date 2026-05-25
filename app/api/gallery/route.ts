// import { NextResponse } from "next/server";
// import { auth } from "@/auth";
// import { createGalleryItem, listGallery } from "@/lib/data-service";
// import { canManageModule, normalizeAppRole } from "@/lib/permissions";
// import { ensureRoleRegistry } from "@/lib/role-registry.server";
// import { galleryCreateSchema } from "@/lib/validations";

// export async function GET() {
//   const session = await auth();
//   if (!session?.user) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }
//   const gallery = await listGallery();
//   return NextResponse.json(gallery);
// }

// export async function POST(req: Request) {
//   const session = await auth();
//   if (!session?.user) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }
//   await ensureRoleRegistry();
//   if (!canManageModule(normalizeAppRole(session.user.appRole), "gallery")) {
//     return NextResponse.json({ error: "Forbidden" }, { status: 403 });
//   }
//   let body: unknown;
//   try {
//     body = await req.json();
//   } catch {
//     return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
//   }
//   const parsed = galleryCreateSchema.safeParse(body);
//   if (!parsed.success) {
//     return NextResponse.json(
//       { error: "Validation failed", issues: parsed.error.flatten() },
//       { status: 400 },
//     );
//   }
//   const created = await createGalleryItem(parsed.data);
//   return NextResponse.json(created, { status: 201 });
// }

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createGalleryItem, listGallery } from "@/lib/data-service";
import { assertCanWriteGallery, sessionAccess } from "@/lib/session-access";
import { galleryCreateSchema } from "@/lib/validations";
 
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const gallery = await listGallery();
  return NextResponse.json(gallery);
}
 
export async function POST(req: Request) {
  const session = await auth();
  const access = await sessionAccess(session);
  if (!access) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const forbidden = assertCanWriteGallery(access);
  if (forbidden) {
    return NextResponse.json({ error: forbidden }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = galleryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const created = await createGalleryItem(parsed.data);
  return NextResponse.json(created, { status: 201 });
}