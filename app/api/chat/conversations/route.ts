import { NextResponse } from "next/server";
import { requireChatContext } from "@/lib/chat-api";
import { getOnlineUserIds } from "@/lib/chat-online";
import { listUserConversations } from "@/lib/chat-data";

export async function GET() {
  const ctx = await requireChatContext();
  if (ctx instanceof NextResponse) return ctx;

  const online = getOnlineUserIds();
  const conversations = await listUserConversations(ctx.actor.id, online);

  return NextResponse.json({
    conversations,
    currentUserId: ctx.actor.id,
  });
}
