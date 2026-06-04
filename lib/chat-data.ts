import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import { isWorkspaceChatAdmin } from "@/lib/chat-access";
import { getRoleDefinition, normalizeAppRole } from "@/lib/permissions";
import { ensureRoleRegistry } from "@/lib/role-registry.server";
import {
  COLLECTIONS,
  appUserDocToPublic,
  conversationDocToDTO,
  employeeDocToDTO,
  ensureColanModelIndexes,
  messageDocToDTO,
  type AppUserDocument,
  type ConversationDocument,
  type ConversationDTO,
  type EmployeeDocument,
  type MessageDocument,
  type MessageDTO,
} from "@/models";
import type {
  ChatConversationDetail,
  ChatConversationSummary,
  ChatParticipantProfile,
  ChatSearchUser,
} from "@/types/chat";

export type ChatActor = {
  id: string;
  email: string;
  name: string;
  appRole: string;
  team?: string;
  imageUrl: string;
  isAdmin: boolean;
};

export async function getChatActorByEmail(email: string): Promise<ChatActor | null> {
  const db = await getDb();
  if (!db) return null;
  await ensureColanModelIndexes(db);
  const doc = await db.collection<AppUserDocument>(COLLECTIONS.appUsers).findOne({
    email: email.toLowerCase().trim(),
  });
  if (!doc) return null;
  const pub = appUserDocToPublic(doc);
  const profile = await resolveParticipantProfile(pub.id, pub.name, pub.imageUrl, pub.employeeId);
  return {
    id: pub.id,
    email: pub.email,
    name: profile.name,
    appRole: pub.appRole,
    team: pub.team,
    imageUrl: profile.imageUrl,
    isAdmin: isWorkspaceChatAdmin(pub.appRole),
  };
}

export async function getChatActorById(userId: string): Promise<ChatActor | null> {
  if (!ObjectId.isValid(userId)) return null;
  const db = await getDb();
  if (!db) return null;
  const doc = await db.collection<AppUserDocument>(COLLECTIONS.appUsers).findOne({
    _id: new ObjectId(userId),
  });
  if (!doc) return null;
  const pub = appUserDocToPublic(doc);
  const profile = await resolveParticipantProfile(pub.id, pub.name, pub.imageUrl, pub.employeeId);
  return {
    id: pub.id,
    email: pub.email,
    name: profile.name,
    appRole: pub.appRole,
    team: pub.team,
    imageUrl: profile.imageUrl,
    isAdmin: isWorkspaceChatAdmin(pub.appRole),
  };
}

async function resolveParticipantProfile(
  userId: string,
  fallbackName: string,
  fallbackImage: string,
  employeeId: string,
): Promise<{ name: string; imageUrl: string }> {
  const db = await getDb();
  if (!db || !employeeId.trim()) {
    return { name: fallbackName, imageUrl: fallbackImage };
  }
  const employee = await db.collection<EmployeeDocument>(COLLECTIONS.employees).findOne({
    employeeId: employeeId.trim(),
  });
  if (!employee) {
    return { name: fallbackName, imageUrl: fallbackImage };
  }
  const dto = employeeDocToDTO(employee);
  return {
    name: dto.name || fallbackName,
    imageUrl: dto.imageUrl || fallbackImage,
  };
}

export async function getAnchorAdminUserId(): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const doc = await db.collection<AppUserDocument>(COLLECTIONS.appUsers).findOne(
    { appRole: "admin" },
    { sort: { createdAt: 1 } },
  );
  return doc ? doc._id.toHexString() : null;
}

async function roleLabelFor(appRole: string): Promise<string> {
  await ensureRoleRegistry();
  return getRoleDefinition(normalizeAppRole(appRole)).label;
}

async function enrichParticipant(
  userId: string,
  onlineUserIds: Set<string>,
): Promise<ChatParticipantProfile | null> {
  const actor = await getChatActorById(userId);
  if (!actor) return null;
  return {
    id: actor.id,
    name: actor.name,
    email: actor.email,
    imageUrl: actor.imageUrl,
    appRole: actor.appRole,
    roleLabel: await roleLabelFor(actor.appRole),
    team: actor.team,
    isOnline: onlineUserIds.has(actor.id),
  };
}

