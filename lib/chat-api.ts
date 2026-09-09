import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessChat, canSendChat } from "@/lib/chat-access";
import { getChatActorByEmail } from "@/lib/chat-data";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import { resolveAppUserId } from "@/lib/resolve-app-user-id";
import { sessionAccess } from "@/lib/session-access";
import type { ChatActor } from "@/lib/chat-data";

export type ChatRequestContext = {
  actor: ChatActor;
};

export async function requireChatContext(): Promise<ChatRequestContext | NextResponse> {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensureRoleRegistry();
  const access = sessionAccess(session);
  const roleKey = access?.role ?? session.user.appRole;
  if (!access || !canAccessChat(roleKey)) {
    return NextResponse.json(
      { error: "You do not have permission to use Messages." },
      { status: 403 },
    );
  }

  const actor = await getChatActorByEmail(session.user.email);
  if (!actor) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return { actor };
}

/** Lightweight auth for unread badge — skips role registry and employee profile lookup. */
export async function requireChatUnreadContext(): Promise<
  { actorId: string } | NextResponse
> {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = sessionAccess(session);
  if (!access || !canAccessChat(access.role)) {
    return NextResponse.json(
      { error: "You do not have permission to use Messages." },
      { status: 403 },
    );
  }

  const actorId = await resolveAppUserId(session);
  if (!actorId) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  return { actorId };
}

export function assertCanSend(actor: ChatActor): string | null {
  if (!canSendChat(actor.appRole)) {
    return "You do not have permission to send messages.";
  }
  return null;
}

