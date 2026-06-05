import { NextResponse } from "next/server";
import { requireChatContext } from "@/lib/chat-api";
import { getOnlineUserIds } from "@/lib/chat-online";
import {
  assertConversationAccess,
  getConversationById,
  getConversationDetail,
} from "@/lib/chat-data";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const ctx = await requireChatContext();
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  const conversation = await getConversationById(id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const denied = assertConversationAccess(ctx.actor, conversation);
  if (denied) {
    return NextResponse.json({ error: denied }, { status: 403 });
  }

  const online = getOnlineUserIds();
  const detail = await getConversationDetail(id, ctx.actor.id, online);

  if (!detail) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
