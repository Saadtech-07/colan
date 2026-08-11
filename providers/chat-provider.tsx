"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useSession } from "@/components/providers/auth-session-provider";
import { io, type Socket } from "socket.io-client";
import { canAccessChat } from "@/lib/chat-access";
import {
  appendMessage,
  mergeConversationPreview,
  sortConversations,
} from "@/lib/chat-client";
import { dedupeAsync } from "@/lib/dedupe-async";
import { scheduleIdle } from "@/lib/schedule-idle";
import { isChatRoute } from "@/lib/workspace-route-data";
import { useAppState } from "@/providers/app-state";
import type { MessageDTO } from "@/models";
import type { ChatConversationSummary } from "@/types/chat";

type ChatContextValue = {
  connected: boolean;
  currentUserId: string | null;
  isAdmin: boolean;
  conversations: ChatConversationSummary[];
  activeConversationId: string | null;
  messages: MessageDTO[];
  loadingConversations: boolean;
  loadingMessages: boolean;
  unreadTotal: number;
  loadError: string | null;
  setActiveConversationId: (id: string | null) => void;
  sendMessage: (text: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
  refreshUnread: () => Promise<void>;
};

const ChatContext = React.createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const onChatPage = isChatRoute(pathname);
  const { data: session, status } = useSession();
  const { access } = useAppState();
  const canUseChat = !!access && canAccessChat(access.role);

  const [socket, setSocket] = React.useState<Socket | null>(null);
  const [connected, setConnected] = React.useState(false);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [conversations, setConversations] = React.useState<ChatConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<MessageDTO[]>([]);
  const [loadingConversations, setLoadingConversations] = React.useState(false);
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const [unreadTotal, setUnreadTotal] = React.useState(0);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const activeIdRef = React.useRef<string | null>(null);
  const currentUserIdRef = React.useRef<string | null>(null);
  const chatBootstrappedRef = React.useRef(false);
  const conversationsBootstrappedRef = React.useRef(false);

  React.useEffect(() => {
    activeIdRef.current = activeConversationId;
  }, [activeConversationId]);

  React.useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  const refreshUnread = React.useCallback(async () => {
    if (!canUseChat) return;
    try {
      const data = await dedupeAsync(
        "chat:unread",
        async () => {
          const res = await fetch("/api/chat/unread", { credentials: "include" });
          if (!res.ok) return { count: 0 };
          return (await res.json()) as { count: number };
        },
        { ttlMs: 5_000 },
      );
      setUnreadTotal(data.count);
    } catch {
      /* ignore */
    }
  }, [canUseChat]);

  const [loadError, setLoadError] = React.useState<string | null>(null);

  const refreshConversations = React.useCallback(async () => {
    if (!canUseChat) return;
    setLoadingConversations(true);
    setLoadError(null);
    try {
      const data = await dedupeAsync("chat:conversations", async () => {
        const res = await fetch("/api/chat/conversations", { credentials: "include" });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(err.error ?? `Could not load conversations (${res.status})`);
        }
        return (await res.json()) as {
          conversations: ChatConversationSummary[];
          currentUserId: string;
        };
      });
      setIsAdmin(true);
      setCurrentUserId(data.currentUserId);
      const sorted = sortConversations(data.conversations);
      setConversations(sorted);
      if (!activeIdRef.current && sorted.length > 0) {
        setActiveConversationId(sorted[0].id);
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load conversations");
    } finally {
      setLoadingConversations(false);
    }
  }, [canUseChat]);

  const refreshConversationsRef = React.useRef(refreshConversations);
  const refreshUnreadRef = React.useRef(refreshUnread);
  refreshConversationsRef.current = refreshConversations;
  refreshUnreadRef.current = refreshUnread;

  const loadMessages = React.useCallback(async (conversationId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { messages: MessageDTO[] };
      setMessages(data.messages);
      await fetch(`/api/chat/conversations/${conversationId}/read`, {
        method: "POST",
        credentials: "include",
      });
      if (socket?.connected) {
        socket.emit("mark-as-read", { conversationId });
      }
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
      );
      await refreshUnreadRef.current();
    } finally {
      setLoadingMessages(false);
    }
  }, [socket]);

  React.useEffect(() => {
    if (status !== "authenticated" || !canUseChat) {
      chatBootstrappedRef.current = false;
      conversationsBootstrappedRef.current = false;
      return;
    }

    let cancelIdle: (() => void) | undefined;

    // Defer unread badge so dashboard/workspace APIs are not competing on first paint.
    if (!chatBootstrappedRef.current) {
      cancelIdle = scheduleIdle(() => {
        if (chatBootstrappedRef.current) return;
        chatBootstrappedRef.current = true;
        void refreshUnreadRef.current();
      }, 2_500);
    }

    // Full inbox only on the chat page (immediate — user is already there).
    if (onChatPage && !conversationsBootstrappedRef.current) {
      conversationsBootstrappedRef.current = true;
      void refreshConversationsRef.current();
    }

    return () => {
      cancelIdle?.();
    };
  }, [status, canUseChat, onChatPage]);

  React.useEffect(() => {
    if (!onChatPage) {
      setActiveConversationId(null);
      setMessages([]);
    }
  }, [onChatPage]);

  React.useEffect(() => {
    if (!onChatPage || !activeConversationId) {
      if (!onChatPage) return;
      setMessages([]);
      return;
    }
    void loadMessages(activeConversationId);
  }, [activeConversationId, loadMessages, onChatPage]);

  React.useEffect(() => {
    if (status !== "authenticated" || !canUseChat || !session?.user) return;

    const instance = io({
      path: "/api/socket/io",
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    setSocket(instance);

    instance.on("connect", () => setConnected(true));
    instance.on("disconnect", () => setConnected(false));

    instance.on("receive-message", (payload: { message: MessageDTO; conversation: { id: string; lastMessage: string; lastMessageAt: string } }) => {
      const { message, conversation } = payload;
      setConversations((prev) =>
        mergeConversationPreview(prev, {
          conversationId: conversation.id,
          lastMessage: conversation.lastMessage,
          lastMessageAt: conversation.lastMessageAt,
        }),
      );

      if (activeIdRef.current === conversation.id) {
        setMessages((prev) => appendMessage(prev, message));
        void fetch(`/api/chat/conversations/${conversation.id}/read`, {
          method: "POST",
          credentials: "include",
        });
      } else {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversation.id
              ? {
                  ...c,
                  unreadCount:
                    message.receiverId === currentUserIdRef.current
                      ? c.unreadCount + 1
                      : c.unreadCount,
                }
              : c,
          ),
        );
      }
      void refreshUnreadRef.current();
    });

    instance.on("conversation-updated", (payload: { conversationId: string; lastMessage: string; lastMessageAt: string }) => {
      setConversations((prev) =>
        mergeConversationPreview(prev, {
          conversationId: payload.conversationId,
          lastMessage: payload.lastMessage,
          lastMessageAt: payload.lastMessageAt,
        }),
      );
    });

    instance.on("messages-read", (payload: { conversationId: string; readerId: string }) => {
      if (activeIdRef.current !== payload.conversationId) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.receiverId === payload.readerId ? { ...m, isRead: true } : m,
        ),
      );
    });

    instance.on("user-status", (payload: { userId: string; isOnline: boolean }) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.participant.id === payload.userId
            ? { ...c, participant: { ...c.participant, isOnline: payload.isOnline } }
            : c,
        ),
      );
    });

    return () => {
      instance.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [status, canUseChat, session?.user?.email]);

  const sendMessage = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !activeConversationId) return;

      const res = await fetch(`/api/chat/conversations/${activeConversationId}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Failed to send message");
      }
      const data = (await res.json()) as { message: MessageDTO };
      setMessages((prev) => appendMessage(prev, data.message));
      await refreshConversations();
    },
    [activeConversationId, refreshConversations],
  );

  const value = React.useMemo<ChatContextValue>(
    () => ({
      connected,
      currentUserId,
      isAdmin,
      conversations,
      activeConversationId,
      messages,
      loadingConversations,
      loadingMessages,
      unreadTotal,
      loadError,
      setActiveConversationId,
      sendMessage,
      refreshConversations,
      refreshUnread,
    }),
    [
      connected,
      currentUserId,
      isAdmin,
      conversations,
      activeConversationId,
      messages,
      loadingConversations,
      loadingMessages,
      unreadTotal,
      loadError,
      sendMessage,
      refreshConversations,
      refreshUnread,
    ],
  );

  if (!canUseChat) {
    return <>{children}</>;
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = React.useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChat must be used within ChatProvider when chat is enabled");
  }
  return ctx;
}

export function useChatSafe() {
  return React.useContext(ChatContext);
}

export function useChatUnread() {
  const ctx = React.useContext(ChatContext);
  return ctx?.unreadTotal ?? 0;
}
