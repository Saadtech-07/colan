"use client";

import * as React from "react";
import { MessageCircle, MessagesSquare } from "lucide-react";
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
}: {
  name: string;
  imageUrl: string;
  subtitle: string;
  isOnline: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border/60 bg-background/95 px-4 py-3">
      <Avatar className="h-10 w-10">
        <AvatarImage src={imageUrl} alt={name} />
        <AvatarFallback>{profileInitials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{name}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
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

function EmployeeMessageAdminLauncher({
  adminName,
  adminImageUrl,
  isOnline,
  loading,
  onStart,
}: {
  adminName: string;
  adminImageUrl: string;
  isOnline: boolean;
  loading: boolean;
  onStart: () => void;
}) {
  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center rounded-2xl border border-border/70 bg-gradient-to-b from-muted/30 to-background p-8 text-center shadow-sm">
      <div className="relative mb-5">
        <Avatar className="h-24 w-24 ring-4 ring-background shadow-md">
          <AvatarImage src={adminImageUrl} alt={adminName} />
          <AvatarFallback className="text-2xl">{profileInitials(adminName)}</AvatarFallback>
        </Avatar>
        <span
          className={cn(
            "absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-background",
            isOnline ? "bg-emerald-500" : "bg-muted-foreground/40",
          )}
        />
      </div>
      <h2 className="text-xl font-semibold text-foreground">{adminName}</h2>
      <p className="mt-1 text-sm text-muted-foreground">Workspace Admin</p>
      <p className="mt-4 max-w-md text-sm text-muted-foreground">
        Need help, an approval, or a project update? Tap below to open a private chat with
        admin.
      </p>
      <Button
        type="button"
        size="lg"
        className="mt-8 h-12 gap-2 rounded-full px-8 text-base shadow-md"
        disabled={loading}
        onClick={onStart}
      >
        <MessageCircle className="h-5 w-5" />
        {loading ? "Connecting…" : "Message Admin"}
      </Button>
      <p className="mt-4 text-xs text-muted-foreground">
        {isOnline ? "Admin is online" : "Admin is offline — you can still send a message"}
      </p>
    </div>
  );
}

export function ChatWorkspace() {
  const chat = useChatSafe();
  const [employeeChatOpen, setEmployeeChatOpen] = React.useState(false);
  const [startingChat, setStartingChat] = React.useState(false);

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
    isAdmin,
    conversations,
    activeConversationId,
    messages,
    loadingConversations,
    loadingMessages,
    setActiveConversationId,
    sendMessage,
    loadError,
    refreshConversations,
    currentUserId,
  } = chat;

  const handleStartWithUser = React.useCallback(
    async (userId: string) => {
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
      await refreshConversations();
      setActiveConversationId(data.conversation.id);
    },
    [refreshConversations, setActiveConversationId],
  );

  const active = conversations.find((c) => c.id === activeConversationId) ?? null;
  const employeeThread = conversations[0] ?? null;
  const hasExistingMessages = Boolean(employeeThread?.lastMessage?.trim());

  React.useEffect(() => {
    if (isAdmin || !employeeThread) return;
    if (hasExistingMessages) {
      setEmployeeChatOpen(true);
      if (!activeConversationId) {
        setActiveConversationId(employeeThread.id);
      }
    }
  }, [
    isAdmin,
    employeeThread,
    hasExistingMessages,
    activeConversationId,
    setActiveConversationId,
  ]);

  const handleStartEmployeeChat = async () => {
    setStartingChat(true);
    try {
      await refreshConversations();
      const res = await fetch("/api/chat/conversations", { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as {
          conversations: ChatConversationSummary[];
        };
        const thread = data.conversations[0];
        if (thread) {
          setActiveConversationId(thread.id);
        }
      }
      setEmployeeChatOpen(true);
    } finally {
      setStartingChat(false);
    }
  };

  if (loadError && conversations.length === 0) {
    return (
      <div className="flex min-h-[520px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/70 bg-background/80 p-8 text-center">
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
      <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-border/70 bg-background/80 text-sm text-muted-foreground">
        Loading conversations…
      </div>
    );
  }

  if (!isAdmin && conversations.length === 0 && !loadingConversations) {
    return (
      <div className="flex min-h-[520px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/70 bg-background/80 p-8 text-center">
        <MessageCircle className="h-10 w-10 text-muted-foreground/60" />
        <p className="text-sm font-medium text-foreground">Messages unavailable</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Could not reach workspace admin. Check MongoDB connection and that an admin account
          exists.
        </p>
        <Button type="button" variant="outline" onClick={() => void refreshConversations()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!isAdmin && !employeeChatOpen && employeeThread) {
    return (
      <EmployeeMessageAdminLauncher
        adminName={employeeThread.participant.name}
        adminImageUrl={employeeThread.participant.imageUrl}
        isOnline={employeeThread.participant.isOnline}
        loading={startingChat || loadingConversations}
        onStart={() => void handleStartEmployeeChat()}
      />
    );
  }

  return (
    <div className="flex h-[min(720px,calc(100vh-12rem))] overflow-hidden rounded-2xl border border-border/70 bg-background/80 shadow-sm">
      {isAdmin ? (
        <AdminChatSidebar
          connected={connected}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={setActiveConversationId}
          onStartWithUser={handleStartWithUser}
        />
      ) : null}

      <section className="flex min-w-0 flex-1 flex-col">
        {active && currentUserId ? (
          <>
            {!isAdmin ? (
              <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-4 py-2">
                <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <MessagesSquare className="h-4 w-4" />
                  Chat with Admin
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setEmployeeChatOpen(false)}
                >
                  Close
                </Button>
              </div>
            ) : null}
            <ChatHeader
              name={active.participant.name}
              imageUrl={active.participant.imageUrl}
              subtitle={
                isAdmin
                  ? `${active.participant.roleLabel}${active.participant.team ? ` · ${active.participant.team}` : ""}`
                  : "Workspace Admin"
              }
              isOnline={active.participant.isOnline}
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
            {isAdmin ? (
              <p>Search for a person above or pick a recent chat to start messaging.</p>
            ) : (
              <p>Preparing your conversation…</p>
            )}
            {isAdmin ? (
              <button
                type="button"
                className="text-xs font-medium text-primary hover:underline"
                onClick={() => void refreshConversations()}
              >
                Refresh list
              </button>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
