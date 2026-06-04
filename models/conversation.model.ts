import type { ObjectId } from "mongodb";
import { COLLECTIONS } from "./collections";

export const CONVERSATION_COLLECTION = COLLECTIONS.conversations;

/** One thread per employee ↔ workspace admin (shared admin inbox). */
export type ConversationDocument = {
  _id: ObjectId;
  /** Employee app_users._id */
  employeeUserId: ObjectId;
  /** [employeeUserId, anchorAdminUserId] — anchor used for schema; all admins may access */
  participants: [ObjectId, ObjectId];
  lastMessage: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type ConversationDTO = {
  id: string;
  employeeUserId: string;
  participants: [string, string];
  lastMessage: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
};

export function conversationDocToDTO(doc: ConversationDocument): ConversationDTO {
  return {
    id: doc._id.toHexString(),
    employeeUserId: doc.employeeUserId.toHexString(),
    participants: [doc.participants[0].toHexString(), doc.participants[1].toHexString()],
    lastMessage: doc.lastMessage,
    lastMessageAt: doc.lastMessageAt.toISOString(),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
