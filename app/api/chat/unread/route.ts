import { NextResponse } from "next/server";
import { requireChatContext } from "@/lib/chat-api";
import { getUnreadMessageCount } from "@/lib/chat-data";

export async function GET() {
  const ctx = await requireChatContext();
  if (ctx instanceof NextResponse) return ctx;

  const count = await getUnreadMessageCount(ctx.actor.id);
  return NextResponse.json({ count });
}
