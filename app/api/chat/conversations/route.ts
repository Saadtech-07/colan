import { NextResponse } from "next/server";
import {
  requireChatContext,
} from "@/lib/chat-api";
import { getOnlineUserIds } from "@/lib/chat-online";
import {
  getEmployeeConversation,
  getOrCreateEmployeeConversation,
  listAdminConversations,
} from "@/lib/chat-data";

export async function GET() {
  const ctx = await requireChatContext();
  if (ctx instanceof NextResponse) return ctx;

  const online = getOnlineUserIds();

  if (ctx.actor.isAdmin) {
    const conversations = await listAdminConversations(ctx.actor.id, online);
    return NextResponse.json({
      conversations,
      role: "admin",
      currentUserId: ctx.actor.id,
    });
  }

  try {
    await getOrCreateEmployeeConversation(ctx.actor.id);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not start conversation";
    return NextResponse.json({ error: message }, { status: 503 });
  }
  const conversation = await getEmployeeConversation(ctx.actor.id, ctx.actor.id, online);
  return NextResponse.json({
    conversations: conversation ? [conversation] : [],
    role: "employee",
    currentUserId: ctx.actor.id,
  });
}
