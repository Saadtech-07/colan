import { NextResponse } from "next/server";
import { assertCanSend, requireChatContext } from "@/lib/chat-api";
import { findAppUserIdForEmployeeMongoId } from "@/lib/notifications-data";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  const ctx = await requireChatContext();
  if (ctx instanceof NextResponse) return ctx;

  const sendDenied = assertCanSend(ctx.actor);
  if (sendDenied) return NextResponse.json({ error: sendDenied }, { status: 403 });

  const { id } = await context.params;
  const userId = await findAppUserIdForEmployeeMongoId(id);

  if (!userId) {
    return NextResponse.json(
      { error: "No messaging account found for this employee" },
      { status: 404 },
    );
  }

  return NextResponse.json({ userId });
}
