import { NextResponse } from "next/server";
import { assertCanSend, requireChatContext } from "@/lib/chat-api";
import { searchChatRecipients } from "@/lib/chat-data";
import { getOnlineUserIds } from "@/lib/chat-online";

export async function GET(req: Request) {
  const ctx = await requireChatContext();
  if (ctx instanceof NextResponse) return ctx;

  const sendDenied = assertCanSend(ctx.actor);
  if (sendDenied) return NextResponse.json({ error: sendDenied }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") ?? "";

  const users = await searchChatRecipients({
    viewerUserId: ctx.actor.id,
    query,
    onlineUserIds: getOnlineUserIds(),
  });

  return NextResponse.json({ users });
}
