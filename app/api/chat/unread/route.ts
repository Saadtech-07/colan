import { NextResponse } from "next/server";
import { requireChatUnreadContext } from "@/lib/chat-api";
import { getUnreadMessageCount } from "@/lib/chat-data";

export async function GET() {
  const ctx = await requireChatUnreadContext();
  if (ctx instanceof NextResponse) return ctx;

  const count = await getUnreadMessageCount(ctx.actorId);
  return NextResponse.json({ count });
}
