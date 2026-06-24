"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { profileInitials } from "@/lib/profile-image";
import { cn } from "@/lib/utils";
import { useChatSafe } from "@/providers/chat-provider";
import { AdminChatSidebar } from "@/components/chat/admin-chat-sidebar";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatMessageList } from "@/components/chat/chat-message-list";
import type { ChatConversationSummary } from "@/types/chat";

function ChatHeader({
  name,
  imageUrl,
  subtitle,
  isOnline,
  onBack,
}: {
  name: string;
  imageUrl: string;
  subtitle: string;
  isOnline: boolean;
  onBack?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border/60 bg-background/95 px-3 py-3 sm:gap-3 sm:px-4">
      {onBack ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full md:hidden"
          onClick={onBack}
          aria-label="Back to conversations"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      ) : null}
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarImage src={imageUrl} alt={name} />
        <AvatarFallback>{profileInitials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <span
        className={cn(
          "hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium sm:inline-flex",
          isOnline
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "bg-muted text-muted-foreground",
        )}
      >
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            isOnline ? "bg-emerald-500" : "bg-muted-foreground/50",
          )}
        />
        {isOnline ? "Online" : "Offline"}
      </span>
    </div>
  );
}

export function ChatWorkspace() {
  const chat = useChatSafe();
  const searchParams = useSearchParams();
  const withEmployeeId = searchParams.get("with")?.trim() ?? "";
  const deepLinkHandledRef = React.useRef<string | null>(null);

  const conversations = chat?.conversations ?? [];
  const loadingConversations = chat?.loadingConversations ?? false;
  const openConversation = chat?.setActiveConversationId;
  const reloadConversations = chat?.refreshConversations;

  const handleStartWithUser = React.useCallback(
    async (userId: string) => {
      if (!openConversation || !reloadConversations) return;

      const res = await fetch("/api/chat/conversations/start", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: userId }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? "Could not start conversation");
      }
      const data = (await res.json()) as { conversation: ChatConversationSummary };
      await reloadConversations();
      openConversation(data.conversation.id);
    },
    [openConversation, reloadConversations],
  );

  React.useEffect(() => {
    if (!chat || !openConversation) return;
    if (!withEmployeeId || loadingConversations) return;
    if (deepLinkHandledRef.current === withEmployeeId) return;

    let cancelled = false;

    void (async () => {
      const res = await fetch(`/api/chat/users/by-employee/${withEmployeeId}`, {
        credentials: "include",
      });
      if (!res.ok || cancelled) return;

      const data = (await res.json()) as { userId: string };
      if (!data.userId || cancelled) return;

      const existingByUser = conversations.find(
        (conversation) => conversation.participant.id === data.userId,
      );
      if (existingByUser) {
        deepLinkHandledRef.current = withEmployeeId;
        openConversation(existingByUser.id);
        return;
      }

      try {
        await handleStartWithUser(data.userId);
        if (!cancelled) deepLinkHandledRef.current = withEmployeeId;
      } catch {
        // Deep link failures are non-blocking; user can pick a chat manually.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    chat,
    conversations,
    handleStartWithUser,
    loadingConversations,
    openConversation,
    withEmployeeId,
  ]);

  if (!chat) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
        Messages are not available for your role. Ask an admin to enable the Messages module
        under Roles.
      </div>
    );
  }

  const {
    connected,
    activeConversationId,
    messages,
    loadingMessages,
    sendMessage,
    loadError,
    currentUserId,
    setActiveConversationId,
    refreshConversations,
  } = chat;

  const active = conversations.find((c) => c.id === activeConversationId) ?? null;

  if (loadError && conversations.length === 0) {
    return (
      <div className="flex h-[calc(100dvh-4.25rem-2rem)] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/70 bg-background/80 p-8 text-center sm:h-[calc(100dvh-4.25rem-3rem)] lg:h-[calc(100dvh-4.25rem-4rem)]">
        <MessageCircle className="h-10 w-10 text-muted-foreground/60" />
        <p className="text-sm font-medium text-foreground">Could not load messages</p>
        <p className="max-w-sm text-sm text-muted-foreground">{loadError}</p>
        <Button type="button" variant="outline" onClick={() => void refreshConversations()}>
          Try again
        </Button>
      </div>
    );
  }

  if (loadingConversations && conversations.length === 0) {
    return (
      <div className="flex h-[calc(100dvh-4.25rem-2rem)] items-center justify-center rounded-2xl border border-border/70 bg-background/80 text-sm text-muted-foreground sm:h-[calc(100dvh-4.25rem-3rem)] lg:h-[calc(100dvh-4.25rem-4rem)]">
        Loading conversations…
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-4.25rem-2rem)] overflow-hidden rounded-2xl border border-border/70 bg-background/80 shadow-sm sm:h-[calc(100dvh-4.25rem-3rem)] lg:h-[calc(100dvh-4.25rem-4rem)]">
      <AdminChatSidebar
        connected={connected}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
        onStartWithUser={handleStartWithUser}
        className={cn(activeConversationId && "hidden md:flex")}
      />

      <section
        className={cn(
          "min-w-0 flex-1 flex-col",
          activeConversationId ? "flex" : "hidden md:flex",
        )}
      >
        {active && currentUserId ? (
          <>
            <ChatHeader
              name={active.participant.name}
              imageUrl={active.participant.imageUrl}
              subtitle={`${active.participant.roleLabel}${active.participant.team ? ` · ${active.participant.team}` : ""}`}
              isOnline={active.participant.isOnline}
              onBack={() => setActiveConversationId(null)}
            />
            <ChatMessageList
              messages={messages}
              currentUserId={currentUserId}
              loading={loadingMessages}
            />
            <ChatComposer disabled={!activeConversationId} onSend={sendMessage} />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
            <MessageCircle className="h-8 w-8 text-muted-foreground/50" />
            <p>Search for a person or pick a recent chat to start messaging.</p>
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => void refreshConversations()}
            >
              Refresh list
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
