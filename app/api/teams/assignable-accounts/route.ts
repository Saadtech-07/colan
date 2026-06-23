import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listTeamAssignableAccounts } from "@/lib/app-users";
import { ensureRoleRegistry } from "@/lib/role-registry.server";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.appRole !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await ensureRoleRegistry();
  const accounts = await listTeamAssignableAccounts();
  return NextResponse.json(accounts);
}
