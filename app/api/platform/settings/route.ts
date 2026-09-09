import { NextResponse } from "next/server";
import { requirePlatformContext } from "@/lib/api/platform-context";

const DEFAULT_SETTINGS = {
  platformName: "Colan Platform",
  supportEmail: "support@colan.io",
  defaultTenantStatus: "active" as const,
};

export async function GET() {
  const ctx = await requirePlatformContext();
  if (ctx instanceof Response) return ctx;
  return NextResponse.json({ settings: DEFAULT_SETTINGS });
}

export async function PATCH(req: Request) {
  const ctx = await requirePlatformContext();
  if (ctx instanceof Response) return ctx;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  return NextResponse.json({
    settings: { ...DEFAULT_SETTINGS, ...(body as Record<string, unknown>) },
    note: "Platform settings persistence can be extended in a future release.",
  });
}
