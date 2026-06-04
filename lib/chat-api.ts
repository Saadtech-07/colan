import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessChat, canManageChatInbox, canSendChat } from "@/lib/chat-access";
import { getChatActorByEmail } from "@/lib/chat-data";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
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

export function chatForbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function assertCanSend(actor: ChatActor): string | null {
  if (!canSendChat(actor.appRole)) {
    return "You do not have permission to send messages.";
  }
  return null;
}

export function assertAdminInbox(actor: ChatActor): string | null {
  if (!canManageChatInbox(actor.appRole)) {
    return "Only workspace admins can access the shared inbox.";
  }
  return null;
}
