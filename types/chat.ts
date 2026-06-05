export type ChatParticipantProfile = {
  id: string;
  name: string;
  email: string;
  imageUrl: string;
  appRole: string;
  roleLabel: string;
  team?: string;
  isOnline: boolean;
};

/** App user row for admin people search (start new chat). */
export type ChatSearchUser = {
  id: string;
  name: string;
  email: string;
  imageUrl: string;
  appRole: string;
  roleLabel: string;
  team?: string;
  isOnline: boolean;
  hasConversation: boolean;
};

export type ChatConversationSummary = {
  id: string;
  /** @deprecated Legacy admin inbox field */
  employeeUserId?: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  participant: ChatParticipantProfile;
};

export type ChatConversationDetail = ChatConversationSummary & {
  participants: [string, string];
};
