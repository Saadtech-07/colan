import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireSessionCompanyIdAsync } from "@/lib/tenant-scope";
import type { Session } from "@/types/auth";

export type TenantContext = {
  session: Session;
  companyId: string;
};

import { isPlatformSessionUser } from "@/lib/platform/platform-users";

export async function requireTenantContext(): Promise<TenantContext | NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isPlatformSessionUser(session.user)) {
    return NextResponse.json(
      { error: "Platform accounts cannot access tenant workspace APIs." },
      { status: 403 },
    );
  }
  try {
    const companyId = await requireSessionCompanyIdAsync(session);
    return {
      session: {
        ...session,
        user: { ...session.user, companyId },
      },
      companyId,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "No workspace assigned.";
    return NextResponse.json({ error: msg }, { status: 403 });
  }
}