/** Non-admin app users the workspace admin can message. */
export async function searchChatRecipients(args: {
  adminUserId: string;
  query?: string;
  onlineUserIds?: Set<string>;
  limit?: number;
}): Promise<ChatSearchUser[]> {
  const db = await getDb();
  if (!db || !ObjectId.isValid(args.adminUserId)) return [];

  const q = (args.query ?? "").trim().toLowerCase();
  const limit = args.limit ?? 24;
  const online = args.onlineUserIds ?? new Set<string>();

  const users = await db.collection<AppUserDocument>(COLLECTIONS.appUsers).find({}).toArray();

  const conversationUserIds = new Set(
    (
      await db
        .collection<ConversationDocument>(COLLECTIONS.conversations)
        .find({}, { projection: { employeeUserId: 1 } })
        .toArray()
    ).map((c) => c.employeeUserId.toHexString()),
  );

  const results: ChatSearchUser[] = [];

  for (const doc of users) {
    const pub = appUserDocToPublic(doc);
    if (pub.id === args.adminUserId) continue;
    if (isWorkspaceChatAdmin(pub.appRole)) continue;

    const profile = await resolveParticipantProfile(
      pub.id,
      pub.name,
      pub.imageUrl,
      pub.employeeId,
    );
    const roleLabel = await roleLabelFor(pub.appRole);
    const haystack = [profile.name, pub.email, pub.employeeId, pub.appRole, roleLabel, pub.team ?? ""]
      .join(" ")
      .toLowerCase();

    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean);
      if (tokens.length && !tokens.every((token) => haystack.includes(token))) continue;
    }

    results.push({
      id: pub.id,
      name: profile.name,
      email: pub.email,
      imageUrl: profile.imageUrl,
      appRole: pub.appRole,
      roleLabel,
      team: pub.team,
      isOnline: online.has(pub.id),
      hasConversation: conversationUserIds.has(pub.id),
    });
  }

  results.sort((a, b) => {
    if (a.hasConversation !== b.hasConversation) return a.hasConversation ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return results.slice(0, limit);
}

export async function startAdminConversationWithUser(
  adminViewerId: string,
  targetUserId: string,
  onlineUserIds: Set<string> = new Set(),
): Promise<ChatConversationSummary | null> {
  if (!ObjectId.isValid(targetUserId) || !ObjectId.isValid(adminViewerId)) {
    throw new Error("Invalid user.");
  }
  if (targetUserId === adminViewerId) {
    throw new Error("You cannot message yourself.");
  }

  const target = await getChatActorById(targetUserId);
  if (!target) throw new Error("User not found.");
  if (target.isAdmin) {
    throw new Error("Admin accounts use the shared inbox; message managers and employees instead.");
  }

  const conv = await getOrCreateEmployeeConversation(targetUserId);
  if (!conv) return null;
  return getConversationDetail(conv.id, adminViewerId, true, onlineUserIds);
}

async function getConversationByEmployeeUserId(
  employeeUserId: string,
): Promise<ConversationDTO | null> {
  if (!ObjectId.isValid(employeeUserId)) return null;
  const db = await getDb();
  if (!db) return null;
  const doc = await db.collection<ConversationDocument>(COLLECTIONS.conversations).findOne({
    employeeUserId: new ObjectId(employeeUserId),
  });
  return doc ? conversationDocToDTO(doc) : null;
}

async function countUnreadForUser(
  conversationId: ObjectId,
  readerId: ObjectId,
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  return db.collection<MessageDocument>(COLLECTIONS.messages).countDocuments({
    conversationId,
    receiverId: readerId,
    isRead: false,
  });
}

export async function listAdminConversations(
  viewerId: string,
  onlineUserIds: Set<string> = new Set(),
): Promise<ChatConversationSummary[]> {
  const db = await getDb();
  if (!db || !ObjectId.isValid(viewerId)) return [];

  const docs = await db
    .collection<ConversationDocument>(COLLECTIONS.conversations)
    .find({})
    .sort({ lastMessageAt: -1 })
    .toArray();

  const viewerOid = new ObjectId(viewerId);
  const summaries: ChatConversationSummary[] = [];

  for (const doc of docs) {
    const participant = await enrichParticipant(doc.employeeUserId.toHexString(), onlineUserIds);
    if (!participant) continue;
    const unreadCount = await countUnreadForUser(doc._id, viewerOid);
    summaries.push({
      id: doc._id.toHexString(),
      employeeUserId: doc.employeeUserId.toHexString(),
      lastMessage: doc.lastMessage,
      lastMessageAt: doc.lastMessageAt.toISOString(),
      unreadCount,
      participant,
    });
  }

  return summaries;
}

export async function getEmployeeConversation(
  employeeUserId: string,
  viewerId: string,
  onlineUserIds: Set<string> = new Set(),
): Promise<ChatConversationDetail | null> {
  const db = await getDb();
  if (!db || !ObjectId.isValid(employeeUserId) || !ObjectId.isValid(viewerId)) {
    return null;
  }

  const doc = await db.collection<ConversationDocument>(COLLECTIONS.conversations).findOne({
    employeeUserId: new ObjectId(employeeUserId),
  });
  if (!doc) return null;

  const adminId = doc.participants[1].toHexString();
  const adminProfile = await enrichParticipant(adminId, onlineUserIds);
  if (!adminProfile) return null;

  const viewerOid = new ObjectId(viewerId);
  const unreadCount = await countUnreadForUser(doc._id, viewerOid);

  return {
    id: doc._id.toHexString(),
    employeeUserId: doc.employeeUserId.toHexString(),
    lastMessage: doc.lastMessage,
    lastMessageAt: doc.lastMessageAt.toISOString(),
    unreadCount,
    participant: adminProfile,
    participants: [doc.participants[0].toHexString(), doc.participants[1].toHexString()],
  };
}

export async function getConversationDetail(
  conversationId: string,
  viewerId: string,
  viewerIsAdmin: boolean,
  onlineUserIds: Set<string> = new Set(),
): Promise<ChatConversationDetail | null> {
  const conversation = await getConversationById(conversationId);
  if (!conversation || !ObjectId.isValid(viewerId)) return null;

  const counterpartyId = viewerIsAdmin
    ? conversation.employeeUserId
    : conversation.participants[1];

  const participant = await enrichParticipant(counterpartyId, onlineUserIds);
  if (!participant) return null;

  const db = await getDb();
  if (!db) return null;

  const unreadCount = await countUnreadForUser(
    new ObjectId(conversation.id),
    new ObjectId(viewerId),
  );

  return {
    id: conversation.id,
    employeeUserId: conversation.employeeUserId,
    lastMessage: conversation.lastMessage,
    lastMessageAt: conversation.lastMessageAt,
    unreadCount,
    participant,
    participants: conversation.participants,
  };
}

export async function getOrCreateEmployeeConversation(
  employeeUserId: string,
): Promise<ConversationDTO | null> {
  const db = await getDb();
  if (!db || !ObjectId.isValid(employeeUserId)) return null;

  const employeeOid = new ObjectId(employeeUserId);
  const existing = await db.collection<ConversationDocument>(COLLECTIONS.conversations).findOne({
    employeeUserId: employeeOid,
  });
  if (existing) return conversationDocToDTO(existing);

  const anchorAdminId = await getAnchorAdminUserId();
  if (!anchorAdminId || !ObjectId.isValid(anchorAdminId)) {
    throw new Error("No workspace admin account is configured for messaging.");
  }

  const now = new Date();
  const doc: ConversationDocument = {
    _id: new ObjectId(),
    employeeUserId: employeeOid,
    participants: [employeeOid, new ObjectId(anchorAdminId)],
    lastMessage: "",
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection<ConversationDocument>(COLLECTIONS.conversations).insertOne(doc);
  return conversationDocToDTO(doc);
}

export async function getConversationById(
  conversationId: string,
): Promise<ConversationDTO | null> {
  if (!ObjectId.isValid(conversationId)) return null;
  const db = await getDb();
  if (!db) return null;
  const doc = await db
    .collection<ConversationDocument>(COLLECTIONS.conversations)
    .findOne({ _id: new ObjectId(conversationId) });
  return doc ? conversationDocToDTO(doc) : null;
}

export function assertConversationAccess(
  actor: ChatActor,
  conversation: ConversationDTO,
): string | null {
  if (actor.isAdmin) return null;
  if (conversation.employeeUserId === actor.id) return null;
  return "You do not have access to this conversation.";
}

export async function listMessages(conversationId: string): Promise<MessageDTO[]> {
  if (!ObjectId.isValid(conversationId)) return [];
  const db = await getDb();
  if (!db) return [];

  const docs = await db
    .collection<MessageDocument>(COLLECTIONS.messages)
    .find({ conversationId: new ObjectId(conversationId) })
    .sort({ createdAt: 1 })
    .toArray();

  return docs.map(messageDocToDTO);
}

export type SendMessageResult = {
  message: MessageDTO;
  conversation: ConversationDTO;
};

export async function sendChatMessage(args: {
  conversationId: string;
  senderId: string;
  text: string;
}): Promise<SendMessageResult> {
  const db = await getDb();
  if (!db) throw new Error("MongoDB is not configured.");
  if (!ObjectId.isValid(args.conversationId) || !ObjectId.isValid(args.senderId)) {
    throw new Error("Invalid conversation or sender.");
  }

  const trimmed = args.text.trim();
  if (!trimmed) throw new Error("Message cannot be empty.");

  const conversationOid = new ObjectId(args.conversationId);
  const senderOid = new ObjectId(args.senderId);

  const conversation = await db
    .collection<ConversationDocument>(COLLECTIONS.conversations)
    .findOne({ _id: conversationOid });
  if (!conversation) throw new Error("Conversation not found.");

  const employeeId = conversation.employeeUserId;
  const adminId = conversation.participants[1];

  const actor = await getChatActorById(args.senderId);
  if (!actor) throw new Error("Sender account not found.");

  let receiverId: ObjectId;
  if (senderOid.equals(employeeId)) {
    receiverId = adminId;
  } else if (actor.isAdmin) {
    receiverId = employeeId;
  } else {
    throw new Error("You cannot send messages in this conversation.");
  }

  const now = new Date();
  const messageDoc: MessageDocument = {
    _id: new ObjectId(),
    conversationId: conversationOid,
    senderId: senderOid,
    receiverId,
    text: trimmed,
    isRead: false,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection<MessageDocument>(COLLECTIONS.messages).insertOne(messageDoc);
  await db.collection<ConversationDocument>(COLLECTIONS.conversations).updateOne(
    { _id: conversationOid },
    {
      $set: {
        lastMessage: trimmed,
        lastMessageAt: now,
        updatedAt: now,
      },
    },
  );

  const updated = await db
    .collection<ConversationDocument>(COLLECTIONS.conversations)
    .findOne({ _id: conversationOid });

  return {
    message: messageDocToDTO(messageDoc),
    conversation: conversationDocToDTO(updated!),
  };
}

export async function markConversationRead(args: {
  conversationId: string;
  readerId: string;
}): Promise<number> {
  const db = await getDb();
  if (!db || !ObjectId.isValid(args.conversationId) || !ObjectId.isValid(args.readerId)) {
    return 0;
  }

  const result = await db.collection<MessageDocument>(COLLECTIONS.messages).updateMany(
    {
      conversationId: new ObjectId(args.conversationId),
      receiverId: new ObjectId(args.readerId),
      isRead: false,
    },
    { $set: { isRead: true, updatedAt: new Date() } },
  );

  return result.modifiedCount;
}

export async function getUnreadMessageCount(userId: string): Promise<number> {
  if (!ObjectId.isValid(userId)) return 0;
  const db = await getDb();
  if (!db) return 0;

  return db.collection<MessageDocument>(COLLECTIONS.messages).countDocuments({
    receiverId: new ObjectId(userId),
    isRead: false,
  });
}
