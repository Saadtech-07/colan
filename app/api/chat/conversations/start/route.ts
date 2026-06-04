import { NextResponse } from "next/server";
import { assertAdminInbox, requireChatContext } from "@/lib/chat-api";
import { startAdminConversationWithUser } from "@/lib/chat-data";
import { getOnlineUserIds } from "@/lib/chat-online";
import { z } from "zod";

const startSchema = z.object({
  targetUserId: z.string().trim().min(1),
});

export async function POST(req: Request) {
  const ctx = await requireChatContext();
  if (ctx instanceof NextResponse) return ctx;

  if (!ctx.actor.isAdmin) {
    return NextResponse.json({ error: "Only admins can start conversations." }, { status: 403 });
  }

  const denied = assertAdminInbox(ctx.actor);
  if (denied) return NextResponse.json({ error: denied }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const conversation = await startAdminConversationWithUser(
      ctx.actor.id,
      parsed.data.targetUserId,
      getOnlineUserIds(),
    );
    if (!conversation) {
      return NextResponse.json({ error: "Could not start conversation" }, { status: 500 });
    }
    return NextResponse.json({ conversation });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to start conversation";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
