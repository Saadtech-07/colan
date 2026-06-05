import type { ObjectId } from "mongodb";
import { COLLECTIONS } from "./collections";
import { readObjectIdHex } from "@/lib/object-id";

export const MESSAGE_COLLECTION = COLLECTIONS.messages;

export type MessageDocument = {
  _id: ObjectId;
  conversationId: ObjectId;
  senderId: ObjectId;
  receiverId: ObjectId;
  text: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type MessageDTO = {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  text: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
};

export function messageDocToDTO(doc: MessageDocument): MessageDTO {
  return {
    id: readObjectIdHex(doc._id),
    conversationId: readObjectIdHex(doc.conversationId),
    senderId: readObjectIdHex(doc.senderId),
    receiverId: readObjectIdHex(doc.receiverId),
    text: doc.text,
    isRead: doc.isRead,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
