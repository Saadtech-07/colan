import type { MessageDTO } from "@/models";
import type { ChatConversationSummary } from "@/types/chat";

export function formatChatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function sortConversations(list: ChatConversationSummary[]): ChatConversationSummary[] {
  return [...list].sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );
}

export function mergeConversationPreview(
  list: ChatConversationSummary[],
  update: {
    conversationId: string;
    lastMessage: string;
    lastMessageAt: string;
  },
): ChatConversationSummary[] {
  return sortConversations(
    list.map((item) =>
      item.id === update.conversationId
        ? { ...item, lastMessage: update.lastMessage, lastMessageAt: update.lastMessageAt }
        : item,
    ),
  );
}

export function appendMessage(messages: MessageDTO[], message: MessageDTO): MessageDTO[] {
  if (messages.some((m) => m.id === message.id)) return messages;
  return [...messages, message];
}
