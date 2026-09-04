import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getChatActorByEmail } from "@/lib/chat-data";
import { resolveAppUserId } from "@/lib/resolve-app-user-id";
import type { AppRole } from "@/types";

export type NotificationActor = {
  id: string;
  name: string;
  email: string;
  appRole?: AppRole;
};

export async function requireNotificationActor(): Promise<
  NotificationActor | NextResponse
> {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUserId = await resolveAppUserId(session);
  if (!appUserId) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return {
    id: appUserId,
    name: session.user.name?.trim() || session.user.email,
    email: session.user.email,
    appRole: session.user.appRole,
  };
}

/** Full actor profile — use when name/avatar from employee record is required. */
export async function requireNotificationActorWithProfile(): Promise<
  NotificationActor | NextResponse
> {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = await getChatActorByEmail(session.user.email);
  if (!actor) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return {
    id: actor.id,
    name: actor.name,
    email: actor.email,
    appRole: actor.appRole as AppRole,
  };
}

export async function resolveAssignmentActorFromEmail(
  email?: string | null,
): Promise<{ id: string; name: string } | undefined> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return undefined;
  const actor = await getChatActorByEmail(normalized);
  if (!actor) return undefined;
  return { id: actor.id, name: actor.name };
}
