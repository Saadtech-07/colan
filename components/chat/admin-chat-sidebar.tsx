"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { profileInitials } from "@/lib/profile-image";
import { formatChatTime } from "@/lib/chat-client";
import { cn } from "@/lib/utils";
import type { ChatConversationSummary, ChatSearchUser } from "@/types/chat";

function ConversationListItem({
  item,
  active,
  onSelect,
}: {
  item: ChatConversationSummary;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-muted/40",
        active && "bg-muted/50",
      )}
    >
      <div className="relative shrink-0">
        <Avatar className="h-11 w-11">
          <AvatarImage src={item.participant.imageUrl} alt={item.participant.name} />
          <AvatarFallback>{profileInitials(item.participant.name)}</AvatarFallback>
        </Avatar>
        <span
          className={cn(
            "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
            item.participant.isOnline ? "bg-emerald-500" : "bg-muted-foreground/40",
          )}
          aria-hidden
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-foreground">
            {item.participant.name}
          </p>
          {item.lastMessageAt ? (
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {formatChatTime(item.lastMessageAt)}
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="h-5 rounded-full px-2 text-[10px] font-medium">
            {item.participant.roleLabel}
          </Badge>
          {item.participant.team ? (
            <span className="truncate text-[10px] text-muted-foreground">
              {item.participant.team}
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {item.lastMessage || "No messages yet"}
        </p>
      </div>
      {item.unreadCount > 0 ? (
        <Badge className="mt-1 h-5 min-w-5 shrink-0 justify-center rounded-full px-1.5 text-[10px]">
          {item.unreadCount}
        </Badge>
      ) : null}
    </button>
  );
}

function SearchUserChip({
  user,
  onSelect,
}: {
  user: ChatSearchUser;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-20 shrink-0 flex-col items-center gap-1.5 rounded-xl p-2 transition-colors hover:bg-muted/50"
    >
      <div className="relative">
        <Avatar className="h-12 w-12">
          <AvatarImage src={user.imageUrl} alt={user.name} />
          <AvatarFallback className="text-xs">{profileInitials(user.name)}</AvatarFallback>
        </Avatar>
        <span
          className={cn(
            "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background",
            user.isOnline ? "bg-emerald-500" : "bg-muted-foreground/40",
          )}
        />
      </div>
      <span className="line-clamp-2 w-full text-center text-[11px] font-medium leading-tight text-foreground">
        {user.name}
      </span>
      <span className="text-[10px] text-muted-foreground">{user.roleLabel}</span>
    </button>
  );
}

type Props = {
  connected: boolean;
  conversations: ChatConversationSummary[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onStartWithUser: (userId: string) => Promise<void>;
  className?: string;
};

export function AdminChatSidebar({
  connected,
  conversations,
  activeConversationId,
  onSelectConversation,
  onStartWithUser,
  className,
}: Props) {
  const [query, setQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<ChatSearchUser[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchFocused, setSearchFocused] = React.useState(false);
  const [startingUserId, setStartingUserId] = React.useState<string | null>(null);
  const [startError, setStartError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const trimmed = query.trim();
    if (!searchFocused && !trimmed) {
      setSearchResults([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const params = new URLSearchParams();
          if (trimmed) params.set("q", trimmed);
          const res = await fetch(`/api/chat/users?${params.toString()}`, {
            credentials: "include",
          });
          if (!res.ok) {
            setSearchResults([]);
            return;
          }
          const data = (await res.json()) as { users: ChatSearchUser[] };
          setSearchResults(data.users);
        } finally {
          setSearching(false);
        }
      })();
    }, 280);

    return () => window.clearTimeout(timer);
  }, [query, searchFocused]);

  const showSearchPanel = searchFocused || query.trim().length > 0;

  const handlePickUser = async (user: ChatSearchUser) => {
    setStartingUserId(user.id);
    setStartError(null);
    try {
      await onStartWithUser(user.id);
      setQuery("");
      setSearchFocused(false);
      setSearchResults([]);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "Could not start chat");
    } finally {
      setStartingUserId(null);
    }
  };

  return (
    <aside
      className={cn(
        "flex w-full max-w-none flex-col border-r border-border/60 bg-muted/10 md:max-w-sm md:w-80",
        className,
      )}
    >
      <div className="space-y-2 border-b border-border/60 px-3 py-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-sm font-semibold text-foreground">Chats</p>
          <p className="text-[10px] text-muted-foreground">{connected ? "Live" : "Offline"}</p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            placeholder="Search people by name, email, role…"
            className="h-10 rounded-xl bg-background pl-9 pr-9"
          />
          {(query || searchFocused) && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => {
                setQuery("");
                setSearchFocused(false);
                setSearchResults([]);
              }}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {showSearchPanel ? (
        <div className="max-h-[45%] shrink-0 overflow-y-auto border-b border-border/60 bg-background">
          <p className="px-4 pb-2 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            People
          </p>
          {searching ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">Searching…</p>
          ) : searchResults.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">No matching app users.</p>
          ) : (
            <div className="flex gap-1 overflow-x-auto px-3 pb-3">
              {searchResults.map((user) => (
                <SearchUserChip
                  key={user.id}
                  user={user}
                  onSelect={() => void handlePickUser(user)}
                />
              ))}
            </div>
          )}
          {startingUserId ? (
            <p className="px-4 py-2 text-xs text-muted-foreground">Opening conversation…</p>
          ) : null}
          {startError ? (
            <p className="px-4 pb-2 text-xs text-destructive">{startError}</p>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="sticky top-0 z-10 border-b border-border/40 bg-muted/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur-sm">
          Recent chats
        </p>
        {conversations.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Search above to message a manager, employee, or other app user.
          </p>
        ) : (
          conversations.map((item) => (
            <ConversationListItem
              key={item.id}
              item={item}
              active={item.id === activeConversationId}
              onSelect={() => onSelectConversation(item.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}
