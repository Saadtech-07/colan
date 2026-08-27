import { NextResponse } from "next/server";
import { requireChatContext } from "@/lib/chat-api";
import {
  assertConversationAccess,
  getConversationById,
  markConversationRead,
} from "@/lib/chat-data";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
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

  const modified = await markConversationRead({
    conversationId: id,
    readerId: ctx.actor.id,
  });

  return NextResponse.json({ modified });
}
