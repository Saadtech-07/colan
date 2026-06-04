import { NextResponse } from "next/server";
import { assertAdminInbox, requireChatContext } from "@/lib/chat-api";
import { searchChatRecipients } from "@/lib/chat-data";
import { getOnlineUserIds } from "@/lib/chat-online";

export async function GET(req: Request) {
  const ctx = await requireChatContext();
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.actor.isAdmin) {
    return NextResponse.json({ error: "Only admins can search users." }, { status: 403 });
  }

  const denied = assertAdminInbox(ctx.actor);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") ?? "";

  const users = await searchChatRecipients({
    adminUserId: ctx.actor.id,
    query,
    onlineUserIds: getOnlineUserIds(),
  });

  return NextResponse.json({ users });
}
