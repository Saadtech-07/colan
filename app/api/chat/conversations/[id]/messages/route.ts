import { NextResponse } from "next/server";
import { assertCanSend, requireChatContext } from "@/lib/chat-api";
import {
  assertConversationAccess,
  getConversationById,
  listMessages,
  sendChatMessage,
} from "@/lib/chat-data";
import { chatSendMessageSchema } from "@/lib/validations";

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

  const messages = await listMessages(id);
  return NextResponse.json({ messages });
}

export async function POST(req: Request, { params }: Params) {
  const ctx = await requireChatContext();
  if (ctx instanceof NextResponse) return ctx;

  const sendDenied = assertCanSend(ctx.actor);
  if (sendDenied) {
    return NextResponse.json({ error: sendDenied }, { status: 403 });
  }

  const { id } = await params;
  const conversation = await getConversationById(id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const denied = assertConversationAccess(ctx.actor, conversation);
  if (denied) {
    return NextResponse.json({ error: denied }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = chatSendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await sendChatMessage({
      conversationId: id,
      senderId: ctx.actor.id,
      text: parsed.data.text,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to send message";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
