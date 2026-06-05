import type { SendMessageResult } from "@/lib/chat-data";
import { getSocketServer } from "@/lib/socket-server";

export function emitChatMessageSent(result: SendMessageResult): void {
  const io = getSocketServer();
  if (!io) return;

  io.emit("receive-message", {
    message: result.message,
    conversation: result.conversation,
  });
  io.emit("conversation-updated", {
    conversationId: result.conversation.id,
    lastMessage: result.conversation.lastMessage,
    lastMessageAt: result.conversation.lastMessageAt,
  });
}
